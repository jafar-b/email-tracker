const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:8787';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

export type EmailStatus = {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  opened: boolean;
  openedAt: string | null;
  createdAt: string;
};

export type DashboardStats = {
  total: number;
  opened: number;
  pending: number;
  openRate: number;
  openedToday: number;
  openedThisWeek: number;
};

export async function registerEmail(subject: string, recipient: string, sender: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/email`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ subject, recipient, sender }),
    });
    if (res.ok) return res.json();
    console.error('[Mail Tracker] Server error:', await res.text());
    return null;
  } catch (err) {
    console.error('[Mail Tracker] Network error:', err);
    return null;
  }
}

export function getPixelUrl(emailId: string): string {
  return `${API_BASE_URL}/pixel/${emailId}.gif`;
}

export async function fetchRecentStatuses(limit = 100): Promise<EmailStatus[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/status?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error('[Mail Tracker] Failed to fetch statuses:', err);
    return [];
  }
}

export async function resetTrackingStatus(emailId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/status/${emailId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('[Mail Tracker] Failed to reset status:', err);
    return false;
  }
}

export async function fetchStats(): Promise<DashboardStats | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats`);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('[Mail Tracker] Failed to fetch stats:', err);
    return null;
  }
}
