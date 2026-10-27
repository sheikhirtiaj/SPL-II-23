import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../axios";
import PasswordVisibilityToggle from "../../components/PasswordVisibilityToggle";
import { useAuth } from "../../context/AuthContext";
import "./MasterAdminDashboard.css";

const emptyStaffForm = {
  full_name: "",
  email: "",
  role: "Inspector",
  password: "",
  confirmPassword: "",
  ward_id: "",
};

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com'];
const completeEmail = (value) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed && !trimmed.includes('@') ? `${trimmed}@gmail.com` : trimmed;
};
const passwordScore = (password) => [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
const strongPassword = (password) => password.length >= 8 && password.length <= 128 && [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length >= 3;

function getRows(response) {
  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function statusClass(status) {
  const value = String(status || "Pending").toLowerCase();
  if (value.includes("resolved")) return "ma-status ma-status-resolved";
  if (value.includes("assigned") || value.includes("verification")) return "ma-status ma-status-progress";
  return "ma-status ma-status-pending";
}

export default function MasterAdminDashboard() {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [staff, setStaff] = useState({ councillors: [], inspectors: [] });
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffError, setStaffError] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);
  const [deactivatingStaffId, setDeactivatingStaffId] = useState(null);
  const [wardQuery, setWardQuery] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showStaffConfirmPassword, setShowStaffConfirmPassword] = useState(false);
  const [alertBusyId, setAlertBusyId] = useState(null);
  const [alertMessage, setAlertMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setPageError("");
    const results = await Promise.allSettled([
      api.get("/reports"),
      api.get("/reports/councillor"),
      api.get("/users/staff"),
      api.get("/hotspots"),
    ]);

    const errors = [];
    let allReports = [];
    let wardDetails = [];

    if (results[0].status === "fulfilled") {
      allReports = getRows(results[0].value);
    } else {
      errors.push(results[0].reason?.response?.data?.message || "Could not load all reports");
    }

    if (results[1].status === "fulfilled") {
      wardDetails = getRows(results[1].value);
    } else {
      errors.push(results[1].reason?.response?.data?.message || "Could not load report ward details");
    }

    const detailsById = new Map(wardDetails.map((report) => [String(report.report_id), report]));
    const mergedReports = allReports.map((report) => ({
      ...report,
      ...(detailsById.get(String(report.report_id)) || {}),
    }));
    const knownIds = new Set(mergedReports.map((report) => String(report.report_id)));
    wardDetails.forEach((report) => {
      if (!knownIds.has(String(report.report_id))) mergedReports.push(report);
    });
    setReports(mergedReports.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));

    if (results[2].status === "fulfilled") {
      setStaff(results[2].value?.data?.data || { councillors: [], inspectors: [] });
    } else {
      setStaff({ councillors: [], inspectors: [] });
      errors.push(results[2].reason?.response?.data?.message || "Could not load staff");
    }

    if (results[3].status === "fulfilled") {
      setHotspots(getRows(results[3].value));
    } else {
      setHotspots([]);
      errors.push(results[3].reason?.response?.data?.message || "Could not load hotspots");
    }

    setPageError(errors.join(". "));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => String(r.status || "pending").toLowerCase() === "pending").length;
    const resolved = reports.filter((r) => String(r.status || "").toLowerCase() === "resolved").length;
    const assigned = reports.filter((r) => ["assigned", "pending verification", "re-assigned"].includes(String(r.status || "").toLowerCase())).length;
    const distanceConcerns = reports.filter((r) => r.cleanup_distance_meters != null && Number(r.cleanup_distance_meters) > 1000).length;
    return { total: reports.length, pending, resolved, assigned, distanceConcerns };
  }, [reports]);

  const filteredStaff = useMemo(() => {
    const search = wardQuery.trim().toLowerCase().replace(/\s+/g, ' ');
    const matches = (person) => {
      if (!search) return false;
      const wardId = String(person.ward_id ?? '').toLowerCase();
      const wardNumber = String(person.ward_number ?? '').toLowerCase();
      const corporation = String(person.corporation_code ?? '').toLowerCase();
      const combined = `${corporation} ${wardNumber}`.trim();
      const cleaned = search.replace(/^ward\s*(id)?\s*[:#-]?\s*/, '');
      return [wardId, wardNumber, combined].some((value) => value && (value === cleaned || value === search)) ||
        (combined && combined.includes(search));
    };
    return {
      councillors: staff.councillors.filter(matches),
      inspectors: staff.inspectors.filter(matches)
    };
  }, [staff, wardQuery]);

  const emailOptions = useMemo(() => {
    const email = staffForm.email.trim().toLowerCase();
    if (!email) return [];
    const atIndex = email.indexOf('@');
    const local = atIndex < 0 ? email : email.slice(0, atIndex);
    const domain = atIndex < 0 ? '' : email.slice(atIndex + 1);
    if (!local) return [];
    return EMAIL_DOMAINS.filter((d) => !domain || d.startsWith(domain)).map((d) => `${local}@${d}`);
  }, [staffForm.email]);

  const handleStaffChange = (event) => {
    const { name, value } = event.target;
    setStaffForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();
    setStaffMessage("");
    setStaffError("");

    if (!staffForm.email.trim()) {
      setStaffError("Enter an email address.");
      return;
    }
    if (!Number.isInteger(Number(staffForm.ward_id)) || Number(staffForm.ward_id) < 1) {
      setStaffError("Enter a valid existing ward ID.");
      return;
    }
    if (!strongPassword(staffForm.password)) {
      setStaffError("Use 8–128 characters with at least 3 of: lowercase, uppercase, number, symbol.");
      return;
    }
    if (staffForm.password !== staffForm.confirmPassword) {
      setStaffError("Passwords do not match.");
      return;
    }

    setSavingStaff(true);
    try {
      const response = await api.post("/users/create-staff", {
        full_name: staffForm.full_name.trim(),
        email: staffForm.email.trim().toLowerCase(),
        role: staffForm.role,
        password: staffForm.password,
        ward_id: Number(staffForm.ward_id),
      });
      setStaffMessage(response.data?.message || "Staff account created successfully.");
      setStaffForm(emptyStaffForm);
      await loadDashboard();
    } catch (error) {
      setStaffError(error.response?.data?.message || "Could not create the staff account.");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeactivateStaff = async (person) => {
    const role = person.role || (staff.councillors.some((item) => item.user_id === person.user_id) ? 'Councillor' : 'Inspector');
    const confirmed = window.confirm(
      `Deactivate ${person.full_name || 'this staff member'} (${role})?\n\nTheir account will no longer be able to sign in. Existing reports and history will be preserved. Any Inspector tasks still in Assigned status will be returned to the Re-assigned queue. You can create a replacement staff account afterward.`
    );
    if (!confirmed) return;

    setStaffError('');
    setStaffMessage('');
    setDeactivatingStaffId(person.user_id);
    try {
      const response = await api.delete(`/users/staff/${person.user_id}`);
      setStaffMessage(response.data?.message || 'Staff account deactivated.');
      await loadDashboard();
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Could not deactivate this staff account.');
    } finally {
      setDeactivatingStaffId(null);
    }
  };

  const handleResendAlert = async (hotspotId) => {
    setAlertMessage("");
    setAlertBusyId(hotspotId);
    try {
      const response = await api.post(`/hotspots/${hotspotId}/magistrate-alert`);
      setAlertMessage(response.data?.message || `Alert sent for hotspot #${hotspotId}.`);
    } catch (error) {
      setAlertMessage(error.response?.data?.message || `Could not send an alert for hotspot #${hotspotId}.`);
    } finally {
      setAlertBusyId(null);
    }
  };

  return (
    <main className="master-admin-page">
      <div className="ma-container">
        <header className="ma-header">
          <div>
            <p className="ma-eyebrow">DENGUE ALERT · SYSTEM CONTROL</p>
            <h1>Master Admin Dashboard</h1>
            <p className="ma-subtitle">Welcome{user?.full_name ? `, ${user.full_name}` : ""}. Manage staff and monitor community reports.</p>
          </div>
          <div className="ma-header-actions">
            <Link className="ma-button ma-button-light" to="/">Home</Link>
            <button className="ma-button ma-button-light" type="button" onClick={loadDashboard} disabled={loading}>Refresh</button>
            <button className="ma-button ma-button-dark" type="button" onClick={logout}>Log out</button>
          </div>
        </header>

        {pageError && <div className="ma-notice ma-notice-warning">Some dashboard data could not be loaded: {pageError}</div>}
        {alertMessage && <div className="ma-notice">{alertMessage}</div>}

        <section className="ma-stats" aria-label="Report statistics">
          <article className="ma-stat"><span>Total reports</span><strong>{loading ? "—" : stats.total}</strong></article>
          <article className="ma-stat"><span>Pending reports</span><strong>{loading ? "—" : stats.pending}</strong></article>
          <article className="ma-stat"><span>Assigned / verification</span><strong>{loading ? "—" : stats.assigned}</strong></article>
          <article className="ma-stat"><span>Resolved reports</span><strong>{loading ? "—" : stats.resolved}</strong></article>
        </section>

        {stats.distanceConcerns > 0 && (
          <div className="ma-notice ma-notice-warning" role="status">
            <strong>Location concern:</strong> {stats.distanceConcerns} cleanup submission(s) are more than 1 km from their original report locations. Review the flagged reports.
          </div>
        )}

        <section className="ma-panel">
          <div className="ma-panel-heading">
            <div><h2>Recent reports</h2><p>Latest reports across the system, including their ward and evidence photo.</p></div>
            <span className="ma-count">{reports.length} reports</span>
          </div>
          {loading ? <p className="ma-muted">Loading reports…</p> : reports.length === 0 ? <p className="ma-muted">No reports were returned by the API.</p> : (
            <div className="ma-report-list">
              {reports.slice(0, 12).map((report) => (
                <article className="ma-report" key={report.report_id}>
                  {report.before_photo_url ? (
                    <a className="ma-report-photo-link" href={report.before_photo_url} target="_blank" rel="noreferrer" aria-label={`Open photo for report ${report.report_id}`}>
                      <img className="ma-report-photo" src={report.before_photo_url} alt={`Report ${report.report_id} evidence`} loading="lazy" />
                    </a>
                  ) : <div className="ma-report-photo ma-report-photo-empty">No photo</div>}
                  <div className="ma-report-main">
                    <div className="ma-report-title-row"><h3>Report #{report.report_id}</h3><span className={statusClass(report.status)}>{report.status || "Pending"}</span></div>
                    <p>{report.description || "No description provided."}</p>
                    <div className="ma-report-meta">
                      <span>Ward: {report.ward_number ? `${report.corporation_code || ""} ${report.ward_number}`.trim() : report.ward_id ? `ID ${report.ward_id}` : "Not assigned"}</span>
                      <span>Submitted: {formatDate(report.created_at)}</span>
                      {report.cleanup_distance_meters != null && Number(report.cleanup_distance_meters) > 1000 && <span className="ma-distance-alert">Location concern: {(Number(report.cleanup_distance_meters) / 1000).toFixed(2)} km</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="ma-two-columns">
          <section className="ma-panel">
            <div className="ma-panel-heading"><div><h2>Staff directory</h2><p>Find councillors and inspectors assigned to a ward.</p></div></div>
            <label className="ma-ward-search-label" htmlFor="ma-ward-search">Search by ward number or ward ID</label>
            <input
              id="ma-ward-search"
              className="ma-ward-search"
              type="search"
              placeholder="Example: DNCC 11, 11, or ward ID"
              value={wardQuery}
              onChange={(e) => setWardQuery(e.target.value)}
              autoComplete="off"
            />
            {!wardQuery.trim() ? <p className="ma-muted ma-search-hint">Enter a ward to view its corresponding councillors and inspectors. Staff are hidden until you search.</p> : (
              <div className="ma-staff-groups" aria-live="polite">
                <div>
                  <h3>Councillors <span className="ma-count">{filteredStaff.councillors.length}</span></h3>
                  {filteredStaff.councillors.length ? filteredStaff.councillors.map((person) => <div className="ma-staff-row" key={`c-${person.user_id}`}><div className="ma-staff-info"><strong>{person.full_name || "Unnamed staff"}</strong><small>{person.corporation_code && person.ward_number ? `${person.corporation_code} Ward ${person.ward_number} · ` : ''}Ward ID: {person.ward_id ?? "—"} · {person.email || "No email"}</small></div><span className="ma-staff-metric">{person.complaints_resolved ?? 0} resolved</span><button type="button" className="ma-button ma-button-danger ma-staff-deactivate" onClick={() => handleDeactivateStaff({ ...person, role: 'Councillor' })} disabled={deactivatingStaffId === person.user_id}>{deactivatingStaffId === person.user_id ? 'Deactivating…' : 'Deactivate'}</button></div>) : <p className="ma-muted">No councillors found for this ward.</p>}
                </div>
                <div>
                  <h3>Inspectors <span className="ma-count">{filteredStaff.inspectors.length}</span></h3>
                  {filteredStaff.inspectors.length ? filteredStaff.inspectors.map((person) => <div className="ma-staff-row" key={`i-${person.user_id}`}><div className="ma-staff-info"><strong>{person.full_name || "Unnamed staff"}</strong><small>{person.corporation_code && person.ward_number ? `${person.corporation_code} Ward ${person.ward_number} · ` : ''}Ward ID: {person.ward_id ?? "—"} · {person.email || "No email"}</small></div><span className="ma-staff-metric">{person.complaints_assigned ?? 0} assigned</span><button type="button" className="ma-button ma-button-danger ma-staff-deactivate" onClick={() => handleDeactivateStaff({ ...person, role: 'Inspector' })} disabled={deactivatingStaffId === person.user_id}>{deactivatingStaffId === person.user_id ? 'Deactivating…' : 'Deactivate'}</button></div>) : <p className="ma-muted">No inspectors found for this ward.</p>}
                </div>
              </div>
            )}
          </section>

          <section className="ma-panel">
            <div className="ma-panel-heading"><div><h2>Create staff account</h2><p>Create a Councillor or Inspector account for an existing ward.</p></div></div>
            {staffError && <div className="ma-notice ma-notice-error">{staffError}</div>}
            {staffMessage && <div className="ma-notice">{staffMessage}</div>}
            <form className="ma-staff-form" onSubmit={handleCreateStaff}>
              <label>Full name<input name="full_name" value={staffForm.full_name} onChange={handleStaffChange} required maxLength={100} /></label>
              <label>Role<select name="role" value={staffForm.role} onChange={handleStaffChange}><option value="Inspector">Inspector</option><option value="Councillor">Councillor</option></select></label>
              <label>Email<input name="email" type="email" value={staffForm.email} onChange={handleStaffChange} onBlur={() => setStaffForm((prev) => ({ ...prev, email: completeEmail(prev.email) }))} placeholder="name@example.com" list="ma-email-domains" required autoComplete="email" />
                <datalist id="ma-email-domains">{emailOptions.map((email) => <option key={email} value={email} />)}</datalist>
              </label>
              <label>Existing ward ID<input name="ward_id" type="number" min="1" step="1" value={staffForm.ward_id} onChange={handleStaffChange} required /></label>
              <label>Temporary password
                <span className="ma-password-control">
                  <input name="password" type={showStaffPassword ? 'text' : 'password'} value={staffForm.password} onChange={handleStaffChange} minLength={8} maxLength={128} required autoComplete="new-password" />
                  <PasswordVisibilityToggle
                    className="ma-password-toggle"
                    visible={showStaffPassword}
                    onToggle={() => setShowStaffPassword((show) => !show)}
                    fieldLabel="password"
                  />
                </span>
              </label>
              <label>Confirm password
                <span className="ma-password-control">
                  <input name="confirmPassword" type={showStaffConfirmPassword ? 'text' : 'password'} value={staffForm.confirmPassword} onChange={handleStaffChange} minLength={8} required autoComplete="new-password" />
                  <PasswordVisibilityToggle
                    className="ma-password-toggle"
                    visible={showStaffConfirmPassword}
                    onToggle={() => setShowStaffConfirmPassword((show) => !show)}
                    fieldLabel="confirm password"
                  />
                </span>
                {staffForm.confirmPassword && <small className={staffForm.password === staffForm.confirmPassword ? 'ma-password-valid' : 'ma-password-invalid'}>{staffForm.password === staffForm.confirmPassword ? 'Passwords match' : 'Passwords do not match'}</small>}
              </label>
              <div className="ma-strength-box" role="status">
                <div className="ma-password-strength-track"><span style={{ width: `${passwordScore(staffForm.password) * 20}%` }} /></div>
                <small>Password strength: <strong>{!staffForm.password ? 'Not entered' : passwordScore(staffForm.password) <= 2 ? 'Weak' : passwordScore(staffForm.password) <= 4 ? 'Medium' : 'Strong'}</strong>. Use 8+ characters and a mix of character types.</small>
              </div>
              <p className="ma-form-help">Use a valid numeric <code>wards.ward_id</code> from your database. Staff accounts require a ward ID.</p>
              <button className="ma-button ma-button-green" type="submit" disabled={savingStaff}>{savingStaff ? "Creating account…" : "Create staff account"}</button>
            </form>
          </section>
        </div>

        <section className="ma-panel">
          <div className="ma-panel-heading"><div><h2>Active dengue hotspots</h2><p>Active hotspot areas returned by the hotspot API.</p></div><span className="ma-count">{hotspots.length} active</span></div>
          {hotspots.length === 0 ? <p className="ma-muted">No active hotspots were returned.</p> : <div className="ma-hotspot-list">{hotspots.map((hotspot) => <article className="ma-hotspot" key={hotspot.hotspot_id}><div><strong>Hotspot #{hotspot.hotspot_id} · {hotspot.corporation_code} Ward {hotspot.ward_number}</strong><p>{hotspot.complaint_count} complaints · radius {hotspot.detection_radius_meters} m · threshold {hotspot.threshold_count}</p><small>Last report: {formatDate(hotspot.last_report_at)}</small></div><button className="ma-button ma-button-light" type="button" onClick={() => handleResendAlert(hotspot.hotspot_id)} disabled={alertBusyId === hotspot.hotspot_id}>{alertBusyId === hotspot.hotspot_id ? "Sending…" : "Resend magistrate alert"}</button></article>)}</div>}
        </section>

        <footer className="ma-footer"><Link to="/">Back to Dengue Alert home</Link><span>Master Admin access</span></footer>
      </div>
    </main>
  );
}
