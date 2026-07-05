import { useState, useEffect } from "react";
import { getTrackingEnabled, setTrackingEnabled, initStorageListener } from "./lib/storage";

function IndexPopup() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getTrackingEnabled().then(setEnabled);
    initStorageListener(setEnabled);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setTrackingEnabled(next);
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: "./tabs/dashboard.html" });
  };

  return (
    <div style={{
      width: 280,
      padding: '24px 20px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#ffffff',
      color: '#1e293b',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
        }}>
          T
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#0f172a' }}>Mail Tracker</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>Serverless Email Analytics</div>
        </div>
      </div>

      {/* Main Action Block */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#f8fafc',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        marginBottom: 16
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Auto-track emails</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Embed pixel on send</div>
        </div>
        <button
          onClick={toggle}
          aria-label="Toggle auto-track emails"
          style={{
            width: 46,
            height: 24,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: enabled ? '#10b981' : '#cbd5e1',
            position: 'relative',
            transition: 'background 0.2s ease',
            padding: 0
          }}
        >
          <div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: enabled ? 25 : 3,
            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }} />
        </button>
      </div>

      {/* Open Dashboard Button */}
      <button
        onClick={openDashboard}
        style={{
          width: '100%',
          padding: '12px',
          background: '#0f172a',
          color: '#ffffff',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s ease, transform 0.1s ease',
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#1e293b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#0f172a';
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        Open Analytics Dashboard
      </button>

      {/* Footer */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
        Toggle also available directly in the Gmail compose window.
      </div>
    </div>
  );
}

export default IndexPopup;
