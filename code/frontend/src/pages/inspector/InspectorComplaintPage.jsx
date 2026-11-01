import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import '../ThemePages.css';
import '../ComplaintDetailTheme.css';
import StatusBadge from '../../components/StatusBadge';
import MapLocationView from '../../components/MapLocationView';
import CleanupUpload from '../../components/CleanupUpload';

const formatDate = (dateValue) => {
  if (!dateValue) return 'Unknown';
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};



const InspectorComplaintPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reports/${id}`);
      const data = res.data?.data ?? res.data;
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load complaint');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Guard: inspector can only view their own assigned complaints
  const isOwner = report
    ? Number(report.assigned_inspector_id) === Number(user?.user_id)
    : true;

  const handleCleanupSubmit = async ({ file, latitude, longitude, comment }) => {
    setUploadLoading(true);
    setError('');

    try {
      if (!file) {
        setError('Cleanup photo is required.');
        return;
      }

      if (latitude == null || longitude == null) {
        setError('GPS location is required. Please wait for location capture and try again.');
        return;
      }

      const formData = new FormData();

      formData.append('after_photo', file);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      if (comment) formData.append('inspector_comment', comment);

      await api.patch(`/reports/${id}`, formData);

      showToast(' Cleanup evidence submitted! Awaiting councillor review.');

      await fetchReport();

    } catch (err) {
      console.error('Cleanup upload error:', err);

      setError(
        err.response?.data?.message ||
        'Upload failed. Please try again.'
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="da-dashboard-page da-detail-page">
        <Navbar theme="landing" />
        <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-56 bg-gray-200 rounded-2xl" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-36 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!report || !isOwner) {
    return (
      <div className="da-dashboard-page da-detail-page">
        <Navbar theme="landing" />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
          <div className="text-5xl mb-3">🚫</div>
          <p className="font-medium">{!report ? 'Complaint not found' : 'Access denied'}</p>
          <button onClick={() => navigate('/inspector')} className="mt-4 text-emerald-700 underline text-sm">
            Back to My Tasks
          </button>
        </div>
      </div>
    );
  }

  const canUpload = report.status === 'Assigned';
  const isPendingVerification = report.status === 'Pending Verification';

  return (
    <div className="da-dashboard-page da-detail-page">
      <Navbar theme="landing" />

      {/* Toast */}
      {toast && (
        <div className="da-detail-toast fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl animate-bounce-in">
          {toast}
        </div>
      )}

      <main className="da-detail-main max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Back + header */}
        <div className="da-detail-heading flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/inspector')}
            className="da-detail-back w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
          >
            ‹
          </button>
          <div>
            <p className="da-detail-eyebrow">FIELD RESPONSE</p>
            <div className="flex items-center gap-2">
              <h1 className="da-detail-title text-lg font-bold text-gray-900">Task #{report.report_id}</h1>
              <StatusBadge status={report.status} size="sm" theme="landing" />
            </div>
            <p className="da-detail-date text-xs text-gray-500">Assigned {formatDate(report.updated_at || report.created_at)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ─── SECTION 1: Original Complaint ─── */}
        <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Citizen Report
          </h2>

          {/* Before photo */}
          {report.before_photo_url && (
            <div className="rounded-xl overflow-hidden mb-4 border border-gray-200">
              <img
                src={report.before_photo_url}
                alt="Hazard before cleanup"
                className="w-full max-h-72 object-cover"
              />
              <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100">
                <p className="text-xs text-emerald-800 font-medium"> Before-cleanup photo submitted by citizen</p>
              </div>
            </div>
          )}

          {/* Description */}
          {report.description ? (
            <div className="da-detail-description-box mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Citizen Description</p>
              <p className="text-sm text-gray-800" translate="no">{report.description}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mb-4">No description provided by citizen</p>
          )}

          {/* Location */}
          <MapLocationView
            latitude={report.latitude}
            longitude={report.longitude}
            locationText={report.location_text}
          />
        </section>

        {/* ─── SECTION 2: Cleanup Upload ─── */}
        {canUpload && (
          <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
              Submit Cleanup Evidence
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              After completing the cleanup, take a photo of the cleared area and submit it below.
              Your GPS location will be automatically recorded.
            </p>
            <CleanupUpload onSubmit={handleCleanupSubmit} loading={uploadLoading} />
          </section>
        )}

        {/* ─── SECTION 2 (alt): Awaiting Verification ─── */}
        {isPendingVerification && (
          <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Cleanup Evidence Submitted
            </h2>

            {report.inspector_comment && <p className="text-sm text-gray-700 whitespace-pre-wrap"><strong>Your cleanup comment:</strong> {report.inspector_comment}</p>}
          {report.after_photo_url && (
              <div className="rounded-xl overflow-hidden mb-4 border border-green-200">
                <img
                  src={report.after_photo_url}
                  alt="After cleanup"
                  className="w-full max-h-72 object-cover"
                />
                <div className="px-3 py-1.5 bg-green-50 border-t border-green-100">
                  <p className="text-xs text-green-600 font-medium">✅ After-cleanup photo you submitted</p>
                </div>
              </div>
            )}

            {/* Waiting state */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-10 h-10 flex-shrink-0 bg-emerald-100 rounded-full flex items-center justify-center text-xl">
                ⏳
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Awaiting Councillor Verification</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Your cleanup evidence has been submitted. Your councillor will review and either approve or reassign this task.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default InspectorComplaintPage;
