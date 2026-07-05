import { useState, useEffect } from "react";
import { fetchStats, fetchRecentStatuses, type EmailStatus, type DashboardStats } from "../lib/api";

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [emails, setEmails] = useState<EmailStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "opened" | "pending">("all");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([fetchStats(), fetchRecentStatuses()]);
      setStats(s);
      setEmails(list);
    } catch (err) {
      console.error("[Mail Tracker] Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh stats every 15 seconds while dashboard is open
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = () => {
    if (emails.length === 0) return;
    const headers = ["ID", "Subject", "Recipient", "Sender", "Status", "Created At", "Opened At"];
    const rows = emails.map(e => [
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

  const filteredEmails = emails.filter(e => {
    const matchesSearch = 
      e.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.recipient.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === "opened") return matchesSearch && e.opened;
    if (filterType === "pending") return matchesSearch && !e.opened;
    return matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#0f172a",
      padding: "40px 24px"
    }}>
      {/* Google Font Embed */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)"
              }}>
                T
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>Mail Tracker Analytics</h1>
            </div>
            <p style={{ color: "#64748b", margin: "6px 0 0 0", fontSize: 14 }}>Real-time privacy-focused email view statistics</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#475569",
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease"
              }}
            >
              <svg style={{ animation: loading ? "spin 1s linear infinite" : "none" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={emails.length === 0}
              style={{
                background: "#0f172a",
                border: "none",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease",
                opacity: emails.length === 0 ? 0.6 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 40 }}>
          {/* Card: Total */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Tracked</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#0f172a", marginTop: 8 }}>{stats ? stats.total : 0}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>All registered emails</div>
          </div>
          {/* Card: Opened */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opened</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#10b981", marginTop: 8 }}>{stats ? stats.opened : 0}</div>
            <div style={{ fontSize: 12, color: "#10b981", marginTop: 8 }}>
              {stats ? stats.openedToday : 0} opened today
            </div>
          </div>
          {/* Card: Pending */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#475569", marginTop: 8 }}>{stats ? stats.pending : 0}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Awaiting recipient view</div>
          </div>
          {/* Card: Open Rate */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Open Rate</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#6366f1", marginTop: 8 }}>{stats ? stats.openRate : 0}%</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              {stats ? stats.openedThisWeek : 0} opened this week
            </div>
          </div>
        </div>

        {/* Filters and List Section */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {/* Controls Bar */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 280 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search subject or recipient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 16px 10px 40px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    fontSize: 14,
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border-color 0.15s ease"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                />
                <svg style={{ position: "absolute", left: 14, top: 12, color: "#94a3b8" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#475569",
                  background: "#ffffff",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="all">All Statuses</option>
                <option value="opened">Opened Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
              Showing {filteredEmails.length} of {emails.length} emails
            </div>
          </div>

          {/* Table */}
          {filteredEmails.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Subject</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Recipient</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Sent Date</th>
                    <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Opened Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.map((email) => (
                    <tr key={email.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.1s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "18px 24px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{email.subject}</td>
                      <td style={{ padding: "18px 24px", fontSize: 14, color: "#475569" }}>{email.recipient}</td>
                      <td style={{ padding: "18px 24px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 30,
                          fontSize: 12,
                          fontWeight: 600,
                          background: email.opened ? "#e6f4ea" : "#f1f3f4",
                          color: email.opened ? "#137333" : "#5f6368"
                        }}>
                          {email.opened ? (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#137333" }} />
                              Opened
                            </>
                          ) : (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5f6368" }} />
                              Pending
                            </>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: "#64748b" }}>{formatDate(email.createdAt)}</td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: email.opened ? "#475569" : "#94a3b8" }}>
                        {email.openedAt ? formatDate(email.openedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "80px 24px", textAlign: "center", color: "#64748b" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style={{ color: "#94a3b8", marginBottom: 16 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#334155" }}>No tracked emails found</h3>
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
                {searchTerm || filterType !== "all" ? "Try adjusting your search filters" : "Send your first tracked email from Gmail!"}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
