import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageProvider';
import './MagistrateHotspotDetails.css';

// Public read-only page. The 43-character link token is validated by the API.
// Do not use the authenticated Axios client here: token holders don't need a
// login, and an expired alert must not log out an unrelated signed-in user.
const messages = {
  en: {
    community: 'Community reporting',
    readOnly: 'SECURE · VIEW ONLY',
    title: 'Dengue hotspot alert',
    subtitle: 'Magistrate review · Dengue Alert & Ward-Based Management System',
    loading: 'Loading your secure hotspot report…',
    loadFailed: 'Could not load this hotspot report.',
    invalid: 'This alert link is invalid or unavailable.',
    expired: 'This alert link has expired.',
    rotated: 'Please request a new notification link from the Dengue Alert team.',
    retry: 'Try again',
    back: 'Dengue Alert home',
    ward: 'Ward',
    municipality: 'City corporation',
    reported: 'Nearby complaints',
    threshold: 'Alert threshold',
    radius: 'Detection radius',
    meters: 'meters',
    status: 'Hotspot status',
    expires: 'Secure link expires',
    firstDetected: 'Hotspot detected',
    latestReport: 'Latest report',
    location: 'Hotspot location',
    mapNote: 'Approximate hotspot center. Nearby reports are within the configured detection radius.',
    maps: 'Open in Maps',
    noLocation: 'Hotspot coordinates are unavailable.',
    reports: 'Nearby complaint reports',
    reportsHelp: 'Read-only records submitted around this hotspot.',
    upTo: 'Showing up to 100 nearby complaints',
    noReports: 'No complaint details are available for this alert.',
    complaint: 'Complaint',
    submitted: 'Submitted',
    description: 'Description',
    noDescription: 'No description provided',
    photo: 'Submitted photo',
    openPhoto: 'View original photo',
    photoAlt: 'Submitted complaint evidence',
    locationLabel: 'Location',
    noPhoto: 'No photo supplied',
    footer: 'This page is read-only. The secure link is time-limited and may be replaced when a new alert is issued.',
    unavailable: 'Not available',
  },
  bn: {
    community: 'কমিউনিটি রিপোর্টিং',
    readOnly: 'নিরাপদ · শুধু দেখার জন্য',
    title: 'ডেঙ্গু হটস্পট সতর্কবার্তা',
    subtitle: 'ম্যাজিস্ট্রেট পর্যালোচনা · ডেঙ্গু অ্যালার্ট ও ওয়ার্ডভিত্তিক ব্যবস্থাপনা',
    loading: 'নিরাপদ হটস্পট রিপোর্ট লোড হচ্ছে…',
    loadFailed: 'হটস্পট রিপোর্ট লোড করা যায়নি।',
    invalid: 'এই সতর্কবার্তার লিংকটি অবৈধ বা উপলব্ধ নয়।',
    expired: 'এই সতর্কবার্তার লিংকের মেয়াদ শেষ হয়েছে।',
    rotated: 'ডেঙ্গু অ্যালার্ট টিমের কাছ থেকে নতুন নোটিফিকেশন লিংক সংগ্রহ করুন।',
    retry: 'আবার চেষ্টা করুন',
    back: 'ডেঙ্গু অ্যালার্ট হোম',
    ward: 'ওয়ার্ড',
    municipality: 'সিটি করপোরেশন',
    reported: 'আশপাশের অভিযোগ',
    threshold: 'সতর্কবার্তার সীমা',
    radius: 'শনাক্তকরণ ব্যাসার্ধ',
    meters: 'মিটার',
    status: 'হটস্পটের অবস্থা',
    expires: 'লিংকের মেয়াদ',
    firstDetected: 'হটস্পট শনাক্তের সময়',
    latestReport: 'সর্বশেষ অভিযোগ',
    location: 'হটস্পটের অবস্থান',
    mapNote: 'হটস্পটের আনুমানিক কেন্দ্র। কাছাকাছি অভিযোগগুলো নির্ধারিত ব্যাসার্ধের মধ্যে রয়েছে।',
    maps: 'মানচিত্রে দেখুন',
    noLocation: 'হটস্পটের স্থানাঙ্ক পাওয়া যায়নি।',
    reports: 'আশপাশের অভিযোগসমূহ',
    reportsHelp: 'এই হটস্পটের কাছাকাছি জমা দেওয়া অভিযোগের বিবরণ।',
    upTo: 'সর্বোচ্চ ১০০টি কাছাকাছি অভিযোগ দেখানো হয়',
    noReports: 'এই সতর্কবার্তার জন্য অভিযোগের বিস্তারিত পাওয়া যায়নি।',
    complaint: 'অভিযোগ',
    submitted: 'জমা দেওয়া হয়েছে',
    description: 'বিবরণ',
    noDescription: 'কোনো বিবরণ দেওয়া হয়নি',
    photo: 'সংযুক্ত ছবি',
    openPhoto: 'মূল ছবি দেখুন',
    photoAlt: 'অভিযোগের সাথে সংযুক্ত ছবি',
    locationLabel: 'অবস্থান',
    noPhoto: 'কোনো ছবি নেই',
    footer: 'এই পৃষ্ঠাটি শুধু তথ্য দেখার জন্য। নিরাপদ লিংকটির মেয়াদ সীমিত এবং নতুন সতর্কবার্তা পাঠালে আগের লিংক বাতিল হতে পারে।',
    unavailable: 'পাওয়া যায়নি',
  },
};

const readableStatus = {
  en: { Pending: 'Pending', Assigned: 'Assigned', 'Pending Verification': 'Pending verification', 'Re-assigned': 'Re-assigned', Resolved: 'Resolved', Rejected: 'Rejected', Active: 'Active', Cleared: 'Cleared' },
  bn: { Pending: 'অপেক্ষমাণ', Assigned: 'দায়িত্ব দেওয়া হয়েছে', 'Pending Verification': 'যাচাইয়ের অপেক্ষায়', 'Re-assigned': 'পুনরায় দায়িত্ব দেওয়া হয়েছে', Resolved: 'সমাধান হয়েছে', Rejected: 'প্রত্যাখ্যাত', Active: 'সক্রিয়', Cleared: 'নিষ্পত্তিকৃত' },
};

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDate(value, language, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-BD', {
    timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short'
  });
}

function safePhotoUrl(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (/^https:\/\/[^\s]+$/i.test(clean)) return clean;
  if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
  return null;
}

function LocationMap({ latitude, longitude, label, t }) {
  const lat = numberOrNull(latitude);
  const lng = numberOrNull(longitude);
  const valid = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!valid) return <p className="ma-muted">{t.noLocation}</p>;

  const delta = 0.005;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const externalUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className="ma-map-content">
      <div className="ma-map-top">
        <div className="ma-coordinates"><span aria-hidden="true">⌖</span> {label}: {lat.toFixed(6)}, {lng.toFixed(6)}</div>
        <a href={externalUrl} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" className="ma-outbound">{t.maps} ↗</a>
      </div>
      <iframe title={label} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" className="ma-map-frame" />
      <p className="ma-map-footnote">{t.mapNote}</p>
    </div>
  );
}

export default function MagistrateHotspotDetails() {
  const { token } = useParams();
  const { language } = useLanguage();
  const lang = language === 'bn' ? 'bn' : 'en';
  const t = messages[lang];
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // Browsers may load this page from the PWA app shell cache. Protect the
    // high-entropy token from being passed to external maps or image hosts.
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) {
      setState({ loading: false, data: null, error: 'invalid' });
      return () => controller.abort();
    }

    async function load() {
      setState({ loading: true, data: null, error: '' });
      try {
        const response = await fetch(`/api/magistrate-notify/${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
        });
        if (response.status === 410) throw new Error('expired');
        if (response.status === 404) throw new Error('invalid');
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        if (!data.success || !data.hotspot) throw new Error('unavailable');
        if (!controller.signal.aborted) setState({ loading: false, data, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ loading: false, data: null, error: error.message === 'expired' || error.message === 'invalid' ? error.message : 'unavailable' });
        }
      }
    }
    load();
    return () => controller.abort();
  }, [token, reload]);

  const hotspot = state.data?.hotspot;
  const complaints = Array.isArray(state.data?.complaints) ? state.data.complaints : [];
  const statusName = (value) => readableStatus[lang][value] || value || t.unavailable;
  const dateLabel = (value) => formatDate(value, lang, t.unavailable);

  return (
    <main className="ma-page">
      <header className="ma-header">
        <div className="ma-header-inner">
          <Link to="/" className="ma-brand">
            <span className="ma-brand-symbol" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>
              </svg>
            </span>
            <span className="ma-brand-text"><strong>Dengue Alert</strong><small>{t.community}</small></span>
          </Link>
          <span className="ma-view-label"><span className="ma-status-dot" />{t.readOnly}</span>
        </div>
      </header>

      <div className="ma-body">
        <div className="ma-eyebrow">{t.readOnly}</div>
        <h1>{t.title}</h1>
        <p className="ma-lead">{t.subtitle}</p>

        {state.loading && <section className="ma-card ma-feedback" role="status"><span className="ma-loader" aria-hidden="true" />{t.loading}</section>}

        {!state.loading && state.error && (
          <section className="ma-card ma-feedback" role="alert">
            <div className="ma-feedback-symbol" aria-hidden="true">!</div>
            <h2>{state.error === 'expired' ? t.expired : state.error === 'invalid' ? t.invalid : t.loadFailed}</h2>
            <p>{t.rotated}</p>
            {state.error === 'unavailable' && <button type="button" className="ma-primary" onClick={() => setReload((current) => current + 1)}>{t.retry}</button>}
            <Link to="/" className="ma-outbound">{t.back} ↗</Link>
          </section>
        )}

        {hotspot && (
          <>
            <section className="ma-card ma-overview" aria-label={t.location}>
              <div className="ma-overview-heading">
                <div>
                  <div className="ma-section-eyebrow">{t.municipality}</div>
                  <h2>{hotspot.corporation_code} <span>·</span> {t.ward} {hotspot.ward_number}</h2>
                </div>
                <span className="ma-active-tag">{statusName(hotspot.status)}</span>
              </div>

              <div className="ma-metrics">
                <div className="ma-metric"><span>{t.reported}</span><strong>{hotspot.complaint_count ?? '—'}</strong></div>
                <div className="ma-metric"><span>{t.threshold}</span><strong>{hotspot.threshold_count ?? '—'}</strong></div>
                <div className="ma-metric"><span>{t.radius}</span><strong>{hotspot.detection_radius_meters ?? '—'} <small>{t.meters}</small></strong></div>
              </div>

              <div className="ma-time-grid">
                <div><span>{t.firstDetected}</span><strong>{dateLabel(hotspot.created_at)}</strong></div>
                <div><span>{t.latestReport}</span><strong>{dateLabel(hotspot.last_report_at)}</strong></div>
                <div><span>{t.expires}</span><strong>{dateLabel(state.data.expires_at)}</strong></div>
              </div>
            </section>

            <section className="ma-card">
              <div className="ma-section-heading"><div><h2>{t.location}</h2><p>{t.mapNote}</p></div></div>
              <LocationMap latitude={hotspot.latitude} longitude={hotspot.longitude} label={t.location} t={t} />
            </section>

            <section className="ma-card">
              <div className="ma-section-heading">
                <div><h2>{t.reports}</h2><p>{t.reportsHelp}</p></div>
                <span className="ma-complaint-count">{complaints.length}</span>
              </div>
              <p className="ma-cap-note">{t.upTo}</p>
              {complaints.length === 0 && <p className="ma-muted">{t.noReports}</p>}
              <div className="ma-complaints">
                {complaints.map((complaint, index) => {
                  const photo = safePhotoUrl(complaint.before_photo_url);
                  const latitude = numberOrNull(complaint.latitude);
                  const longitude = numberOrNull(complaint.longitude);
                  return (
                    <article key={complaint.report_id || index} className="ma-complaint">
                      <div className="ma-complaint-head">
                        <div><span className="ma-complaint-number">{t.complaint} #{complaint.report_id || index + 1}</span><span className="ma-report-date">{t.submitted}: {dateLabel(complaint.created_at)}</span></div>
                        <span className={`ma-report-status ${complaint.status === 'Rejected' ? 'ma-report-status--rejected' : complaint.status === 'Resolved' ? 'ma-report-status--resolved' : ''}`}>{statusName(complaint.status)}</span>
                      </div>
                      <div className="ma-complaint-details">
                        <div>
                          <div className="ma-field-label">{t.description}</div>
                          <p className="ma-complaint-description da-complaint-description" translate="no">{complaint.description || t.noDescription}</p>
                          {latitude !== null && longitude !== null && (
                            <div className="ma-small-coordinates"><span className="ma-field-label">{t.locationLabel}: </span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</div>
                          )}
                        </div>
                        {photo && (
                          <a className="ma-photo-link" href={photo} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" aria-label={t.openPhoto}>
                            <img src={photo} alt={`${t.photoAlt} #${complaint.report_id}`} loading="lazy" referrerPolicy="no-referrer" />
                            <span>{t.openPhoto} ↗</span>
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
        <footer className="ma-footer">{t.footer}</footer>
      </div>
    </main>
  );
}
