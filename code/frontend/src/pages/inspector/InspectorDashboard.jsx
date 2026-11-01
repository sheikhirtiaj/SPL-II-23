import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import '../ThemePages.css';

const formatDate = (dateValue) => {
  if (!dateValue) return 'Unknown';
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

const InspectorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports');
      const all = Array.isArray(res.data?.data) ? res.data.data : [];
      // Only show complaints assigned to this inspector
      const mine = all.filter(
        (r) => Number(r.assigned_inspector_id) === Number(user?.user_id)
          && (r.status === 'Assigned' || r.status === 'Pending Verification')
      );
      setReports(mine);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const activeCount = reports.filter((r) => r.status === 'Assigned').length;
  const pendingVerCount = reports.filter((r) => r.status === 'Pending Verification').length;

  return (
    <div className="da-dashboard-page da-dashboard-page--inspector">
      <Navbar theme="landing" />

      <main className="da-dashboard-main">
        <div className="da-dashboard-heading">
          <div>
            <div className="da-dashboard-eyebrow"><span /> FIELD RESPONSE</div>
            <h1 className="da-dashboard-title">My Tasks</h1>
            <p className="da-dashboard-subtitle">{activeCount > 0 ? `${activeCount} active task${activeCount > 1 ? 's' : ''} requiring action` : 'No active tasks right now'}</p>
          </div>
          <button type="button" onClick={fetchReports} disabled={loading} className="da-refresh-button">
            <span className={loading ? 'da-refresh-icon da-is-spinning' : 'da-refresh-icon'}>↻</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="da-summary-grid" aria-label="Task summary">
          <div className="da-summary-card da-summary-card--primary">
            <span className="da-summary-label">Assigned</span>
            <strong>{activeCount}</strong>
            <span className="da-summary-caption">Ready for action</span>
          </div>
          <div className="da-summary-card da-summary-card--soft">
            <span className="da-summary-label">Awaiting review</span>
            <strong>{pendingVerCount}</strong>
            <span className="da-summary-caption">Submitted for verification</span>
          </div>
          <div className="da-summary-card">
            <span className="da-summary-label">Total active tasks</span>
            <strong>{reports.length}</strong>
            <span className="da-summary-caption">Assigned to you</span>
          </div>
        </div>

        {error && (
          <div className="da-dashboard-alert" role="alert">
            <span><strong>Unable to load tasks.</strong> {error}</span>
            <button type="button" onClick={fetchReports}>Retry</button>
          </div>
        )}

        <section className="da-dashboard-section" aria-label="Assigned tasks">
          <div className="da-section-heading">
            <h2>Assigned complaints</h2>
            <span>{reports.length} {reports.length === 1 ? 'task' : 'tasks'}</span>
          </div>

          <div className="da-complaint-list">
            {loading && Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="da-inspector-skeleton" aria-hidden="true">
                <div className="da-skeleton-photo" />
                <div className="da-skeleton-copy"><div className="da-skeleton-line da-skeleton-line--short" /><div className="da-skeleton-line" /><div className="da-skeleton-line da-skeleton-line--medium" /></div>
              </div>
            ))}

            {!loading && reports.length === 0 && (
              <div className="da-empty-state">
                <span className="da-empty-icon" aria-hidden="true">✓</span>
                <h3>You're all caught up</h3>
                <p>No tasks are assigned to you right now. Check back later for new assignments.</p>
              </div>
            )}

            {!loading && reports.map((r) => (
              <button
                type="button"
                key={r.report_id}
                onClick={() => navigate(`/inspector/complaint/${r.report_id}`)}
                className="da-inspector-task-card"
              >
                <span className={`da-task-status-strip${r.status === 'Assigned' ? ' is-assigned' : ' is-review'}`} />
                <div className="da-inspector-task-body">
                  <div className="da-inspector-photo">
                    {r.before_photo_url ? <img src={r.before_photo_url} alt="Reported hazard" /> : <span aria-hidden="true">⌖</span>}
                  </div>
                  <div className="da-inspector-task-content">
                    <div className="da-complaint-meta">
                      <span className="da-complaint-id">#{r.report_id}</span>
                      <StatusBadge status={r.status} size="sm" theme="landing" />
                    </div>
                    {r.description && <p className="da-complaint-description da-description-wrap">{r.description}</p>}
                    <div className="da-complaint-details">
                      {(r.latitude && r.longitude) && <span>{parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</span>}
                      <span>◷ {formatDate(r.created_at)}</span>
                    </div>
                    {r.status === 'Assigned' && <p className="da-task-hint">→ Upload cleanup proof</p>}
                    {r.status === 'Pending Verification' && <p className="da-task-hint da-task-hint--review">Awaiting councillor review</p>}
                  </div>
                  <span className="da-complaint-chevron" aria-hidden="true">›</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default InspectorDashboard;
