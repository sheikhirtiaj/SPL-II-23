const HOTSPOT_LOCK_NAMESPACE = 742031;

function readPositiveInteger(name, fallback, minimum = 1) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
}

function getHotspotConfig() {
  return {
    minimumComplaints: readPositiveInteger('HOTSPOT_MIN_COMPLAINTS', 5, 2),
    detectionRadiusMeters: readPositiveInteger(
      'HOTSPOT_DETECTION_RADIUS_METERS',
      200,
      1
    )
  };
}

/**
 * Evaluates the area around a newly inserted report.
 * Must be called inside the transaction that inserted the report.
 * Counts are isolated by ward_id; geography distance is measured in meters.
 */
async function evaluateHotspotForReport(client, { wardId, longitude, latitude }) {
  if (!wardId) {
    return {
      evaluated: false,
      reason: 'ward_not_detected',
      threshold_reached: false,
      hotspot: null
    };
  }

  const { minimumComplaints, detectionRadiusMeters } = getHotspotConfig();

  // Serialize hotspot checks within a ward so simultaneous submissions do not
  // create duplicate hotspot records for the same area.
  await client.query(
    'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
    [HOTSPOT_LOCK_NAMESPACE, Number(wardId)]
  );

  const existingHotspot = await client.query(
    `
    SELECT h.hotspot_id
    FROM hotspot_areas h
    WHERE h.ward_id = $1
      AND h.status = 'Active'
      AND ST_DWithin(
        h.center_location::geography,
        ST_SetSRID(
          ST_MakePoint($2::double precision, $3::double precision),
          4326
        )::geography,
        $4::double precision
      )
    ORDER BY
      ST_Distance(
        h.center_location::geography,
        ST_SetSRID(
          ST_MakePoint($2::double precision, $3::double precision),
          4326
        )::geography
      ),
      h.hotspot_id
    LIMIT 1
    `,
    [wardId, longitude, latitude, detectionRadiusMeters]
  );

  if (existingHotspot.rowCount > 0) {
    const updated = await client.query(
      `
      UPDATE hotspot_areas AS h
      SET
        complaint_count = (
          SELECT COUNT(*)::integer
          FROM reports r
          WHERE r.ward_id = h.ward_id
            AND r.location IS NOT NULL
            AND ST_DWithin(
              r.location::geography,
              h.center_location::geography,
              $2::double precision
            )
        ),
        threshold_count = $3,
        detection_radius_meters = $2,
        last_report_at = NOW(),
        updated_at = NOW()
      WHERE h.hotspot_id = $1
      RETURNING
        h.hotspot_id,
        h.ward_id,
        ST_Y(h.center_location) AS latitude,
        ST_X(h.center_location) AS longitude,
        h.complaint_count,
        h.threshold_count,
        h.detection_radius_meters,
        h.status,
        h.created_at,
        h.updated_at,
        h.last_report_at
      `,
      [existingHotspot.rows[0].hotspot_id, detectionRadiusMeters, minimumComplaints]
    );

    return {
      evaluated: true,
      threshold_reached: true,
      created: false,
      nearby_complaints: Number(updated.rows[0].complaint_count),
      threshold_count: minimumComplaints,
      detection_radius_meters: detectionRadiusMeters,
      hotspot: updated.rows[0]
    };
  }

  const countResult = await client.query(
    `
    SELECT COUNT(*)::integer AS complaint_count
    FROM reports r
    WHERE r.ward_id = $1
      AND r.location IS NOT NULL
      AND ST_DWithin(
        r.location::geography,
        ST_SetSRID(
          ST_MakePoint($2::double precision, $3::double precision),
          4326
        )::geography,
        $4::double precision
      )
    `,
    [wardId, longitude, latitude, detectionRadiusMeters]
  );

  const nearbyComplaints = Number(countResult.rows[0].complaint_count);

  if (nearbyComplaints < minimumComplaints) {
    return {
      evaluated: true,
      threshold_reached: false,
      created: false,
      nearby_complaints: nearbyComplaints,
      threshold_count: minimumComplaints,
      detection_radius_meters: detectionRadiusMeters,
      hotspot: null
    };
  }

  const inserted = await client.query(
    `
    INSERT INTO hotspot_areas
      (
        ward_id,
        center_location,
        complaint_count,
        threshold_count,
        detection_radius_meters,
        status,
        created_at,
        updated_at,
        last_report_at
      )
    VALUES
      (
        $1,
        ST_SetSRID(
          ST_MakePoint($2::double precision, $3::double precision),
          4326
        ),
        $4,
        $5,
        $6,
        'Active',
        NOW(),
        NOW(),
        NOW()
      )
    RETURNING
      hotspot_id,
      ward_id,
      ST_Y(center_location) AS latitude,
      ST_X(center_location) AS longitude,
      complaint_count,
      threshold_count,
      detection_radius_meters,
      status,
      created_at,
      updated_at,
      last_report_at
    `,
    [
      wardId,
      longitude,
      latitude,
      nearbyComplaints,
      minimumComplaints,
      detectionRadiusMeters
    ]
  );

  return {
    evaluated: true,
    threshold_reached: true,
    created: true,
    nearby_complaints: nearbyComplaints,
    threshold_count: minimumComplaints,
    detection_radius_meters: detectionRadiusMeters,
    hotspot: inserted.rows[0]
  };
}

module.exports = {
  evaluateHotspotForReport,
  getHotspotConfig
};
