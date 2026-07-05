import { fetchRecentStatuses, resetTrackingStatus, type EmailStatus } from './api';
import { getTrackingEnabledSync } from './storage';
import { getEmailRows, getRowSubject, getRowSubjectElement, getSender } from './gmail';

const ICON_ATTR = 'data-mailtracker-check';
const CACHE_TTL = 30_000; // 30 seconds status cache

let statusCache: EmailStatus[] = [];
let lastFetch = 0;
let fetching = false;

function normalize(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim().toLowerCase();
}

async function refreshCache(force = false) {
  if (fetching) return;
  if (!force && Date.now() - lastFetch < CACHE_TTL) return;
  fetching = true;
  console.log('[Mail Tracker] Refreshing status cache from backend...');
  try {
    statusCache = await fetchRecentStatuses();
    console.log('[Mail Tracker] Cached', statusCache.length, 'statuses successfully.');
    lastFetch = Date.now();
  } catch (err) {
    console.error('[Mail Tracker] Failed to refresh status cache:', err);
  } finally {
    fetching = false;
  }
}

// Double checkmark SVG in emerald green
const CHECK_OPENED = `
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;">
    <polyline points="20 6 9 17 4 12"></polyline>
    <polyline points="22 10 13.5 18.5 11 16" style="opacity:0.8;"></polyline>
  </svg>
`;

// Single checkmark SVG in grey
const CHECK_PENDING = `
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
`;

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

function createIcon(email: EmailStatus): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute(ICON_ATTR, 'true');
  span.setAttribute('data-id', email.id);
  span.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;flex-shrink:0;cursor:pointer;line-height:0;';
  
  if (email.opened) {
    span.innerHTML = CHECK_OPENED;
    span.title = `Opened ${formatTimeAgo(email.openedAt!)} (to ${email.recipient})`;
  } else {
    span.innerHTML = CHECK_PENDING;
    span.title = `Pending (sent to ${email.recipient})`;
  }
  return span;
}

export async function processListIcons() {
  if (!getTrackingEnabledSync()) {
    removeAllIcons();
    return;
  }

  await refreshCache();
  
  const rows = getEmailRows();
  console.log('[Mail Tracker] Found', rows.length, 'email rows in Gmail DOM.');
  if (rows.length === 0) return;

  console.log('[Mail Tracker] statusCache subjects:', statusCache.map(e => `"${e.subject}" -> "${normalize(e.subject)}"`));

  // Track occurrences of subjects to align with the list view order (descending by date)
  const subjectCounters = new Map<string, number>();

  for (const row of rows) {
    const subject = getRowSubject(row);
    if (!subject) {
      console.log('[Mail Tracker] Row has no subject element.');
      continue;
    }
    const norm = normalize(subject);
    console.log('[Mail Tracker] Row subject:', `"${subject}"`, '-> Normalized:', `"${norm}"`);

    const count = subjectCounters.get(norm) ?? 0;
    subjectCounters.set(norm, count + 1);

    const matches = statusCache.filter(e => normalize(e.subject) === norm);
    console.log('[Mail Tracker] Matches in cache:', matches.length, 'for count:', count);
    
    if (count >= matches.length) {
      continue;
    }

    const email = matches[count];
    if (!email) {
      continue;
    }
    
    // Check if icon is already injected
    const existing = row.querySelector(`[${ICON_ATTR}]`);
    if (existing) {
      const existingId = existing.getAttribute('data-id');
      const isOpened = existing.querySelector('svg')?.getAttribute('stroke') === '#10b981';
      if (existingId === email.id && isOpened === email.opened) {
        continue;
      }
      existing.remove();
    }

    const subjectEl = getRowSubjectElement(row);
    if (!subjectEl) {
      console.log('[Mail Tracker] Subject element not found for row:', subject);
      continue;
    }

    console.log('[Mail Tracker] Injecting checkmark badge for:', subject, 'Status:', email.opened ? 'Opened' : 'Pending');
    const icon = createIcon(email);
    subjectEl.parentElement.insertBefore(icon, subjectEl);

    // Owner view reset logic
    if (!email.opened && !row.hasAttribute('data-mailtracker-hooked')) {
      row.setAttribute('data-mailtracker-hooked', 'true');
      row.addEventListener('click', () => {
        console.log(`[Mail Tracker] Owner clicked pending email: "${email.subject}". Reverting view in 1.5s...`);
        setTimeout(async () => {
          try {
            const ok = await resetTrackingStatus(email.id);
            if (ok) {
              console.log('[Mail Tracker] Reverted owner-open successfully.');
              await refreshCache(true);
              processListIcons();
            }
          } catch (e) {
            console.error('[Mail Tracker] Failed to reset owner view:', e);
          }
        }, 1500);
      }, { once: true });
    }
  }
}

export function invalidateListIconCache() {
  lastFetch = 0;
}

function removeAllIcons() {
  document.querySelectorAll(`[${ICON_ATTR}]`).forEach((el) => el.remove());
}
