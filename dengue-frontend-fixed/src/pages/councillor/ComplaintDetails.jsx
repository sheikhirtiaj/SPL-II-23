import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../axios';
import Navbar from '../../components/Navbar';
import '../ThemePages.css';
import '../ComplaintDetailTheme.css';
import StatusBadge from '../../components/StatusBadge';
import MapLocationView from '../../components/MapLocationView';
import BeforeAfterComparison from '../../components/BeforeAfterComparison';
import InspectorAssignmentCard from '../../components/InspectorAssignmentCard';
import ConfirmDialog from '../../components/ConfirmDialog';

const formatDate = (dateValue) => {
  if (!dateValue) return 'Unknown';
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

// Derive availability from complaints list:
// An inspector is BUSY if they have an 'Assigned' complaint they've clicked into
// but haven't submitted after-photo yet. We approximate this from backend data.
const computeAvailability = (inspectors, allReports) => {
  const busyIds = new Set(
    allReports
      .filter((r) => r.status === 'Assigned' && r.assigned_inspector_id)
      .map((r) => String(r.assigned_inspector_id))
  );
  return inspectors.map((ins) => ({
    ...ins,
    is_available: !busyIds.has(String(ins.user_id)),
  }));
};

const ComplaintDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [inspectors, setInspectors] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [selectedInspector, setSelectedInspector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Dialogs
  const [assignDialog, setAssignDialog] = useState(false);
  const [completeDialog, setCompleteDialog] = useState(false);
  const [reassignDialog, setReassignDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCategory, setRejectCategory] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, inspectorsRes, allReportsRes] = await Promise.allSettled([
        api.get(`/reports/${id}`),
        api.get(`/inspectors${user?.ward_id ? `?ward_id=${user.ward_id}` : ''}`),
        api.get('/reports'),
      ]);

      if (reportRes.status === 'fulfilled') {
        const data = reportRes.value.data?.data ?? reportRes.value.data;
        setReport(data);
      } else {
        setError('Failed to load complaint details');
      }

      const rawInspectors =
        inspectorsRes.status === 'fulfilled'
          ? Array.isArray(inspectorsRes.value.data?.data)
            ? inspectorsRes.value.data.data
            : Array.isArray(inspectorsRes.value.data)
            ? inspectorsRes.value.data
            : []
          : [];

      const rawReports =
        allReportsRes.status === 'fulfilled'
          ? Array.isArray(allReportsRes.value.data?.data)
            ? allReportsRes.value.data.data
            : []
          : [];

      setAllReports(rawReports);
      setInspectors(computeAvailability(rawInspectors, rawReports));
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.ward_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Actions ---
  const handleAssign = async () => {
    if (!selectedInspector) return;
    setAssignDialog(false);
    setActionLoading(true);
    try {
      await api.patch(`/reports/${id}/assign`, {
        inspector_id: Number(selectedInspector.user_id),
      });
      showToast(` Assigned to ${selectedInspector.full_name}`);
      await fetchAll();
      setSelectedInspector(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Assignment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (isApproved) => {
    setCompleteDialog(false);
    setReassignDialog(false);
    setActionLoading(true);
    try {
      await api.patch(`/reports/${id}/verify`, { is_approved: isApproved });
      showToast(isApproved ? '✅ Complaint marked as Completed' : '🔄 Complaint sent back for reassignment');
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectCategory || (rejectCategory === 'Other' && !rejectReason.trim())) {
      setError('Select a rejection reason. For Other, provide a short explanation.');
      return;
    }
    const rejectionNote = rejectCategory === 'Other' ? `Other: ${rejectReason.trim()}` : rejectReason.trim() ? `${rejectCategory}: ${rejectReason.trim()}` : rejectCategory;
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/reports/${id}/reject`, { reason: rejectionNote });
      setRejectDialog(false);
      setRejectCategory('');
      setRejectReason('');
      navigate('/councillor', { replace: true });
    } catch (err) {
      setRejectDialog(false);
      setError(err.response?.data?.message || 'Could not reject this complaint.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- Render states ---
  if (loading) {
    return (
      <div className="da-dashboard-page da-detail-page">
        <Navbar theme="landing" />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-48 bg-gray-200 rounded-2xl" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="da-dashboard-page da-detail-page">
        <Navbar theme="landing" />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
          <div className="text-5xl mb-3"></div>
          <p className="font-medium">Complaint not found</p>
          <button onClick={() => navigate('/councillor')} className="mt-4 text-emerald-700 underline text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isVerificationMode = report.status === 'Pending Verification';
  const isAssignmentMode = report.status === 'Pending' || report.status === 'Re-assigned';

  return (
    <div className="da-dashboard-page da-detail-page">
      <Navbar theme="landing" />

      {/* Toast */}
      {toast && (
        <div className="da-detail-toast fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      <main className="da-detail-main max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Back + header */}
        <div className="da-detail-heading flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/councillor')}
            className="da-detail-back w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm"
          >
            ‹
          </button>
          <div>
            <p className="da-detail-eyebrow">WARD MANAGEMENT</p>
            <div className="flex items-center gap-2">
              <h1 className="da-detail-title text-lg font-bold text-gray-900">Complaint #{report.report_id}</h1>
              <StatusBadge status={report.status} size="sm" theme="landing" />
            </div>
            <p className="da-detail-date text-xs text-gray-500">Submitted {formatDate(report.created_at)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ─── SECTION 1: Complaint Evidence ─── */}
        <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Citizen Report
          </h2>

          {/* Before photo or before/after comparison */}
          {isVerificationMode && report.after_photo_url ? (
            <div className="mb-4">
              <BeforeAfterComparison
                beforeUrl={report.before_photo_url}
                afterUrl={report.after_photo_url}
              />
            </div>
          ) : (
            report.before_photo_url && (
              <div className="rounded-xl overflow-hidden mb-4 border border-gray-200">
                <img
                  src={report.before_photo_url}
                  alt="Hazard photo"
                  className="w-full max-h-72 object-cover"
                />
              </div>
            )
          )}

          {/* Description */}
          {report.description ? (
            <div className="da-detail-description-box mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Description</p>
              <p className="text-sm text-gray-800" translate="no">{report.description}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mb-4">No description provided</p>
          )}

          {/* Location */}
          <MapLocationView
            latitude={report.latitude}
            longitude={report.longitude}
            locationText={report.location_text}
          />


          {/* Citizen GPS vs Inspector Cleanup GPS */}
          {report.inspector_comment && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <strong className="block text-sm text-emerald-900 mb-1">Inspector comment</strong>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.inspector_comment}</p>
            </div>
          )}
          {report.cleanup_latitude != null &&
            report.cleanup_longitude != null && (
              <div className="da-detail-gps mt-4 rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">

                <div className="px-4 py-3 border-b border-emerald-200">
                  <h3 className="text-sm font-bold text-emerald-900">
                     Cleanup Location Verification
                  </h3>

                  <p className="text-xs text-emerald-800 mt-1">
                    Compare the original complaint location with the
                    Inspector's cleanup location.
                  </p>
                </div>

                <div className="p-4 space-y-3">

                  {/* Citizen GPS */}
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                           Citizen Report GPS
                        </p>

                        <p className="text-sm font-medium text-gray-800 mt-1">
                          {Number(report.latitude).toFixed(6)},{' '}
                          {Number(report.longitude).toFixed(6)}
                        </p>
                      </div>

                      <a
                        href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="da-detail-map-link text-xs text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
                      >
                        Open ↗
                      </a>

                    </div>
                  </div>

                  {/* Inspector GPS */}
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                           Inspector Cleanup GPS
                        </p>

                        <p className="text-sm font-medium text-gray-800 mt-1">
                          {Number(report.cleanup_latitude).toFixed(6)},{' '}
                          {Number(report.cleanup_longitude).toFixed(6)}
                        </p>

                        {report.cleanup_submitted_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            Captured:{' '}
                            {formatDate(report.cleanup_submitted_at)}
                          </p>
                        )}
                      </div>

                      <a
                        href={`https://www.google.com/maps?q=${report.cleanup_latitude},${report.cleanup_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="da-detail-map-link text-xs text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
                      >
                        Open ↗
                      </a>

                    </div>
                  </div>

                  {/* Distance */}
                  {report.cleanup_distance_meters != null && Number(report.cleanup_distance_meters) > 1000 && (
                    <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                      <p className="text-sm font-bold">Location mismatch concern</p>
                      <p className="text-xs mt-1">The cleanup GPS is more than 1 km from the original report location. Review the evidence before approving.</p>
                    </div>
                  )}
                  {report.cleanup_distance_meters != null && (
                    <div className={`bg-white rounded-lg border p-4 text-center ${Number(report.cleanup_distance_meters) > 1000 ? 'border-amber-300' : 'border-emerald-200'}`}>

                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Straight-line distance
                      </p>

                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {Number(report.cleanup_distance_meters) < 1000
                          ? `${Number(
                              report.cleanup_distance_meters
                            ).toFixed(1)} m`
                          : `${(
                              Number(report.cleanup_distance_meters) /
                              1000
                            ).toFixed(2)} km`}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Between complaint GPS and cleanup GPS
                      </p>

                    </div>
                  )}

                </div>
              </div>
            )}

          {/* Meta info */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Ward {report.ward_id || '—'}</span>
            {report.assigned_inspector_name && (
              <span>Inspector: <span className="font-medium text-gray-700">{report.assigned_inspector_name}</span></span>
            )}
          </div>
        </section>

        {/* ─── SECTION 2: Inspector Assignment (Pending / Re-assigned) ─── */}
        {isAssignmentMode && (
          <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
              Assign Inspector
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              {report.status === 'Re-assigned'
                ? 'Previous cleanup was rejected. Select a new inspector or reassign.'
                : 'Select an available inspector from your ward.'}
            </p>

            {inspectors.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <div className="text-4xl mb-2">👷</div>
                <p className="text-sm">No inspector data available.</p>
                <p className="text-xs mt-1">Check that the /inspectors API endpoint is active.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {inspectors.map((ins) => (
                  <InspectorAssignmentCard
                    key={ins.user_id}
                    inspector={ins}
                    isSelected={selectedInspector?.user_id === ins.user_id}
                    onSelect={setSelectedInspector}
                  />
                ))}
              </div>
            )}

            <button
              onClick={() => selectedInspector && setAssignDialog(true)}
              disabled={!selectedInspector || actionLoading}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all
                ${selectedInspector && !actionLoading
                  ? 'da-detail-primary-button text-white shadow-md active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              {actionLoading ? 'Assigning…' : selectedInspector
                ? `Assign ${selectedInspector.full_name}`
                : 'Select an inspector above'}
            </button>

            {/* New: reject an invalid complaint before it is assigned. */}
            <button
              type="button"
              onClick={() => setRejectDialog(true)}
              disabled={actionLoading}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-sm border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              Reject Complaint
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Use only for invalid or unnecessary complaints. This removes it from your active list; the citizen sees Rejected.
            </p>
          </section>
        )}

        {/* ─── SECTION 3: Verification Actions (Pending Verification) ─── */}
        {isVerificationMode && (
          <section className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <h2 className="da-detail-card-title text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
              Verification Decision
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Review the before and after photos above, then approve or reject the cleanup.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setCompleteDialog(true)}
                disabled={actionLoading}
                className="da-detail-primary-button w-full py-3.5 rounded-xl font-bold text-white shadow-md active:scale-95 transition-all text-sm"
              >
                ✅ Mark as Completed
              </button>
              <button
                onClick={() => setReassignDialog(true)}
                disabled={actionLoading}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md active:scale-95 transition-all text-sm"
              >
                🔄 Reassign (Cleanup Not Satisfactory)
              </button>
            </div>
          </section>
        )}

        {/* Readonly status for other statuses */}
        {!isAssignmentMode && !isVerificationMode && (
          <div className="da-detail-card bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center text-gray-500 text-sm">
            <StatusBadge status={report.status} theme="landing" />
            <p className="mt-2">This complaint is {report.status === 'Resolved' ? 'completed' : 'in progress'}. No further action needed.</p>
          </div>
        )}
      </main>

      {/* Confirm: reject citizen complaint (distinct from cleanup reassignment) */}
      <ConfirmDialog
        isOpen={rejectDialog}
        title="Reject this complaint?"
        message="This will remove the complaint from your dashboard and show Rejected to the citizen. This action cannot be undone here."
        confirmLabel={actionLoading ? 'Rejecting…' : 'Yes, Reject Complaint'}
        confirmClass="bg-red-700 hover:bg-red-800"
        onConfirm={handleReject}
        onCancel={() => { if (!actionLoading) setRejectDialog(false); }}
      >
        <label htmlFor="reject-category" className="block text-xs font-semibold text-gray-700 mb-1">
          Rejection reason <span className="text-red-600">*</span>
        </label>
        <select
          id="reject-category"
          value={rejectCategory}
          onChange={(event) => setRejectCategory(event.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 p-2 text-sm mb-3"
        >
          <option value="">Select a reason</option>
          <option value="Duplicate">Duplicate report</option>
          <option value="Fake">Fake or misleading report</option>
          <option value="Vague">Insufficient or vague information</option>
          <option value="Not a breeding site">Not a mosquito breeding site</option>
          <option value="Outside ward">Outside this ward</option>
          <option value="Other">Other</option>
        </select>
        <label htmlFor="reject-reason" className="block text-xs font-semibold text-gray-700 mb-1">
          Additional explanation {rejectCategory === 'Other' ? <span className="text-red-600">*</span> : '(optional)'}
        </label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          maxLength={500}
          rows={2}
          required={rejectCategory === 'Other'}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm"
          placeholder="Add details if needed"
        />
      </ConfirmDialog>

      {/* Confirm: Assign */}
      <ConfirmDialog
        isOpen={assignDialog}
        title="Confirm Assignment"
        message={`Are you sure you want to assign this complaint to ${selectedInspector?.full_name}? They will be notified immediately.`}
        confirmLabel="Yes, Assign"
        confirmClass="da-detail-primary-button"
        onConfirm={handleAssign}
        onCancel={() => setAssignDialog(false)}
      />

      {/* Confirm: Complete */}
      <ConfirmDialog
        isOpen={completeDialog}
        title="Mark as Completed?"
        message="This will close the complaint and mark the cleanup as successful. This action cannot be undone."
        confirmLabel="Yes, Complete"
        confirmClass="da-detail-primary-button"
        onConfirm={() => handleVerify(true)}
        onCancel={() => setCompleteDialog(false)}
      />

      {/* Confirm: Reassign */}
      <ConfirmDialog
        isOpen={reassignDialog}
        title="Reject & Reassign?"
        message="The cleanup will be marked as unsatisfactory and the complaint will be sent back for reassignment to another inspector."
        confirmLabel="Yes, Reassign"
        confirmClass="bg-amber-600 hover:bg-amber-700"
        onConfirm={() => handleVerify(false)}
        onCancel={() => setReassignDialog(false)}
      />
    </div>
  );
};

export default ComplaintDetails;
