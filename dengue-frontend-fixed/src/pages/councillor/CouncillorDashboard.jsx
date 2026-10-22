import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';

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

      const data = Array.isArray(res.data?.data)
        ? res.data.data
        : [];

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

  const filtered = activeFilter === 'All'
    ? reports
    : reports.filter((r) => r.status === activeFilter);

  const filterCount = (f) => f === 'All'
    ? reports.length
    : reports.filter((r) => r.status === f).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar pendingVerificationCount={pendingVerificationCount} />

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Complaints Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ward {user?.ward_id || '—'} · {reports.length} total complaint{reports.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={fetchReports} className="text-red-600 font-medium underline text-xs">Retry</button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {FILTERS.map((f) => {
            const count = filterCount(f);
            const isActive = activeFilter === f;
            const isPV = f === 'Pending Verification';
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                  ${isActive
                    ? 'bg-red-600 text-white border-red-600 shadow'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                  }`}
              >
                {f === 'Pending' ? 'New' : f === 'Resolved' ? 'Completed' : f}
                {' '}
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-xs
                    ${isActive
                      ? 'bg-white bg-opacity-30 text-white'
                      : isPV && count > 0
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Complaint list */}
        <div className="flex flex-col gap-3">
          {loading && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">📋</div>
              <p className="font-medium">No complaints found</p>
              <p className="text-sm mt-1">
                {activeFilter === 'All'
                  ? 'No complaints have been submitted yet.'
                  : `No complaints with status "${activeFilter === 'Pending' ? 'New' : activeFilter}".`}
              </p>
            </div>
          )}

          {!loading && filtered.map((r) => (
            <button
              key={r.report_id}
              onClick={() => navigate(`/councillor/complaint/${r.report_id}`)}
              className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-red-200 transition-all active:scale-99"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-400">#{r.report_id}</span>
                    <StatusBadge status={r.status} size="sm" />
                    {r.status === 'Pending Verification' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                        Action needed
                      </span>
                    )}
                  </div>

                  {r.description && (
                    <p className="text-sm text-gray-800 font-medium truncate mb-1">{r.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {(r.latitude && r.longitude) && (
                      <span> {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</span>
                    )}
                    <span>🕒 {formatDate(r.created_at)}</span>
                    {r.assigned_inspector_name && (
                      <span className="text-blue-600"> {r.assigned_inspector_name}</span>
                    )}
                  </div>
                </div>

                {/* Before thumbnail */}
                {r.before_photo_url && (
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200">
                    <img src={r.before_photo_url} alt="Before" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Chevron */}
                <div className="flex-shrink-0 text-gray-300 self-center">›</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CouncillorDashboard;
