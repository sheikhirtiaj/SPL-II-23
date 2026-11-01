const DEFAULT_PROXIMITY_RADIUS_METERS = 200;

function makeInputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_COORDINATES';
  return error;
}

function parseCoordinate(value, name, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw makeInputError(`${name} is required`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw makeInputError(`${name} must be a number between ${minimum} and ${maximum}`);
  }

  return parsed;
}

function getProximityRadiusMeters() {
  const raw = process.env.HOTSPOT_PROXIMITY_ALERT_RADIUS_METERS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PROXIMITY_RADIUS_METERS;
  }

  const radius = Number(raw);
  if (!Number.isSafeInteger(radius) || radius < 1 || radius > 50000) {
    throw new Error('HOTSPOT_PROXIMITY_ALERT_RADIUS_METERS must be an integer between 1 and 50000');
  }
  return radius;
}

/**
 * Finds active hotspot areas within the configured proximity radius.
 * The caller's location is used only for this query and is not persisted.
 * db is injectable to make unit testing possible without a live database.
 */
async function findNearbyHotspots({ latitude, longitude }, db) {
  const lat = parseCoordinate(latitude, 'latitude', -90, 90);
  const lon = parseCoordinate(longitude, 'longitude', -180, 180);
  const radiusMeters = getProximityRadiusMeters();
  const queryPool = db || require('../config/db');

  const result = await queryPool.query(
    `
    SELECT
      h.hotspot_id, h.ward_id, w.ward_number, w.corporation_code,
      ST_Y(h.center_location) AS latitude,
      ST_X(h.center_location) AS longitude,
      ROUND(
        ST_Distance(
          h.center_location::geography,
          ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography
        )::numeric,
        1
      )::double precision AS distance_meters,
      h.complaint_count, h.threshold_count, h.detection_radius_meters, h.status, h.updated_at
    FROM hotspot_areas h
    JOIN wards w ON w.ward_id = h.ward_id
    WHERE h.status = 'Active'
      AND ST_DWithin(
        h.center_location::geography,
        ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography,
        $3::double precision
      )
    ORDER BY distance_meters ASC, h.hotspot_id ASC
    `,
    [lon, lat, radiusMeters]
  );

  return {
    radius_meters: radiusMeters,
    count: result.rowCount,
    data: result.rows
  };
}

module.exports = {
  findNearbyHotspots,
  getProximityRadiusMeters,
  parseCoordinate
};
