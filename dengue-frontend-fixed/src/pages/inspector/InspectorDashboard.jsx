import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';

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
        (r) =>
          Number(r.assigned_inspector_id) === Number(user?.user_id) &&
          (r.status === 'Assigned' || r.status === 'Pending Verification')
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount > 0
              ? `${activeCount} active task${activeCount > 1 ? 's' : ''} requiring action`
              : 'No active tasks right now'}
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-bold text-blue-700">{activeCount}</p>
            <p className="text-xs text-blue-600">Assigned</p>
          </div>
          <div className="flex-1 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-bold text-purple-700">{pendingVerCount}</p>
            <p className="text-xs text-purple-600">Awaiting Review</p>
          </div>
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-bold text-gray-700">{reports.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={fetchReports} className="text-red-600 font-medium underline text-xs">Retry</button>
          </div>
        )}

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

        {/* Task list */}
        <div className="flex flex-col gap-3">
          {loading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3"></div>
              <p className="font-medium text-gray-600">No tasks assigned to you</p>
              <p className="text-sm mt-1">Check back later — your councillor will assign complaints here.</p>
            </div>
          )}

          {!loading && reports.map((r) => (
            <button
              key={r.report_id}
              onClick={() => navigate(`/inspector/complaint/${r.report_id}`)}
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all active:scale-99 overflow-hidden"
            >
              {/* Status strip at top */}
              <div
                className={`h-1 w-full ${r.status === 'Assigned' ? 'bg-blue-500' : 'bg-purple-500'}`}
              />

              <div className="p-4 flex gap-3">
                {/* Before photo thumbnail */}
                <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                  {r.before_photo_url ? (
                    <img src={r.before_photo_url} alt="Hazard" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🦟</div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-gray-400">#{r.report_id}</span>
                    <StatusBadge status={r.status} size="sm" />
                  </div>

                  {r.description && (
                    <p className="text-sm text-gray-800 font-medium line-clamp-2 mb-1">{r.description}</p>
                  )}

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    {(r.latitude && r.longitude) && (
                      <span> {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</span>
                    )}
                    <span>🕒 {formatDate(r.created_at)}</span>
                  </div>

                  {r.status === 'Assigned' && (
                    <p className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded-full">
                      → Tap to upload cleanup proof
                    </p>
                  )}
                  {r.status === 'Pending Verification' && (
                    <p className="mt-2 text-xs font-semibold text-purple-600 bg-purple-50 inline-block px-2 py-0.5 rounded-full">
                      ⏳ Awaiting councillor review
                    </p>
                  )}
                </div>

                <div className="text-gray-300 self-center flex-shrink-0">›</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default InspectorDashboard;
