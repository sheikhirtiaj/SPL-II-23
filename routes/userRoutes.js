const express = require('express')
const bcrypt = require('bcrypt')
const jsonwebtoken = require('jsonwebtoken')
const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const googleOAuthClient = new OAuth2Client()
const pool = require('../config/db')

const verify = require('../middleware/authmiddleware')
const authorization = require('../middleware/rolemiddleware')

const { strongPassword } = require('../services/passwordPolicy');
const { hashToken, newToken, sendVerificationEmail, getMailConfiguration } = require('../services/verificationMail');

const router = express.Router()


// Google Identity Services sends a signed ID token to this endpoint. The server
// verifies its signature, audience, issuer, expiry, and Google-verified email.
// Google sign-in is deliberately restricted to Citizen accounts.
router.post('/google-auth', async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const credential = req.body?.credential;
  if (!googleClientId) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured. Please use email and password for now.' });
  }
  if (typeof credential !== 'string' || credential.length < 20) {
    return res.status(400).json({ success: false, message: 'Missing or invalid Google credential.' });
  }

  let payload;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience: googleClientId });
    payload = ticket.getPayload();
  } catch (error) {
    // Do not log or return the credential itself. The message helps diagnose a
    // mismatched frontend/backend client ID or an unconfigured OAuth origin.
    console.error('Google ID token verification failed:', error?.message || 'unknown verification error');
    return res.status(401).json({
      success: false,
      message: 'Google sign-in could not be verified. Confirm that GOOGLE_CLIENT_ID matches REACT_APP_GOOGLE_CLIENT_ID and that this website origin is authorized in Google Cloud Console.'
    });
  }

  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const fullName = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 100) : '';
  if (!email || payload.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(403).json({ success: false, message: 'Use a Google account with a verified email address.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT user_id, full_name, email, role, ward_id, is_active
       FROM users
       WHERE LOWER(email) = $1
       FOR UPDATE`,
      [email]
    );

    let user;
    if (existing.rowCount) {
      user = existing.rows[0];
      if (user.role !== 'Citizen') {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Google sign-in is available for Citizen accounts only. Staff must use their assigned login.' });
      }
      if (user.is_active === false) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'This account has been deactivated. Please contact the Master Admin.' });
      }
      await client.query(
        `UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL,
           email_verification_expires_at = NULL, email_verification_sent_at = NULL
         WHERE user_id = $1`,
        [user.user_id]
      );
      user.email_verified = true;
    } else {
      // The schema requires password_hash even for Google-authenticated accounts.
      // A random high-entropy value is hashed and never disclosed to the user.
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12);
      const inserted = await client.query(
        `INSERT INTO users (full_name, email, role, password_hash, created_at, email_verified, is_active)
         VALUES ($1, $2, 'Citizen', $3, NOW(), TRUE, TRUE)
         RETURNING user_id, full_name, email, role, ward_id, is_active`,
        [fullName || email.split('@')[0], email, randomPasswordHash]
      );
      user = inserted.rows[0];
    }

    await client.query('COMMIT');
    const token = jsonwebtoken.sign(
      { user_id: user.user_id, role: user.role, ward_id: user.ward_id || null },
      process.env.Jeson_Web_Token,
      { expiresIn: '1d' }
    );
    return res.status(200).json({
      success: true,
      message: 'Google sign-in successful.',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name || fullName || email.split('@')[0],
        email: user.email,
        role: user.role,
        ward_id: user.ward_id || null
      }
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This email was registered at the same time. Please try Google sign-in again.' });
    }
    console.error('Google sign-in error:', error.message);
    return res.status(500).json({ success: false, message: 'Google sign-in failed. Please try again.' });
  } finally {
    if (client) client.release();
  }
});

// Logical deletion keeps historical report references intact. Assigned work is
// returned to the councillor's unassigned queue before an Inspector is disabled.
router.delete('/staff/:userId', verify, authorization('Master Admin'), async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ success: false, message: 'A valid staff user ID is required.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT user_id, role, is_active FROM users WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Staff account not found.' });
    }
    const staffMember = selected.rows[0];
    if (!['Councillor', 'Inspector'].includes(staffMember.role)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Only Councillor and Inspector accounts can be deactivated here.' });
    }
    if (staffMember.is_active === false) {
      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'This staff account is already deactivated.' });
    }

    let releasedAssignments = 0;
    if (staffMember.role === 'Inspector') {
      const released = await client.query(
        `UPDATE reports
         SET assigned_inspector_id = NULL, status = 'Re-assigned', updated_at = NOW()
         WHERE assigned_inspector_id = $1 AND status = 'Assigned'
         RETURNING report_id`,
        [userId]
      );
      releasedAssignments = released.rowCount;
    } else {
      await client.query('UPDATE wards SET councillor_id = NULL WHERE councillor_id = $1', [userId]);
    }

    await client.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    const detail = staffMember.role === 'Inspector' && releasedAssignments
      ? ` ${releasedAssignments} active assignment(s) were returned to the Re-assigned queue.`
      : staffMember.role === 'Councillor'
        ? ' The councillor assignment was cleared from the ward so a replacement can be created.'
        : '';
    return res.status(200).json({
      success: true,
      message: `${staffMember.role} account deactivated. Existing reports and history were preserved.${detail}`,
      data: { user_id: userId, role: staffMember.role, released_assignments: releasedAssignments }
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Staff deactivation error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not deactivate the staff account.' });
  } finally {
    if (client) client.release();
  }
});

// Email verification applies to NEW public Citizen signups. Existing users and
// Master-Admin-created staff remain able to sign in without changing workflows.
router.post('/register', async (req, res) => {
  const name = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!name || name.length > 100) return res.status(400).json({ success: false, message: 'Enter your full name (maximum 100 characters).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!strongPassword(password)) return res.status(400).json({ success: false, message: 'Use 8–128 characters including at least 3 of: lowercase, uppercase, number, symbol.' });
  if (!getMailConfiguration()) return res.status(503).json({ success: false, message: 'Email verification is not configured yet. Please contact the administrator.' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const token = newToken();
    const password_hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (full_name, email, role, password_hash, created_at, email_verified, email_verification_token_hash, email_verification_expires_at, email_verification_sent_at)
       VALUES ($1, $2, 'Citizen', $3, NOW(), FALSE, $4, NOW() + INTERVAL '24 hours', NOW())`,
      [name, email, password_hash, hashToken(token)]
    );
    // If mail fails, roll back account creation so no inaccessible user is left behind.
    await sendVerificationEmail(email, token);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Check your inbox and verify your email before signing in.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Email already registered. If not verified, use Resend verification.' });
    console.error('Registration error:', error.message);
    return res.status(error.code === 'MAIL_NOT_CONFIGURED' ? 503 : 500).json({ success: false, message: 'Could not send verification email. Please try again or contact the administrator.' });
  } finally { if (client) client.release(); }
});

// Token is SHA-256 hashed at rest, single-use, 24-hour expiry. Verification
// uses POST so simple link-preview GET requests cannot activate accounts.
router.post('/verify-email', async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ success: false, message: 'Invalid verification link.' });
  }
  try {
    const result = await pool.query(
      `UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL,
         email_verification_expires_at = NULL, email_verification_sent_at = NULL
       WHERE email_verified = FALSE AND email_verification_token_hash = $1
         AND email_verification_expires_at > NOW()
       RETURNING user_id`, [hashToken(token)]
    );
    if (!result.rowCount) return res.status(400).json({ success: false, message: 'Link has expired or was already used. Request a new verification email.' });
    return res.json({ success: true, message: 'Email verified. You can now sign in.' });
  } catch (error) {
    console.error('Verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Email verification failed.' });
  }
});

router.post('/resend-verification', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email.' });
  const generic = { success: true, message: 'If this email has a pending account, a new verification link has been sent.' };
  if (!getMailConfiguration()) return res.status(503).json({ success: false, message: 'Email verification is not configured yet.' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Lock a single account to prevent concurrent resends. Max one email per 60 seconds.
    const result = await client.query(
      `SELECT user_id, email_verification_sent_at FROM users WHERE LOWER(email) = $1 AND email_verified = FALSE FOR UPDATE`, [email]
    );
    if (!result.rowCount || (result.rows[0].email_verification_sent_at && Date.now() - new Date(result.rows[0].email_verification_sent_at).getTime() < 60000)) {
      await client.query('COMMIT');
      return res.json(generic);
    }
    const token = newToken();
    await client.query(
      `UPDATE users SET email_verification_token_hash = $1, email_verification_expires_at = NOW() + INTERVAL '24 hours',
         email_verification_sent_at = NOW() WHERE user_id = $2`, [hashToken(token), result.rows[0].user_id]
    );
    await sendVerificationEmail(email, token);
    await client.query('COMMIT');
    return res.json(generic);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Resend verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not send verification email.' });
  } finally { if (client) client.release(); }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

        if (!cleanEmail || typeof password !== 'string') {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Fetch ward_id for Councillors while authenticating by email only.
        const query = `
            SELECT
                u.user_id,
                u.full_name,
                u.email,
                u.role,
                u.password_hash,
                u.email_verified,
                u.is_active,
                COALESCE(u.ward_id, w.ward_id) AS ward_id
            FROM users u
            LEFT JOIN wards w ON w.councillor_id = u.user_id
            WHERE LOWER(u.email) = $1
        `;

        const userInput = await pool.query(query, [cleanEmail]);

        if (userInput.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = userInput.rows[0];
        if (user.is_active === false) {
            return res.status(403).json({ success: false, message: 'This account has been deactivated. Please contact the Master Admin.' });
        }
        const matchedPass = await bcrypt.compare(password, user.password_hash);

        if (!matchedPass) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (user.email_verified === false) {
            return res.status(403).json({ success: false, message: 'Please verify your email before signing in. Use Resend verification if needed.' });
        }

        const tokeninfo = {
            user_id: user.user_id,
            role: user.role,
            ward_id: user.ward_id || null
        };

        const token = jsonwebtoken.sign(tokeninfo, process.env.Jeson_Web_Token, { expiresIn: '1d' });

        return res.status(200).json({
            success: true,
            message: 'Successfully Logged In',
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                ward_id: user.ward_id || null
            }
        });
    } catch (error) {
        console.error('Login Error: ', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to log in'
        });
    }
})


router.get('/staff', verify, authorization('Master Admin'), async (req, res) => {
    try {
        const councillors = await pool.query(
            `SELECT u.user_id, u.full_name, u.email, u.ward_id, w.ward_number, w.corporation_code,
                COUNT(r.report_id) AS complaints_received,
                COUNT(r.report_id) FILTER (WHERE r.status = 'Resolved') AS complaints_resolved,
                COUNT(r.report_id) FILTER (WHERE r.status != 'Resolved') AS complaints_pending
             FROM users u
             LEFT JOIN reports r ON r.ward_id = u.ward_id
             LEFT JOIN wards w ON w.ward_id = u.ward_id
             WHERE u.role = 'Councillor' AND u.is_active = TRUE
             GROUP BY u.user_id, w.ward_id
             ORDER BY u.full_name`
        )

        const inspectors = await pool.query(
            `SELECT u.user_id, u.full_name, u.email, u.ward_id, w.ward_number, w.corporation_code,
                COUNT(r.report_id) FILTER (WHERE r.assigned_inspector_id = u.user_id) AS complaints_assigned,
                COUNT(r.report_id) FILTER (WHERE r.assigned_inspector_id = u.user_id AND r.status = 'Resolved') AS complaints_resolved
             FROM users u
             LEFT JOIN reports r ON r.assigned_inspector_id = u.user_id
             LEFT JOIN wards w ON w.ward_id = u.ward_id
             WHERE u.role = 'Inspector' AND u.is_active = TRUE
             GROUP BY u.user_id, w.ward_id
             ORDER BY u.full_name`
        )

        res.status(200).json({
            success: true,
            data: {
                councillors: councillors.rows,
                inspectors: inspectors.rows
            }
        })
    } catch (error) {
        console.error("Error occured while fetching staff list ", error.message)
        res.status(500).json({
            success: false,
            message: "Failed to get Councillor/Inspector list"
        })
    }
})


router.post('/create-staff', verify, authorization('Master Admin'), async (req, res) => {
    let client;

    try {
        client = await pool.connect();
        const {
            full_name, email, role, password, ward_id} = req.body;

        if (!['Councillor', 'Inspector'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "role must be either 'Councillor' or 'Inspector'"
            });
        }

        const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
        if (!cleanName || cleanName.length > 100) {
            return res.status(400).json({ success: false, message: 'Enter the staff member’s full name (maximum 100 characters).' });
        }

        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: 'A valid email address is required for staff accounts'
            });
        }

        const numericWardId = Number(ward_id);
        if (!Number.isSafeInteger(numericWardId) || numericWardId < 1) {
            return res.status(400).json({
                success: false,
                message: 'A valid positive numeric ward_id is required for staff accounts'
            });
        }

        if (!strongPassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Use 8–128 characters including at least 3 of: lowercase, uppercase, number, symbol.'
            });
        }

        await client.query('BEGIN');

        const wardResult = await client.query(
            `SELECT ward_id FROM wards WHERE ward_id = $1 FOR UPDATE`,
            [numericWardId]
        );

        if (wardResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Invalid ward_id'
            });
        }

        if (role === 'Councillor') {
            const currentCouncillor = await client.query(
                `SELECT u.user_id
                 FROM wards w
                 JOIN users u ON u.user_id = w.councillor_id
                 WHERE w.ward_id = $1 AND u.is_active = TRUE
                 FOR UPDATE OF w`,
                [numericWardId]
            );
            if (currentCouncillor.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    success: false,
                    message: 'This ward already has an active councillor. Deactivate the current councillor before creating a replacement.'
                });
            }
        }

        const password_hash = await bcrypt.hash(password, 12);

        const newStaff = await client.query(
            `INSERT INTO users
                (full_name, email, role, password_hash, ward_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING user_id, full_name, email, role, ward_id`,
            [
                cleanName, cleanEmail, role, password_hash, numericWardId
            ]
        );
        const user = newStaff.rows[0];

        if (role === 'Councillor') {
            await client.query(
                `UPDATE wards SET councillor_id = $1 WHERE ward_id = $2`,
                [user.user_id, numericWardId]
            );
        }

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: `${role} account created successfully`,
            data: user
        });

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        console.error(
            "Error occurred while creating staff account:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Error occurred while creating staff account"
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


module.exports = router;