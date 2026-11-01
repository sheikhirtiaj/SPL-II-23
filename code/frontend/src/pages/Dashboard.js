import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../axios";
import { useAuth } from "../context/AuthContext";

function getReportsFromResponse(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  if (Array.isArray(responseData?.reports)) {
    return responseData.reports;
  }

  if (Array.isArray(responseData?.data?.reports)) {
    return responseData.data.reports;
  }

  return [];
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

function getStatusClass(status) {
  const normalized = String(status || "pending").toLowerCase();

  if (
    normalized.includes("resolved") ||
    normalized.includes("completed")
  ) {
    return "status-resolved";
  }

  if (normalized.includes("rejected")) {
    return "status-rejected";
  }

  if (
    normalized.includes("progress") ||
    normalized.includes("assigned") ||
    normalized.includes("investigating")
  ) {
    return "status-progress";
  }

  return "status-pending";
}

function getReportId(report) {
  return report.report_id ?? report.id ?? report._id;
}

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reports");
      const fetchedReports = getReportsFromResponse(response.data);

      setReports(fetchedReports);
    } catch (err) {
      console.error("Failed to fetch reports:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load reports. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const totalReports = reports.length;

  const resolvedReports = reports.filter((report) => {
    const status = String(report.status || "").toLowerCase();

    return status.includes("resolved") || status.includes("completed");
  }).length;

  const pendingReports = reports.filter((report) => {
    const status = String(report.status || "pending").toLowerCase();

    return (
      status.includes("pending") ||
      status.includes("submitted") ||
      status.includes("open")
    );
  }).length;

  const inProgressReports = reports.filter((report) => {
    const status = String(report.status || "").toLowerCase();

    return (
      status.includes("progress") ||
      status.includes("assigned") ||
      status.includes("investigating")
    );
  }).length;

  return (
    <main className="citizen-dashboard">
      <style>{`
        .citizen-dashboard {
          min-height: 100vh;
          padding: 32px 20px 48px;
          background: #f5f8f6;
          color: #18352b;
          font-family: Arial, sans-serif;
        }

        .dashboard-container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }

        .dashboard-header h1 {
          margin: 0 0 8px;
          font-size: clamp(26px, 4vw, 34px);
        }

        .dashboard-header p {
          margin: 0;
          color: #64756c;
          line-height: 1.5;
        }

        .dashboard-primary-button {
          display: inline-block;
          padding: 13px 19px;
          border-radius: 9px;
          background: #16804a;
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }

        .dashboard-primary-button:hover {
          background: #10683b;
        }

        .dashboard-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .dashboard-logout-button {
          display: inline-block;
          padding: 13px 19px;
          border-radius: 9px;
          background: #fff;
          color: #23543b;
          font-weight: 700;
          border: 1px solid #cbdacf;
          cursor: pointer;
        }

        .dashboard-logout-button:hover {
          background: #eef5f0;
        }

        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .status-rejected {
          color: #991b1b !important;
          background: #fee2e2 !important;
          border-color: #fecaca !important;
        }

        .dashboard-rejection-reason {
          margin-top: 12px;
          padding: 12px 14px;
          border-left: 4px solid #b91c1c;
          border-radius: 8px;
          background: #fff1f2;
          color: #7f1d1d;
          font-size: 13px;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .dashboard-rejection-reason strong {
          display: block;
          margin-bottom: 3px;
        }

        .dashboard-stat {
          padding: 22px;
          background: #fff;
          border: 1px solid #e2ebe5;
          border-radius: 12px;
          box-shadow: 0 3px 12px rgba(24, 53, 43, 0.04);
        }

        .dashboard-stat-label {
          margin-bottom: 12px;
          color: #65766c;
          font-size: 14px;
        }

        .dashboard-stat-number {
          font-size: 30px;
          font-weight: 700;
        }

        .dashboard-section {
          padding: 24px;
          background: #fff;
          border: 1px solid #e2ebe5;
          border-radius: 12px;
          box-shadow: 0 3px 12px rgba(24, 53, 43, 0.04);
        }

        .dashboard-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .dashboard-section-header h2 {
          margin: 0;
          font-size: 21px;
        }

        .dashboard-refresh {
          padding: 9px 13px;
          border: 1px solid #cbdacf;
          border-radius: 8px;
          background: #fff;
          color: #23543b;
          cursor: pointer;
          font-weight: 600;
        }

        .dashboard-report-list {
          display: grid;
          gap: 14px;
        }

        .dashboard-report {
          padding: 18px;
          border: 1px solid #e6ece8;
          border-radius: 10px;
        }

        .dashboard-report-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .dashboard-report h3 {
          margin: 0;
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .dashboard-report p {
          margin: 8px 0;
          color: #53665b;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .dashboard-report-meta {
          color: #78877e;
          font-size: 13px;
          margin-top: 7px;
          overflow-wrap: anywhere;
        }

        .dashboard-report-evidence {
          display: block;
          width: min(220px, 100%);
          max-height: 180px;
          object-fit: cover;
          margin-top: 12px;
          border: 1px solid #e2ebe5;
          border-radius: 9px;
          background: #f5f8f6;
        }

        .dashboard-status {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .status-pending {
          background: #fff2d7;
          color: #805500;
        }

        .status-progress {
          background: #e2efff;
          color: #1d5591;
        }

        .status-resolved {
          background: #dff5e7;
          color: #17663a;
        }

        .dashboard-message {
          padding: 18px;
          border-radius: 9px;
          background: #f5f8f6;
          color: #53665b;
          line-height: 1.5;
        }

        .dashboard-error {
          margin-bottom: 18px;
          padding: 14px;
          border-radius: 9px;
          background: #fff0ef;
          color: #9a2b25;
        }

        @media (max-width: 760px) {
          .dashboard-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-section {
            padding: 17px;
          }
        }

        @media (max-width: 420px) {
          .citizen-dashboard {
            padding: 24px 13px 36px;
          }

          .dashboard-stats {
            gap: 10px;
          }

          .dashboard-stat {
            padding: 16px;
          }

          .dashboard-stat-number {
            font-size: 25px;
          }

          .dashboard-primary-button {
            width: 100%;
            text-align: center;
            box-sizing: border-box;
          }
        }
      `}</style>

      <div className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <h1>
              Welcome
              {(user?.full_name || user?.name) ? `, ${user.full_name || user.name}` : ""}
            </h1>
            <p>
              Track dengue-related reports and help keep your community safe.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <Link to="/" className="dashboard-logout-button" style={{ textDecoration: "none" }}>Home</Link>
            <Link to="/report" className="dashboard-primary-button">
              + Report an Issue
            </Link>
            <button type="button" onClick={logout} className="dashboard-logout-button">
              Logout / Switch account
            </button>
          </div>
        </header>

        <section className="dashboard-stats" aria-label="Report statistics">
          <div className="dashboard-stat">
            <div className="dashboard-stat-label">Total Reports</div>
            <div className="dashboard-stat-number">{totalReports}</div>
          </div>

          <div className="dashboard-stat">
            <div className="dashboard-stat-label">Pending</div>
            <div className="dashboard-stat-number">{pendingReports}</div>
          </div>

          <div className="dashboard-stat">
            <div className="dashboard-stat-label">In Progress</div>
            <div className="dashboard-stat-number">{inProgressReports}</div>
          </div>

          <div className="dashboard-stat">
            <div className="dashboard-stat-label">Resolved</div>
            <div className="dashboard-stat-number">{resolvedReports}</div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>Recent Reports</h2>

            <button
              type="button"
              className="dashboard-refresh"
              onClick={fetchReports}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && (
            <div className="dashboard-error" role="alert">
              {error}
              <button
                type="button"
                className="dashboard-refresh"
                onClick={fetchReports}
                style={{ marginLeft: 12 }}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="dashboard-message">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="dashboard-message">
              No reports were found. If you have identified a possible dengue
              breeding site, submit a report so it can be addressed.
              <div style={{ marginTop: 15 }}>
                <Link
                  to="/report"
                  className="dashboard-primary-button"
                >
                  Submit Your First Report
                </Link>
              </div>
            </div>
          ) : (
            <div className="dashboard-report-list">
              {reports.map((report, index) => {
                const reportId = getReportId(report);
                const status = report.status || "Pending";
                const description =
                  report.description ||
                  report.issue_type ||
                  "No description provided.";

                return (
                  <article
                    className="dashboard-report"
                    key={reportId ?? index}
                  >
                    <div className="dashboard-report-top">
                      <h3>
                        Report #{reportId ?? index + 1}
                      </h3>

                      <span
                        className={`dashboard-status ${getStatusClass(status)}`}
                      >
                        {String(status).replace(/[_-]/g, " ")}
                      </span>
                    </div>

                    <p translate="no">{description}</p>

                    {String(status).toLowerCase() === "rejected" && (
                      <div className="dashboard-rejection-reason" role="note" aria-label="Reason for rejection">
                        <strong>Reason for rejection</strong>
                        {String(report.rejection_reason || report.councillor_note || "").trim() || "No rejection reason was recorded for this complaint."}
                      </div>
                    )}

                    <div className="dashboard-report-meta">
                      Submitted:{" "}
                      {formatDate(
                        report.created_at ||
                          report.createdAt ||
                          report.submitted_at
                      )}
                    </div>

                    <div className="dashboard-report-meta">
                      Ward: {report.ward_number != null
                        ? `${report.corporation_code ? `${report.corporation_code} · ` : ""}${report.ward_number}`
                        : report.ward_id != null ? `Ward ID ${report.ward_id}` : "Not assigned / outside mapped wards"}
                    </div>

                    {report.latitude != null && report.longitude != null && (
                      <div className="dashboard-report-meta">
                        Location: {report.latitude}, {report.longitude}
                      </div>
                    )}

                    {report.before_photo_url && (
                      <a href={report.before_photo_url} target="_blank" rel="noreferrer" aria-label={`Open original photo for report ${reportId}`}>
                        <img
                          className="dashboard-report-evidence"
                          src={report.before_photo_url}
                          alt={`Original evidence for report ${reportId}`}
                          loading="lazy"
                        />
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}