const { randomBytes, createHash } = require('node:crypto');

const ALERT_LINK_LIFETIME_HOURS = 48;

function generateSecureToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function buildAlertUrl(token, env = process.env) {
  // The public link is a readable React page, not the JSON-only API endpoint.
  // Accept the existing .env MAGISTRATE_ALERT_BASE_URL setting (which can end
  // in /api/magistrate-notify) so no SMTP, tunnel or database config changes
  // are required for current installations.
  const port = env.PORT || 3500;
  const configuredBase = (
    env.MAGISTRATE_ALERT_BASE_URL?.trim() ||
    env.PUBLIC_API_BASE_URL?.trim() ||
    `http://localhost:${port}`
  ).replace(/\/+$/, '');

  const publicBase = configuredBase.replace(/\/api\/magistrate-(?:notify|alert)$/i, '');
  const pageBase = /\/magistrate-alert$/i.test(publicBase)
    ? publicBase
    : `${publicBase}/magistrate-alert`;
  return `${pageBase}/${encodeURIComponent(token)}`;
}

function shortError(error) {
  return String(error?.message || error || 'Unknown email delivery error').slice(0, 400);
}

async function sendMagistrateEmail(subject, message) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  const recipient = process.env.MAGISTRATE_EMAIL;

  if (!host || !user || !password || !recipient) {
    throw new Error('SMTP or Magistrate email configuration is incomplete');
  }

  // Lazy-load so unit tests do not require SMTP setup or a live mail provider.
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === undefined
    ? port === 465
    : process.env.SMTP_SECURE.toLowerCase() === 'true';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || user,
      to: recipient,
      subject,
      text: message
    });
  } finally {
    transporter.close();
  }
}

/** Sends email only. There is intentionally no SMS or alternate-channel fallback. */
async function deliverByEmail({ emailSender, subject, message }) {
  try {
    await emailSender(subject, message);
    return { status: 'sent', channel: 'email' };
  } catch (error) {
    return {
      status: 'failed',
      channel: null,
      errorMessage: shortError(error)
    };
  }
}

async function createAndSendMagistrateAlert(hotspotId) {
  const numericHotspotId = Number(hotspotId);
  if (!Number.isSafeInteger(numericHotspotId) || numericHotspotId < 1) {
    throw new Error('hotspotId must be a positive integer');
  }

  // Lazy-load the pool to keep the pure helper unit tests independent of PostgreSQL.
  const pool = require('../config/db');
  const hotspotResult = await pool.query(
    `
    SELECT
      h.hotspot_id,
      h.ward_id,
      w.ward_number,
      w.corporation_code,
      h.complaint_count,
      h.threshold_count,
      h.detection_radius_meters,
      h.status
    FROM hotspot_areas h
    JOIN wards w ON w.ward_id = h.ward_id
    WHERE h.hotspot_id = $1
    LIMIT 1
    `,
    [numericHotspotId]
  );

  if (hotspotResult.rowCount === 0) {
    const error = new Error('Hotspot area was not found');
    error.code = 'HOTSPOT_NOT_FOUND';
    throw error;
  }

  const hotspot = hotspotResult.rows[0];
  if (hotspot.status !== 'Active') {
    const error = new Error('Only active hotspot areas can be escalated');
    error.code = 'HOTSPOT_NOT_ACTIVE';
    throw error;
  }

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const alertResult = await pool.query(
    `
    INSERT INTO magistrate_alert_links
      (hotspot_id, token_hash, expires_at, notification_status, attempt_count, created_at, updated_at)
    VALUES
      ($1, $2, NOW() + INTERVAL '48 hours', 'pending', 1, NOW(), NOW())
    ON CONFLICT (hotspot_id)
    DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      notification_status = 'pending',
      delivery_channel = NULL,
      last_error = NULL,
      sent_at = NULL,
      attempt_count = magistrate_alert_links.attempt_count + 1,
      updated_at = NOW()
    RETURNING alert_id, expires_at
    `,
    [numericHotspotId, tokenHash]
  );

  const alert = alertResult.rows[0];
  const link = buildAlertUrl(token);
  const subject = `Dengue hotspot alert — ${hotspot.corporation_code}, Ward ${hotspot.ward_number}`;
  const message = [
    'Dengue Alert & Ward-Based Management System',
    `Hotspot area detected in ${hotspot.corporation_code}, Ward ${hotspot.ward_number}.`,
    `Nearby complaints: ${hotspot.complaint_count} (threshold: ${hotspot.threshold_count}).`,
    `This secure, view-only link expires in 48 hours: ${link}`
  ].join('\n');

  const delivery = await deliverByEmail({
    subject,
    message,
    emailSender: sendMagistrateEmail
  });

  if (delivery.status === 'sent') {
    await pool.query(
      `
      UPDATE magistrate_alert_links
      SET notification_status = 'sent',
          delivery_channel = 'email',
          last_error = NULL,
          sent_at = NOW(),
          updated_at = NOW()
      WHERE alert_id = $1
      `,
      [alert.alert_id]
    );

    return {
      alert_id: alert.alert_id,
      status: 'sent',
      delivery_channel: 'email',
      expires_at: alert.expires_at
    };
  }

  await pool.query(
    `
    UPDATE magistrate_alert_links
    SET notification_status = 'failed',
        delivery_channel = NULL,
        last_error = $2,
        updated_at = NOW()
    WHERE alert_id = $1
    `,
    [alert.alert_id, delivery.errorMessage]
  );

  console.error('Magistrate email notification failed:', delivery.errorMessage);
  return {
    alert_id: alert.alert_id,
    status: 'failed',
    delivery_channel: null,
    expires_at: alert.expires_at,
    reason: 'email_notification_failed'
  };
}

module.exports = {
  ALERT_LINK_LIFETIME_HOURS,
  generateSecureToken,
  hashToken,
  buildAlertUrl,
  deliverByEmail,
  createAndSendMagistrateAlert
};
