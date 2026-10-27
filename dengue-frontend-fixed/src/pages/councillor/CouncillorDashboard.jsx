import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import '../ThemePages.css';

const FILTERS = ['All', 'Pending', 'Assigned', 'Pending Verification', 'Resolved'];

const formatDate = (dateValue) => {
  if (!dateValue) return 'Unknown';
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

const CouncillorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationQuery = useLocation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Parse filter from query string (e.g. from notification bell)
  useEffect(() => {
    const params = new URLSearchParams(locationQuery.search);
    const f = params.get('filter');
    if (f && FILTERS.includes(f)) setActiveFilter(f);
  }, [locationQuery.search]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/councillor');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setReports(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const pendingVerificationCount = reports.filter((r) => r.status === 'Pending Verification').length;
  const distanceConcerns = reports.filter((r) => r.cleanup_distance_meters != null && Number(r.cleanup_distance_meters) > 1000);
  const filtered = activeFilter === 'All' ? reports : reports.filter((r) => r.status === activeFilter);
  const filterCount = (f) => f === 'All' ? reports.length : reports.filter((r) => r.status === f).length;

  return (
    <div className="da-dashboard-page da-dashboard-page--councillor">
      <Navbar pendingVerificationCount={pendingVerificationCount} theme="landing" />

      <main className="da-dashboard-main">
        <div className="da-dashboard-heading">
          <div>
            <div className="da-dashboard-eyebrow"><span /> WARD MANAGEMENT</div>
            <h1 className="da-dashboard-title">Complaints Dashboard</h1>
            <p className="da-dashboard-subtitle">Ward {user?.ward_id || '—'} <span>·</span> {reports.length} total complaint{reports.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={fetchReports} disabled={loading} className="da-refresh-button">
            <span className={loading ? 'da-refresh-icon da-is-spinning' : 'da-refresh-icon'}>↻</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="da-dashboard-alert" role="alert">
            <span><strong>Unable to load complaints.</strong> {error}</span>
            <button type="button" onClick={fetchReports}>Retry</button>
          </div>
        )}

        {distanceConcerns.length > 0 && (
          <div className="da-dashboard-alert" role="status">
            <span><strong>Location concern:</strong> {distanceConcerns.length} cleanup submission(s) are over 1 km from the original report location. Review the affected complaints before approval.</span>
          </div>
        )}

        <section className="da-dashboard-section" aria-label="Filter complaints by status">
          <div className="da-section-heading">
            <h2>All reports</h2>
            <span>{filtered.length} shown</span>
          </div>
          <div className="da-filter-row">
            {FILTERS.map((f) => {
              const count = filterCount(f);
              const isActive = activeFilter === f;
              const isPV = f === 'Pending Verification';
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`da-filter-chip${isActive ? ' is-active' : ''}`}
                >
                  <span>{f === 'Pending' ? 'Unassigned' : f === 'Resolved' ? 'Completed' : f}</span>
                  <span className={`da-filter-count${isActive ? ' is-active' : isPV && count > 0 ? ' is-attention' : ''}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="da-complaint-list">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="da-complaint-skeleton" aria-hidden="true">
              <div className="da-skeleton-line da-skeleton-line--short" />
              <div className="da-skeleton-line" />
              <div className="da-skeleton-line da-skeleton-line--medium" />
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="da-empty-state">
              <span className="da-empty-icon" aria-hidden="true">▤</span>
              <h3>No complaints found</h3>
              <p>{activeFilter === 'All' ? 'No complaints have been submitted yet.' : `No complaints with status "${activeFilter === 'Pending' ? 'Unassigned' : activeFilter}".`}</p>
            </div>
          )}

          {!loading && filtered.map((r) => (
            <button
              type="button"
              key={r.report_id}
              onClick={() => navigate(`/councillor/complaint/${r.report_id}`)}
              className="da-complaint-card"
            >
              <div className="da-complaint-card-main">
                <div className="da-complaint-content">
                  <div className="da-complaint-meta">
                    <span className="da-complaint-id">#{r.report_id}</span>
                    <StatusBadge status={r.status} size="sm" theme="landing" />
                    {r.status === 'Pending Verification' && <span className="da-action-needed">Action needed</span>}
                    {r.cleanup_distance_meters != null && Number(r.cleanup_distance_meters) > 1000 && <span className="da-distance-alert">Location concern: {(Number(r.cleanup_distance_meters) / 1000).toFixed(2)} km</span>}
                  </div>
                  {r.description && <p className="da-complaint-description">{r.description}</p>}
                  <div className="da-complaint-details">
                    {(r.latitude && r.longitude) && <span>{parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</span>}
                    <span>◷ {formatDate(r.created_at)}</span>
                    {r.assigned_inspector_name && <span className="da-assigned-inspector">{r.assigned_inspector_name}</span>}
                  </div>
                </div>
                {r.before_photo_url && (
                  <div className="da-complaint-thumbnail"><img src={r.before_photo_url} alt="Complaint location" /></div>
                )}
                <span className="da-complaint-chevron" aria-hidden="true">›</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CouncillorDashboard;
