const express = require('express');
const router = express.Router();
const pool = require('../config/db');

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

module.exports = router;
