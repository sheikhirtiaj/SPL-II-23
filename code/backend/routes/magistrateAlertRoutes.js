const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { hashToken } = require('../services/magistrateAlertService');

// This route is intentionally public: possession of the high-entropy token is
// the access credential. The token itself is never stored in the database.
router.get('/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex, nofollow');

  try {
    const { token } = req.params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(404).json({ success: false, message: 'Alert link is invalid or unavailable' });
    }

    const result = await pool.query(
      `
      SELECT
        l.expires_at, l.notification_status, h.hotspot_id, h.ward_id, w.ward_number, w.corporation_code, ST_Y(h.center_location) AS latitude, ST_X(h.center_location) AS longitude,
        h.complaint_count, h.threshold_count, h.detection_radius_meters, h.status, h.created_at, h.updated_at, h.last_report_at
      FROM magistrate_alert_links l
      JOIN hotspot_areas h ON h.hotspot_id = l.hotspot_id
      JOIN wards w ON w.ward_id = h.ward_id
      WHERE l.token_hash = $1
      LIMIT 1
      `,
      [hashToken(token)]
    );

    if (result.rowCount === 0 || result.rows[0].notification_status !== 'sent') {
      return res.status(404).json({ success: false, message: 'Alert link is invalid or unavailable' });
    }

    const alert = result.rows[0];
    if (new Date(alert.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ success: false, message: 'Alert link has expired' });
    }

    const complaints = await pool.query(
      `
      SELECT
        r.report_id, r.description, r.status, r.before_photo_url, r.created_at,
        ST_Y(r.location) AS latitude,
        ST_X(r.location) AS longitude
      FROM reports r
      JOIN hotspot_areas h ON h.hotspot_id = $1
      WHERE r.ward_id = h.ward_id
        AND r.location IS NOT NULL
        AND ST_DWithin(
          r.location::geography,
          h.center_location::geography,
          h.detection_radius_meters::double precision
        )
      ORDER BY r.created_at DESC
      LIMIT 100
      `,
      [alert.hotspot_id]
    );

    return res.status(200).json({
      success: true,
      expires_at: alert.expires_at,
      hotspot: {
        hotspot_id: alert.hotspot_id,
        ward_id: alert.ward_id,
        ward_number: alert.ward_number,
        corporation_code: alert.corporation_code,
        latitude: alert.latitude,
        longitude: alert.longitude,
        complaint_count: alert.complaint_count,
        threshold_count: alert.threshold_count,
        detection_radius_meters: alert.detection_radius_meters,
        status: alert.status,
        created_at: alert.created_at,
        updated_at: alert.updated_at,
        last_report_at: alert.last_report_at
      },
      complaints: complaints.rows,
      complaints_returned: complaints.rowCount,
      complaints_limit: 100
    });
  } catch (error) {
    console.error('Magistrate alert link lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to load hotspot alert details' });
  }
});

module.exports = router;
