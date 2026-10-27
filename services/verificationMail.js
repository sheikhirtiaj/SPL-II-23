const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

function getMailConfiguration() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  const SMTP_PORT = process.env.SMTP_PORT || '587';
  const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
  const APP_BASE_URL = process.env.APP_BASE_URL || process.env.PUBLIC_API_BASE_URL;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM || !APP_BASE_URL) return null;
  let base;
  try {
    base = new URL(APP_BASE_URL);
    if (!['https:', 'http:'].includes(base.protocol)) return null;
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') return null;
  } catch (_) { return null; }
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: SMTP_HOST, port, auth: { user: SMTP_USER, pass: SMTP_PASS },
    secure: SMTP_SECURE == null ? port === 465 : SMTP_SECURE.toLowerCase() === 'true',
    from: EMAIL_FROM, baseUrl: base };
}

async function sendVerificationEmail(email, token) {
  const config = getMailConfiguration();
  if (!config) {
    const error = new Error('Email verification is not configured on the server.');
    error.code = 'MAIL_NOT_CONFIGURED';
    throw error;
  }
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure, auth: config.auth,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  const link = new URL('/verify-email', config.baseUrl);
  link.searchParams.set('token', token);
  try {
    await transport.sendMail({
      from: config.from, to: email, subject: 'Verify your Dengue Alert email address',
      text: `Verify your Dengue Alert account using this link (valid for 24 hours):\n${link.toString()}\n\nIf you did not register, you can ignore this message.`,
    });
  } finally { transport.close(); }
}
module.exports = { hashToken, newToken, sendVerificationEmail, getMailConfiguration };
