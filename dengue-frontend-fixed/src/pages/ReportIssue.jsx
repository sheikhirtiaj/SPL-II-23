import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../axios";
import LiveCameraCapture from "../components/LiveCameraCapture";
import "./ReportIssue.css";

const REPORT_ENDPOINT = "/reports";

export default function ReportIssue() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState("standing_water");
  const [evidence, setEvidence] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [usedLast24Hours, setUsedLast24Hours] = useState(null);

  // Informational only; the backend's transaction check is authoritative.
  useEffect(() => {
    let active = true;
    api.get('/reports').then((response) => {
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const count = data.filter((report) => new Date(report.created_at).getTime() > cutoff).length;
      if (active) setUsedLast24Hours(count);
    }).catch(() => { /* Backend will still enforce the limit on submission. */ });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (usedLast24Hours !== null && usedLast24Hours >= 3) {
      setError('You can submit at most 3 complaints in a rolling 24-hour period. Please try again later.');
      return;
    }

    if (description.trim().length < 10) {
      setError("Describe the problem in at least 10 characters.");
      return;
    }
    if (!evidence?.file) {
      setError("Capture a new photo using the live camera.");
      return;
    }
    if (evidence.latitude == null || evidence.longitude == null) {
      setError("The photo and GPS location must both be captured before submitting.");
      return;
    }

    const formData = new FormData();
    formData.append("description", description.trim());
    formData.append("latitude", String(evidence.latitude));
    formData.append("longitude", String(evidence.longitude));
    formData.append("issue_type", issueType);
    formData.append("before_photo", evidence.file);

    try {
      setSubmitting(true);
      const response = await api.post(REPORT_ENDPOINT, formData);
      const responseData = response.data;

      if (responseData?.success === false) {
        setError(responseData.message || "The report could not be submitted.");
        return;
      }

      const createdReport = responseData?.data ?? responseData?.report ?? responseData;
      setSuccess({ ...responseData, report: createdReport });
    } catch (requestError) {
      const status = requestError.response?.status;
      if (!requestError.response) {
        setError("Could not reach the server. Your report was not confirmed as submitted. Please try again.");
      } else if (status === 401) {
        setError("Your session has expired. Sign in and submit the report again.");
      } else if (status === 403) {
        setError("Only a citizen account can submit a report.");
      } else if (status === 429) {
        setError(requestError.response?.data?.message || 'You have already submitted 3 complaints in the last 24 hours. Try again later.');
      } else if (status === 413) {
        setError("The server rejected the upload because it is too large.");
      } else {
        setError(requestError.response?.data?.message || "The report could not be submitted. Check your details and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const referenceNumber =
    success?.report?.report_id ??
    success?.report?.id ??
    success?.data?.report_id ??
    success?.report_id ??
    null;

  if (success) {
    return (
      <main className="report-page">
        <section className="report-card report-success" aria-live="polite">
          <div className="success-icon" aria-hidden="true">✓</div>
          <h1>Report submitted</h1>
          <p>Your report was accepted by the server. Keep your reference number for future tracking.</p>
          {referenceNumber !== null && referenceNumber !== undefined && referenceNumber !== "" ? (
            <p className="report-reference">Reference: <strong>{referenceNumber}</strong></p>
          ) : (
            <p className="field-hint">Your report was submitted, but the server did not return a reference number.</p>
          )}
          <button className="primary-button" type="button" onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="report-page">
      <header className="report-header">
        <button className="back-button" type="button" onClick={() => navigate("/dashboard")}>
          ← Back to dashboard
        </button>
        <p className="eyebrow">DENGUE ALERT · COMMUNITY REPORTING</p>
        <h1>Report a breeding site</h1>
        <p>Describe the possible breeding site, then capture a new photo and its GPS location together.</p>
      </header>

      <form className="report-card" onSubmit={handleSubmit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        {usedLast24Hours !== null && (
          <p className={usedLast24Hours >= 3 ? 'form-error' : 'field-hint'} role="status">
            {usedLast24Hours >= 3
              ? 'Daily limit reached: 3 complaints in the last 24 hours. Try again later.'
              : `Complaints submitted in the last 24 hours: ${usedLast24Hours} of 3.`}
          </p>
        )}

        <section className="form-section">
          <div className="section-heading">
            <span className="step-number">1</span>
            <div><h2>Describe the issue</h2><p>Tell us what you found.</p></div>
          </div>

          <label htmlFor="issueType">Type of issue</label>
          <select id="issueType" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
            <option value="standing_water">Standing water</option>
            <option value="open_container">Open water container</option>
            <option value="blocked_drain">Blocked drain</option>
            <option value="discarded_items">Discarded items holding water</option>
            <option value="other">Other suspected breeding site</option>
          </select>

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Example: Standing water in an uncovered container beside the building entrance."
            minLength={10}
            maxLength={1000}
            rows={4}
            required
          />
          <p className="field-hint">{description.length}/1000 characters</p>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <span className="step-number">2</span>
            <div><h2>Capture live photo + GPS</h2><p>Gallery uploads and manually selected locations are not accepted.</p></div>
          </div>
          <LiveCameraCapture onCapture={setEvidence} disabled={submitting || usedLast24Hours >= 3} />
          <p className="field-hint">
            Camera and location permission are required. If GPS fails, enable location access and retake the photo so both are captured together.
          </p>
        </section>

        <footer className="form-footer">
          <p>Only submit a report for a real location. Avoid including identifiable people in photos unless necessary.</p>
          <button className="primary-button" type="submit" disabled={submitting || usedLast24Hours >= 3 || !evidence?.file || evidence.latitude == null || evidence.longitude == null}>
            {submitting ? "Submitting report…" : "Submit report"}
          </button>
        </footer>
      </form>
    </main>
  );
}
