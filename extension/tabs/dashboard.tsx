import { useState, useEffect } from "react";
import { fetchStats, fetchRecentStatuses, type EmailStatus, type DashboardStats } from "../lib/api";

type QuickDate = "all" | "today" | "week" | "month";
type SortBy = "newest" | "oldest" | "recently_opened";

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [emails, setEmails] = useState<EmailStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "opened" | "pending">("all");
  const [quickDate, setQuickDate] = useState<QuickDate>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([fetchStats(), fetchRecentStatuses()]);
      setStats(s);
      // Deduplicate: for same subject+recipient, keep only the earliest entry
      // if subsequent ones were created within 2 minutes (double-send detection)
      const FIVE_MINUTES_MS = 2 * 60 * 1000;
      const seen = new Map<string, number>();
      const deduped = list.filter(e => {
        const key = `${e.subject.trim().toLowerCase()}|${e.recipient.trim().toLowerCase()}`;
        const ts = new Date(e.createdAt).getTime();
        if (seen.has(key)) {
          const firstTs = seen.get(key)!;
          if (Math.abs(ts - firstTs) < FIVE_MINUTES_MS) return false;
        }
        if (!seen.has(key)) seen.set(key, ts);
        return true;
      });
      setEmails(deduped);
    } catch (err) {
      console.error("[Mail Tracker] Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  // When a quick date preset is chosen, clear custom date range
  const handleQuickDate = (preset: QuickDate) => {
    setQuickDate(preset);
    setDateFrom("");
    setDateTo("");
  };

  // When custom date range is used, clear quick preset
  const handleDateFrom = (val: string) => {
    setDateFrom(val);
    setQuickDate("all");
  };
  const handleDateTo = (val: string) => {
    setDateTo(val);
    setQuickDate("all");
  };

  const handleExportCSV = () => {
    if (emails.length === 0) return;
    const headers = ["ID", "Subject", "Recipient", "Sender", "Status", "Created At", "Opened At"];
    const rows = filteredEmails.map(e => [
      e.id,
      `"${e.subject.replace(/"/g, '""')}"`,
      e.recipient,
      e.sender,
      e.opened ? "Opened" : "Pending",
      e.createdAt,
      e.openedAt || ""
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mailtracker_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getQuickDateRange = (preset: QuickDate): { from: Date | null; to: Date | null } => {
    const now = new Date();
    if (preset === "today") {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    if (preset === "week") {
      const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    if (preset === "month") {
      const start = new Date(now); start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    return { from: null, to: null };
  };

  const filteredEmails = emails
    .filter(e => {
      // Search
      const matchesSearch =
        e.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.recipient.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (filterType === "opened" && !e.opened) return false;
      if (filterType === "pending" && e.opened) return false;

      // Date filter
      const sentDate = new Date(e.createdAt);
      if (quickDate !== "all") {
        const { from, to } = getQuickDateRange(quickDate);
        if (from && sentDate < from) return false;
        if (to && sentDate > to) return false;
      } else {
        if (dateFrom) {
          const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
          if (sentDate < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
          if (sentDate > to) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "recently_opened") {
        const aT = a.openedAt ? new Date(a.openedAt).getTime() : 0;
        const bT = b.openedAt ? new Date(b.openedAt).getTime() : 0;
        return bT - aT;
      }
      return 0;
    });

  // Derived stats — computed live from filteredEmails so cards react to filters
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7); startOfWeek.setHours(0, 0, 0, 0);

  const derivedTotal = filteredEmails.length;
  const derivedOpened = filteredEmails.filter(e => e.opened).length;
  const derivedPending = filteredEmails.filter(e => !e.opened).length;
  const derivedOpenRate = derivedTotal > 0 ? ((derivedOpened / derivedTotal) * 100).toFixed(1) : "0.0";
  const derivedOpenedToday = filteredEmails.filter(e => e.opened && e.openedAt && new Date(e.openedAt) >= startOfToday).length;
  const derivedOpenedThisWeek = filteredEmails.filter(e => e.opened && e.openedAt && new Date(e.openedAt) >= startOfWeek).length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const inputStyle = {
    padding: "9px 12px",
    border: "1px solid #2d3a4a",
    borderRadius: 10,
    fontSize: 13,
    color: "#cbd5e1",
    background: "#0b1120",
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.15s ease",
  };

  const selectStyle = {
    ...inputStyle,
    cursor: "pointer",
  };

  const quickBtnStyle = (active: boolean) => ({
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: active ? "1px solid #10b981" : "1px solid #2d3a4a",
    background: active ? "rgba(16,185,129,0.12)" : "#0b1120",
    color: active ? "#10b981" : "#64748b",
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1120",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#e2e8f0",
      padding: "40px 24px"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                width: 42, height: 42, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 22, fontWeight: 700,
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)"
              }}>
                T
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>Mail Tracker Analytics</h1>
            </div>
            <p style={{ color: "#94a3b8", margin: "6px 0 0 0", fontSize: 14 }}>Real-time privacy-focused email view statistics</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                background: "#1a2332", border: "1px solid #2d3a4a", color: "#cbd5e1",
                padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.15s ease"
              }}
            >
              <svg style={{ animation: loading ? "spin 1s linear infinite" : "none" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredEmails.length === 0}
              style={{
                background: "#10b981", border: "none", color: "#ffffff",
                padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.15s ease", opacity: filteredEmails.length === 0 ? 0.4 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Grid — derived live from filteredEmails */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 40 }}>
          <div style={{ background: "#1a2332", border: "1px solid #2d3a4a", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Tracked</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#e2e8f0", marginTop: 8 }}>{derivedTotal}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Matching current filters</div>
          </div>
          <div style={{ background: "#1a2332", border: "1px solid #2d3a4a", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opened</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#34d399", marginTop: 8 }}>{derivedOpened}</div>
            <div style={{ fontSize: 12, color: "#34d399", marginTop: 8 }}>{derivedOpenedToday} opened today</div>
          </div>
          <div style={{ background: "#1a2332", border: "1px solid #2d3a4a", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#cbd5e1", marginTop: 8 }}>{derivedPending}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Awaiting recipient view</div>
          </div>
          <div style={{ background: "#1a2332", border: "1px solid #2d3a4a", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Open Rate</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#818cf8", marginTop: 8 }}>{derivedOpenRate}%</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>{derivedOpenedThisWeek} opened this week</div>
          </div>
        </div>

        {/* Filters and List Section */}
        <div style={{ background: "#1a2332", border: "1px solid #2d3a4a", borderRadius: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)", overflow: "hidden" }}>

          {/* Row 1: Search + Status + Sort */}
          <div style={{ padding: "20px 24px 0 24px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <input
                type="text"
                placeholder="Search subject or recipient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%", padding: "10px 16px 10px 40px",
                  border: "1px solid #2d3a4a", borderRadius: 10, fontSize: 14,
                  boxSizing: "border-box", outline: "none",
                  background: "#0b1120", color: "#e2e8f0",
                  transition: "border-color 0.15s ease"
                }}
                onFocus={(e) => e.target.style.borderColor = "#10b981"}
                onBlur={(e) => e.target.style.borderColor = "#2d3a4a"}
              />
              <svg style={{ position: "absolute", left: 14, top: 12, color: "#64748b" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            {/* Status filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              style={selectStyle}
            >
              <option value="all">All Statuses</option>
              <option value="opened">Opened Only</option>
              <option value="pending">Pending Only</option>
            </select>

            {/* Sort by */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={selectStyle}
            >
              <option value="newest">↓ Newest First</option>
              <option value="oldest">↑ Oldest First</option>
              <option value="recently_opened">↓ Recently Opened</option>
            </select>
          </div>

          {/* Row 2: Quick date presets + custom date range + result count */}
          <div style={{ padding: "12px 24px 16px 24px", borderBottom: "1px solid #2d3a4a", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Quick presets */}
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginRight: 2 }}>DATE:</span>
              {([["all", "All Time"], ["today", "Today"], ["week", "This Week"], ["month", "This Month"]] as [QuickDate, string][]).map(([val, label]) => (
                <button key={val} onClick={() => handleQuickDate(val)} style={quickBtnStyle(quickDate === val && !dateFrom && !dateTo)}>
                  {label}
                </button>
              ))}

              {/* Divider */}
              <span style={{ color: "#2d3a4a", fontSize: 18, margin: "0 4px" }}>|</span>

              {/* Custom date range */}
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFrom(e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
                title="From date"
              />
              <span style={{ color: "#64748b", fontSize: 13 }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateTo(e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
                title="To date"
              />

              {/* Clear custom range */}
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setQuickDate("all"); }}
                  style={{
                    background: "transparent", border: "none", color: "#ef4444",
                    fontSize: 12, cursor: "pointer", padding: "4px 8px",
                    borderRadius: 6, fontWeight: 600
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>
              Showing {filteredEmails.length} of {emails.length} emails
            </div>
          </div>

          {/* Table */}
          {filteredEmails.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#0b1120", borderBottom: "1px solid #2d3a4a" }}>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Subject</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Recipient</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Sent Date</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Opened Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.map((email) => (
                    <tr
                      key={email.id}
                      style={{ borderBottom: "1px solid #2d3a4a", transition: "background 0.1s ease" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#1e2d3d"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "18px 24px", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{email.subject}</td>
                      <td style={{ padding: "18px 24px", fontSize: 14, color: "#cbd5e1" }}>{email.recipient}</td>
                      <td style={{ padding: "18px 24px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 30, fontSize: 12, fontWeight: 600,
                          background: email.opened ? "#064e3b" : "#374151",
                          color: email.opened ? "#6ee7b7" : "#9ca3af"
                        }}>
                          {email.opened ? (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ee7b7" }} />
                              Opened
                            </>
                          ) : (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af" }} />
                              Pending
                            </>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: "#94a3b8" }}>{formatDate(email.createdAt)}</td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: email.opened ? "#cbd5e1" : "#64748b" }}>
                        {email.openedAt ? formatDate(email.openedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "80px 24px", textAlign: "center", color: "#94a3b8" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#64748b", marginBottom: 16 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>No tracked emails found</h3>
              <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
                {searchTerm || filterType !== "all" || quickDate !== "all" || dateFrom || dateTo
                  ? "Try adjusting your search filters"
                  : "Send your first tracked email from Gmail!"}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        html, body { margin: 0; padding: 0; background: #0b1120; }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
