import type { PlasmoCSConfig } from 'plasmo';
import { getTrackingEnabledSync, setTrackingEnabled, initStorageListener, loadInitialState } from './lib/storage';
import { registerEmail, getPixelUrl, resetTrackingStatus, fetchRecentStatuses } from './lib/api';
import { getComposeWindows, getComposeBody, getComposeToolbar, getSubject, getRecipient, getSender, getSendButton, getDropdownButton, getOpenEmailSubject, isInEmailView } from './lib/gmail';
import { processListIcons, invalidateListIconCache } from './lib/listIcons';

export const config: PlasmoCSConfig = {
  matches: ['https://mail.google.com/*'],
  all_frames: false,
  run_at: 'document_idle',
};

const BUTTON_ID = 'mailtracker-toggle';
const INJECTED_ATTR = 'data-mailtracker-injected';
const SENDING_ATTR = 'data-mailtracker-sending';

const EYE_SVG_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SVG_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function createToggleButton(): HTMLElement {
  const enabled = getTrackingEnabledSync();

  const wrapper = document.createElement('div');
  wrapper.id = BUTTON_ID;
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('tabindex', '0');
  wrapper.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;cursor:pointer;user-select:none;transition:background 0.15s,color 0.15s;margin-left:8px;vertical-align:middle;box-sizing:border-box;';

  const icon = document.createElement('span');
  icon.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;line-height:0;';

  function render(on: boolean) {
    wrapper.style.color = on ? '#10b981' : '#5f6368';
    wrapper.style.background = on ? 'rgba(16,185,129,0.08)' : 'transparent';
    wrapper.setAttribute('data-tooltip', on ? 'Tracking enabled' : 'Tracking disabled');
    wrapper.setAttribute('aria-label', on ? 'Tracking enabled' : 'Tracking disabled');
    icon.innerHTML = on ? EYE_SVG_ON : EYE_SVG_OFF;
  }

  render(enabled);
  wrapper.appendChild(icon);

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = !getTrackingEnabledSync();
    setTrackingEnabled(next);
    render(next);
  });

  wrapper.addEventListener('mouseenter', () => {
    const on = getTrackingEnabledSync();
    wrapper.style.background = on ? 'rgba(16,185,129,0.16)' : 'rgba(95,99,104,0.08)';
  });
  wrapper.addEventListener('mouseleave', () => {
    const on = getTrackingEnabledSync();
    wrapper.style.background = on ? 'rgba(16,185,129,0.08)' : 'transparent';
  });

  initStorageListener((on) => render(on));

  return wrapper;
}

async function injectPixelBeforeSend(composeWindow: Element) {
  if (!getTrackingEnabledSync()) return;

  const body = getComposeBody(composeWindow);
  if (!body) return;

  const subject = getSubject(composeWindow);
  const recipient = getRecipient(composeWindow);
  const sender = getSender();

  console.log('[Mail Tracker] Registering email prior to sending:', { subject, recipient, sender });
  const email = await registerEmail(subject, recipient, sender);
  if (!email) {
    console.error('[Mail Tracker] Failed to register email tracking.');
    return;
  }
  console.log('[Mail Tracker] Registered email successfully. ID:', email.id);

  const img = document.createElement('img');
  img.src = getPixelUrl(email.id);
  img.width = 1;
  img.height = 1;
  img.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none;';
  body.appendChild(img);
  console.log('[Mail Tracker] Tracking pixel injected into body.');
}

function hookSendButton(composeWindow: Element) {
  const sendBtn = getSendButton(composeWindow);
  if (!sendBtn || sendBtn.hasAttribute(INJECTED_ATTR)) return;
  sendBtn.setAttribute(INJECTED_ATTR, 'true');

  sendBtn.addEventListener('click', async (e) => {
    if (sendBtn.hasAttribute(SENDING_ATTR)) return;
    if (!getTrackingEnabledSync()) return;

    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();

    await injectPixelBeforeSend(composeWindow);

    sendBtn.setAttribute(SENDING_ATTR, 'true');
    sendBtn.click();
    requestAnimationFrame(() => sendBtn.removeAttribute(SENDING_ATTR));
  }, true);
}

function hookDropdownButton(composeWindow: Element) {
  const dropBtn = getDropdownButton(composeWindow);
  if (!dropBtn || dropBtn.hasAttribute(INJECTED_ATTR)) return;
  dropBtn.setAttribute(INJECTED_ATTR, 'true');

  dropBtn.addEventListener('click', () => {
    console.log('[Mail Tracker] More send options clicked.');
    setTimeout(() => {
      const menuItems = document.querySelectorAll('div[role="menuitem"]');
      for (const item of Array.from(menuItems)) {
        const text = item.textContent?.toLowerCase() || '';
        if (text.includes('schedule send') && !item.hasAttribute(INJECTED_ATTR)) {
          item.setAttribute(INJECTED_ATTR, 'true');
          item.addEventListener('click', async () => {
            console.log('[Mail Tracker] Schedule send option clicked. Injecting tracking pixel...');
            await injectPixelBeforeSend(composeWindow);
          });
        }
      }
    }, 150);
  });
}

function processComposeWindows() {
  for (const win of getComposeWindows()) {
    if (win.querySelector(`#${BUTTON_ID}`)) continue;
    const toolbar = getComposeToolbar(win);
    if (!toolbar) continue;
    toolbar.appendChild(createToggleButton());
    hookSendButton(win);
    hookDropdownButton(win);
  }
}

let lastEmailSubject: string | null = null;

function normalize(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim().toLowerCase();
}

async function processEmailView() {
  if (!isInEmailView()) {
    lastEmailSubject = null;
    return;
  }

  const subject = getOpenEmailSubject();
  if (!subject || subject === lastEmailSubject) return;
  lastEmailSubject = subject;

  const sender = getSender();
  console.log('[Mail Tracker] Owner viewing email:', subject, 'from sender:', sender);
  
  // Fetch recent statuses to check if this email is one of ours and is Pending
  const statuses = await fetchRecentStatuses();
  const norm = normalize(subject);
  const match = statuses.find(e => normalize(e.subject) === norm && e.sender === sender);

  if (match && !match.opened) {
    console.log(`[Mail Tracker] Owner viewed pending email: "${match.subject}". Reverting open status in 1.5s...`);
    // If it's ours and was pending, trigger a reset after a short delay
    setTimeout(async () => {
      try {
        const ok = await resetTrackingStatus(match.id);
        if (ok) {
          console.log('[Mail Tracker] Reverted owner-open successfully.');
          invalidateListIconCache();
          processListIcons();
        }
      } catch (err) {
        console.error('[Mail Tracker] Failed to reset owner view:', err);
      }
    }, 1500);
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

async function init() {
  console.log('[Mail Tracker] Initializing Extension content script...');
  await loadInitialState();
  console.log('[Mail Tracker] Extension status loaded. Enabled:', getTrackingEnabledSync());

  const debouncedUpdate = debounce(() => {
    processComposeWindows();
    processEmailView();
    processListIcons();
  }, 150);

  const observer = new MutationObserver(debouncedUpdate);
  observer.observe(document.body, { childList: true, subtree: true });
  
  window.addEventListener('hashchange', () => {
    lastEmailSubject = null;
    invalidateListIconCache();
    processEmailView();
    processListIcons();
  });

  initStorageListener((enabled) => {
    console.log('[Mail Tracker] Tracking enabled status toggled:', enabled);
    processListIcons();
    if (enabled) {
      processEmailView();
    } else {
      lastEmailSubject = null;
    }
  });

  processComposeWindows();
  processEmailView();
  processListIcons();
}

init();
