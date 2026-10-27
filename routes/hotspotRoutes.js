const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verify = require('../middleware/authmiddleware');
const authorization = require('../middleware/rolemiddleware');
const { createAndSendMagistrateAlert } = require('../services/magistrateAlertService');
const { findNearbyHotspots } = require('../services/proximityAlertService');

// Public, read-only endpoint so the PWA can display active hotspot areas.
router.get('/', async (req, res) => {
  try {
    const params = [];
    let wardFilter = '';

    if (req.query.ward_id !== undefined) {
      const wardId = Number(req.query.ward_id);

      if (!Number.isSafeInteger(wardId) || wardId < 1) {
        return res.status(400).json({
          success: false,
          message: 'ward_id must be a positive integer'
        });
      }

      params.push(wardId);
      wardFilter = 'AND h.ward_id = $1';
    }

    const result = await pool.query(
      `
      SELECT
        h.hotspot_id, h.ward_id, w.ward_number, w.corporation_code,
        ST_Y(h.center_location) AS latitude,
        ST_X(h.center_location) AS longitude,
        h.complaint_count, h.threshold_count, h.detection_radius_meters, h.status, h.created_at, h.updated_at, h.last_report_at
      FROM hotspot_areas h
      JOIN wards w ON w.ward_id = h.ward_id
      WHERE h.status = 'Active'
        ${wardFilter}
      ORDER BY h.complaint_count DESC, h.updated_at DESC
      `,
      params
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching hotspot areas:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hotspot areas'
    });
  }
});


// Public endpoint for the PWA to check whether the current device location is
// within 200 metres (configurable server-side) of any active hotspot.
// Example: GET /api/hotspots/nearby?latitude=23.8103&longitude=90.4125
router.get('/nearby', async (req, res) => {
  try {
    const result = await findNearbyHotspots({
      latitude: req.query.latitude,
      longitude: req.query.longitude
    });

    return res.status(200).json({
      success: true,
      radius_meters: result.radius_meters,
      count: result.count,
      data: result.data
    });
  } catch (error) {
    if (error.code === 'INVALID_COORDINATES') {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error('Error checking nearby hotspots:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check nearby hotspot areas'
    });
  }
});


// Master Admin can manually retry/reissue the email alert after fixing SMTP configuration.
// A new token is generated and the previous link is invalidated.
router.post('/:id/magistrate-alert', verify, authorization('Master Admin'), async (req, res) => {
  const hotspotId = Number(req.params.id);
  if (!Number.isSafeInteger(hotspotId) || hotspotId < 1) {
    return res.status(400).json({
      success: false,
      message: 'Hotspot ID must be a positive integer'
    });
  }

  try {
    const result = await createAndSendMagistrateAlert(hotspotId);
    if (result.status !== 'sent') {
      return res.status(502).json({
        success: false,
        message: 'Magistrate email notification failed; check SMTP configuration',
        status: result.status
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Magistrate email notification sent',
      data: {
        alert_id: result.alert_id,
        delivery_channel: result.delivery_channel,
        expires_at: result.expires_at
      }
    });
  } catch (error) {
    if (error.code === 'HOTSPOT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Hotspot area not found' });
    }
    if (error.code === 'HOTSPOT_NOT_ACTIVE') {
      return res.status(409).json({ success: false, message: 'Only active hotspot areas can be escalated' });
    }

    console.error('Manual Magistrate alert failed:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send Magistrate alert' });
  }
});

module.exports = router;
