const test = require('node:test');
const assert = require('node:assert/strict');

process.env.HOTSPOT_MIN_COMPLAINTS = '5';
process.env.HOTSPOT_DETECTION_RADIUS_METERS = '200';

const { evaluateHotspotForReport } = require('../services/hotspotService');

function createMockClient({ existing = [], count = 0, inserted = null, updated = null } = {}) {
  const calls = [];

  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('pg_advisory_xact_lock')) {
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('SELECT h.hotspot_id') && sql.includes('FROM hotspot_areas h')) {
        return { rows: existing, rowCount: existing.length };
      }

      if (sql.includes('UPDATE hotspot_areas AS h')) {
        return { rows: [updated], rowCount: 1 };
      }

      if (sql.includes('SELECT COUNT(*)::integer AS complaint_count')) {
        return { rows: [{ complaint_count: count }], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO hotspot_areas')) {
        return { rows: [inserted], rowCount: 1 };
      }

      throw new Error(`Unexpected query in test: ${sql}`);
    }
  };
}

const sampleLocation = {
  wardId: 1,
  longitude: 90.4,
  latitude: 23.8
};

test('skips hotspot evaluation if no ward was detected', async () => {
  const client = createMockClient();
  const result = await evaluateHotspotForReport(client, {
    ...sampleLocation,
    wardId: null
  });

  assert.equal(result.evaluated, false);
  assert.equal(result.reason, 'ward_not_detected');
  assert.equal(client.calls.length, 0);
});

test('does not create a hotspot below the configured threshold', async () => {
  const client = createMockClient({ count: 4 });
  const result = await evaluateHotspotForReport(client, sampleLocation);

  assert.equal(result.evaluated, true);
  assert.equal(result.threshold_reached, false);
  assert.equal(result.nearby_complaints, 4);
  assert.equal(result.threshold_count, 5);
  assert.equal(result.hotspot, null);
});

test('creates a hotspot when the configured threshold is reached', async () => {
  const hotspot = {
    hotspot_id: 12,
    ward_id: 1,
    latitude: 23.8,
    longitude: 90.4,
    complaint_count: 5,
    threshold_count: 5,
    detection_radius_meters: 200,
    status: 'Active'
  };
  const client = createMockClient({ count: 5, inserted: hotspot });
  const result = await evaluateHotspotForReport(client, sampleLocation);

  assert.equal(result.evaluated, true);
  assert.equal(result.threshold_reached, true);
  assert.equal(result.created, true);
  assert.equal(result.hotspot.hotspot_id, 12);
  assert.ok(client.calls.some(({ sql }) => sql.includes('INSERT INTO hotspot_areas')));
});

test('updates an existing nearby hotspot instead of creating a duplicate', async () => {
  const hotspot = {
    hotspot_id: 7,
    ward_id: 1,
    latitude: 23.8,
    longitude: 90.4,
    complaint_count: 6,
    threshold_count: 5,
    detection_radius_meters: 200,
    status: 'Active'
  };
  const client = createMockClient({
    existing: [{ hotspot_id: 7 }],
    updated: hotspot
  });
  const result = await evaluateHotspotForReport(client, sampleLocation);

  assert.equal(result.threshold_reached, true);
  assert.equal(result.created, false);
  assert.equal(result.hotspot.hotspot_id, 7);
  assert.ok(client.calls.some(({ sql }) => sql.includes('UPDATE hotspot_areas AS h')));
  assert.equal(client.calls.some(({ sql }) => sql.includes('INSERT INTO hotspot_areas')), false);
});

