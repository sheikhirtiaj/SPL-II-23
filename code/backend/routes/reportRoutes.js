const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const verify = require('../middleware/authmiddleware')
const authorization = require('../middleware/rolemiddleware')

const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');
const { evaluateHotspotForReport } = require('../services/hotspotService');
const { createAndSendMagistrateAlert } = require('../services/magistrateAlertService');

router.get('/', verify, async (req, res) => {
    try {
        const { role, user_id } = req.user;

        let query;
        let params = [];

        if (role === 'Master Admin') {

            query = `
                SELECT * FROM reports ORDER BY created_at DESC`;

        } else if (role === 'Councillor') {

            query = `
                SELECT r.* FROM reports r
                JOIN wards w ON r.ward_id = w.ward_id
                WHERE w.councillor_id = $1 AND r.status <> 'Rejected'
                ORDER BY r.created_at DESC
            `;
            params = [user_id];

        } else if (role === 'Inspector') {
            query = `
                SELECT r.* FROM reports r
                WHERE r.assigned_inspector_id = $1 AND r.status <> 'Rejected'
                ORDER BY r.created_at DESC
            `;
            params = [user_id];

          } else if (role === 'Citizen') {
            query = `
                SELECT
                    r.report_id, r.description, r.ward_id, w.ward_number, w.corporation_code,
                    r.before_photo_url, r.after_photo_url, r.status, r.created_at, r.updated_at,
                    r.councillor_note AS rejection_reason,
                    CASE
                        WHEN r.location IS NOT NULL THEN ST_Y(r.location)::double precision
                        ELSE NULL
                    END AS latitude,
                    CASE
                        WHEN r.location IS NOT NULL THEN ST_X(r.location)::double precision
                        ELSE NULL
                    END AS longitude
                FROM reports r
                LEFT JOIN wards w ON w.ward_id = r.ward_id
                WHERE r.citizen_user_id = $1
                ORDER BY r.created_at DESC
            `;
            params = [user_id];
        } else {
            return res.status(403).json({
                success: false,
                message: 'Access Denied'
            });
        }

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error(
            'Error fetching reports:',
            error.message
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to get the reports'
        });
    }
});


router.post(
  '/',
  verify,
  authorization('Citizen'),
  upload.single('before_photo'),
  async (req, res) => {
    let client;
    let transactionOpen = false;
    let reportCommitted = false;
    let uploadedPublicId = null;
    let citizenUserId = null;
    let longitude = null;
    let latitude = null;

    const getErrorMessage = (error) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      try {
        const serialized = JSON.stringify(error);
        return serialized === undefined ? String(error) : serialized;
      } catch (_) {
        return String(error);
      }
    };

    const findWard = async (db) => db.query(
      `
      SELECT ward_id, ward_number, corporation_code
      FROM wards
      WHERE ST_Covers(
        boundaries,
        ST_SetSRID(
          ST_MakePoint($1::double precision, $2::double precision),
          4326
        )
      )
      ORDER BY ward_id
      LIMIT 1
      `,
      [longitude, latitude]
    );

    const logWardDiagnostic = async (db) => {
      try {
        const diagnostic = await db.query(
          `SELECT
             current_database() AS database_name,
             COUNT(*)::integer AS ward_count,
             ST_Extent(boundaries)::text AS ward_extent
           FROM wards`
        );
        const row = diagnostic.rows[0] || {};
        const details = {
          database: row.database_name,
          wardCount: row.ward_count,
          wardExtent: row.ward_extent,
          coordinateOrder: 'longitude, latitude'
        };
        // Exact coordinates are useful in local debugging but should not be
        // written to production logs by default.
        if (process.env.NODE_ENV !== 'production') {
          details.longitude = longitude;
          details.latitude = latitude;
        }
        console.warn('[POST /api/reports] GPS point did not match a ward:', details);
      } catch (diagnosticError) {
        console.warn(
          '[POST /api/reports] Could not collect ward diagnostics:',
          getErrorMessage(diagnosticError)
        );
      }
    };

    try {
      const { description } = req.body || {};

      // The verified JWT must contain the database user's actual user_id.
      const rawUserId = req.user?.user_id;
      citizenUserId = Number(rawUserId);
      if (!Number.isSafeInteger(citizenUserId) || citizenUserId <= 0) {
        console.warn('[POST /api/reports] Verified token has no valid user_id claim:', {
          claimType: typeof rawUserId,
          role: req.user?.role
        });
        return res.status(401).json({
          success: false,
          message: 'Your session is invalid. Please log in again.'
        });
      }

      // Check the token's user against THIS database before uploading a photo.
      const authenticatedUserResult = await pool.query(
        'SELECT user_id, role, current_database() AS database_name FROM users WHERE user_id = $1',
        [citizenUserId]
      );

      if (authenticatedUserResult.rowCount === 0) {
        let connectedDatabase = null;
        try {
          const databaseResult = await pool.query('SELECT current_database() AS database_name');
          connectedDatabase = databaseResult.rows[0]?.database_name || null;
        } catch (_) {
          // Keep the primary authentication response even if diagnostics fail.
        }
        console.warn('[POST /api/reports] Token user_id does not exist in the connected database:', {
          userId: citizenUserId,
          database: connectedDatabase
        });
        return res.status(401).json({
          success: false,
          message: 'Your account could not be verified. Please log out and log in again.'
        });
      }

      if (authenticatedUserResult.rows[0].role !== 'Citizen') {
        console.warn('[POST /api/reports] Token role does not match the database role:', {
          userId: citizenUserId,
          tokenRole: req.user?.role,
          databaseRole: authenticatedUserResult.rows[0].role,
          database: authenticatedUserResult.rows[0].database_name
        });
        return res.status(403).json({
          success: false,
          message: 'Only an authenticated citizen can submit a report.'
        });
      }

      // Fast preflight: avoid uploading a photo if the daily limit is already reached.
      // The authoritative, concurrency-safe check is made inside the transaction below.
      const recentCount = await pool.query(
        `SELECT COUNT(*)::integer AS count FROM reports
         WHERE citizen_user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [citizenUserId]
      );
      if (recentCount.rows[0].count >= 3) {
        return res.status(429).json({
          success: false,
          code: 'DAILY_REPORT_LIMIT',
          message: 'You can submit at most 3 complaints in a rolling 24-hour period. Please try again later.'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Before photo was not received'
        });
      }

      const longitudeRaw = req.body?.longitude;
      const latitudeRaw = req.body?.latitude;

      if (
        longitudeRaw === undefined || String(longitudeRaw).trim() === '' ||
        latitudeRaw === undefined || String(latitudeRaw).trim() === ''
      ) {
        return res.status(400).json({
          success: false,
          message: 'Location is required. Send longitude and latitude.'
        });
      }

      longitude = Number(longitudeRaw);
      latitude = Number(latitudeRaw);

      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 || longitude > 180 ||
        latitude < -90 || latitude > 90
      ) {
        return res.status(400).json({
          success: false,
          message: 'Valid GPS coordinates are required. Longitude must be between -180 and 180 and latitude between -90 and 90.'
        });
      }

      if (!req.file.mimetype?.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'The before photo must be an image'
        });
      }

      // Preflight the spatial lookup before uploading to Cloudinary.
      // The provided test point (90.360769, 23.782773) should match DNCC ward 11
      // in the supplied database output.
      const preflightWardResult = await findWard(pool);
      if (preflightWardResult.rowCount === 0) {
        await logWardDiagnostic(pool);
        return res.status(422).json({
          success: false,
          message: 'No supported ward contains this GPS location. Please verify the captured location and try again.'
        });
      }

      const cloudinaryResult = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        { folder: 'hazard_reports', resource_type: 'image' }
      );
      const before_photo_url = cloudinaryResult.secure_url;
      uploadedPublicId = cloudinaryResult.public_id || null;

      client = await pool.connect();
      await client.query('BEGIN');
      transactionOpen = true;

      // Re-check and lock the account inside the transaction to prevent a
      // deleted/stale account from reaching the report INSERT.
      const lockedUserResult = await client.query(
        `SELECT user_id, role, is_active
         FROM users
         WHERE user_id = $1
         FOR UPDATE`,
        [citizenUserId]
      );

      if (lockedUserResult.rowCount === 0) {
        const accountError = new Error('Citizen account no longer exists. Please log in again.');
        accountError.statusCode = 401;
        accountError.publicMessage = 'Your account could not be verified. Please log out and log in again.';
        throw accountError;
      }

      if (lockedUserResult.rows[0].is_active === false) {
        const accountError = new Error('Citizen account is inactive.');
        accountError.statusCode = 403;
        accountError.publicMessage = 'This account is inactive. Please contact the Master Admin.';
        throw accountError;
      }

      if (lockedUserResult.rows[0].role !== 'Citizen') {
        const roleError = new Error('Authenticated account is not a Citizen.');
        roleError.statusCode = 403;
        roleError.publicMessage = 'Only an authenticated citizen can submit a report.';
        throw roleError;
      }

      // Serialize submissions from the same citizen using the locked user row.
      // Count *all* submitted reports, including later-rejected ones, in the last 24 hours.
      const quotaCheck = await client.query(
        `SELECT COUNT(*)::integer AS count FROM reports
         WHERE citizen_user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [citizenUserId]
      );
      if (quotaCheck.rows[0].count >= 3) {
        const limitError = new Error('Rolling 24-hour complaint limit reached.');
        limitError.statusCode = 429;
        limitError.code = 'DAILY_REPORT_LIMIT';
        limitError.publicMessage = 'You can submit at most 3 complaints in a rolling 24-hour period. Please try again later.';
        throw limitError;
      }

      // Re-run the lookup on the same transaction connection before inserting.
      const wardResult = await findWard(client);
      if (wardResult.rowCount === 0) {
        await logWardDiagnostic(client);
        const wardError = new Error('GPS point did not match any ward boundary.');
        wardError.statusCode = 422;
        wardError.publicMessage = 'No supported ward contains this GPS location. Please verify the captured location and try again.';
        throw wardError;
      }

      const detectedWard = wardResult.rows[0];
      const detectedWardId = detectedWard.ward_id;

      console.log('[POST /api/reports] Ward detected:', {
        corporation: detectedWard.corporation_code,
        wardNumber: detectedWard.ward_number,
        wardId: detectedWardId
      });

      const newReport = await client.query(
        `
        INSERT INTO reports
          (citizen_user_id, description, location, ward_id, before_photo_url, after_photo_url, status, created_at, updated_at)
        VALUES
          ($1, $2, ST_SetSRID(ST_MakePoint($3::double precision, $4::double precision), 4326), $5, $6, NULL, 'Pending', NOW(), NOW())
        RETURNING *
        `,
        [citizenUserId, description || null, longitude, latitude, detectedWardId, before_photo_url]
      );

      let hotspotDetection = {
        evaluated: false,
        reason: 'not_evaluated',
        threshold_reached: false,
        hotspot: null
      };

      // Hotspot detection is isolated by a savepoint. If it fails, the report
      // can still be committed without losing the main complaint.
      await client.query('SAVEPOINT hotspot_detection');
      try {
        hotspotDetection = await evaluateHotspotForReport(client, {
          wardId: detectedWardId,
          longitude,
          latitude
        });
        await client.query('RELEASE SAVEPOINT hotspot_detection');
      } catch (hotspotError) {
        try {
          await client.query('ROLLBACK TO SAVEPOINT hotspot_detection');
          await client.query('RELEASE SAVEPOINT hotspot_detection');
        } catch (savepointError) {
          console.error(
            '[POST /api/reports] Could not recover from hotspot detection error:',
            getErrorMessage(savepointError)
          );
          throw savepointError;
        }

        console.error(
          '[POST /api/reports] Hotspot detection failed; report will still be saved:',
          getErrorMessage(hotspotError)
        );
        hotspotDetection = {
          evaluated: false,
          reason: 'detection_unavailable',
          threshold_reached: false,
          hotspot: null
        };
      }

      await client.query('COMMIT');
      transactionOpen = false;
      reportCommitted = true;

      client.release();
      client = null;

      let magistrateAlert = null;
      if (hotspotDetection.created === true && hotspotDetection.hotspot?.hotspot_id) {
        try {
          const alertResult = await createAndSendMagistrateAlert(
            hotspotDetection.hotspot.hotspot_id
          );
          magistrateAlert = {
            status: alertResult.status,
            delivery_channel: alertResult.delivery_channel || null,
            expires_at: alertResult.expires_at || null,
            reason: alertResult.reason || null
          };
        } catch (alertError) {
          // Notification failure must never undo a successfully saved report.
          console.error(
            '[POST /api/reports] Magistrate escalation failed after report commit:',
            getErrorMessage(alertError)
          );
          magistrateAlert = {
            status: 'failed',
            delivery_channel: null,
            expires_at: null,
            reason: 'escalation_unavailable'
          };
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: newReport.rows[0],
        hotspot_detection: hotspotDetection,
        magistrate_alert: magistrateAlert
      });
    } catch (error) {
      if (client && transactionOpen) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error(
            '[POST /api/reports] Transaction rollback failed:',
            rollbackError?.message || String(rollbackError)
          );
        }
        transactionOpen = false;
      }

      const errorDetails = {
        message: getErrorMessage(error),
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
        table: error?.table,
        column: error?.column,
        userId: citizenUserId
      };
      if (process.env.NODE_ENV !== 'production') {
        errorDetails.longitude = longitude;
        errorDetails.latitude = latitude;
        errorDetails.stack = error?.stack;
      }
      console.error('[POST /api/reports] Report creation failed:', errorDetails);

      if (uploadedPublicId && !reportCommitted) {
        try {
          await cloudinary.uploader.destroy(uploadedPublicId, { resource_type: 'image' });
        } catch (cleanupError) {
          console.error(
            '[POST /api/reports] Could not clean up unused Cloudinary image:',
            getErrorMessage(cleanupError)
          );
        }
      }

      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          ...(error.code === 'DAILY_REPORT_LIMIT' ? { code: error.code } : {}),
          message: error.publicMessage || 'Report submission could not be completed.'
        });
      }

      if (error?.code === '23503' && error?.constraint === 'reports_citizen_user_id_fkey') {
        return res.status(401).json({
          success: false,
          message: 'Your account could not be verified. Please log out and log in again.'
        });
      }

      if (error?.code === '23503' && error?.constraint === 'reports_ward_id_fkey') {
        return res.status(422).json({
          success: false,
          message: 'The detected ward is no longer available. Please retry the report.'
        });
      }

      return res.status(500).json({
        success: false,
        message: "Couldn't save report. Please try again."
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
  '/councillor',
  verify,
  authorization('Councillor','Master Admin'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          r.*,
          ST_Y(r.location) AS latitude,
          ST_X(r.location) AS longitude,
          w.ward_number, w.corporation_code,
          ROUND(ST_Distance(r.location::geography, r.cleanup_location::geography)::numeric, 1) AS cleanup_distance_meters
        FROM reports r
        JOIN wards w ON w.ward_id = r.ward_id
        WHERE ( $1 = 'Master Admin' OR w.councillor_id = $2 )
          AND r.status <> 'Rejected'
        ORDER BY r.created_at DESC
        `,
        [req.user.role, req.user.user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: 'Failed to load councillor complaints'
      });
    }
  }
);

// Councillor rejection: soft status change; preserve the report for citizen history/audit.
// This is NOT the existing cleanup-verification rejection / reassignment workflow.
router.patch(
  '/:id/reject',
  verify,
  authorization('Councillor'),
  async (req, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isSafeInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });
    }

    const note = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const allowedReasons = ['Duplicate', 'Fake', 'Vague', 'Not a breeding site', 'Outside ward', 'Other'];
    const category = allowedReasons.find((reason) => note === reason || note.startsWith(`${reason}: `));
    if (!note || note.length > 500 || !category || (category === 'Other' && note.replace(/^Other:\s*/, '').trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'A valid rejection reason is required: Duplicate, Fake, Vague, Not a breeding site, Outside ward, or Other (with explanation). Maximum 500 characters.' });
    }

    try {
      // Only a councillor for this ward may reject an unassigned complaint.
      // Already assigned/verified tasks cannot be discarded by this action.
      const result = await pool.query(
        `UPDATE reports AS r
         SET status = 'Rejected',
             councillor_note = $3,
             updated_at = NOW()
         WHERE r.report_id = $1
           AND r.status IN ('Pending', 'Re-assigned')
           AND EXISTS (
             SELECT 1 FROM wards w
             WHERE w.ward_id = r.ward_id AND w.councillor_id = $2
           )
         RETURNING r.report_id, r.status, r.updated_at`,
        [reportId, req.user.user_id, note]
      );
      if (result.rowCount === 0) {
        return res.status(409).json({
          success: false,
          message: 'Complaint cannot be rejected. It may be assigned, resolved, already rejected, or outside your ward.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Complaint rejected. The citizen can see its Rejected status.',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Complaint rejection failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Could not reject complaint. Check the database migration and try again.'
      });
    }
  }
);

router.get(
  '/:id',
  verify,
  authorization('Councillor', 'Inspector','Master Admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
      SELECT
        r.*,
        
        -- Citizen complaint location
        ST_Y(r.location) AS latitude,
        ST_X(r.location) AS longitude,

        -- Inspector cleanup location
        ST_Y(r.cleanup_location) AS cleanup_latitude,
        ST_X(r.cleanup_location) AS cleanup_longitude,

        -- Straight-line distance between Citizen GPS
        -- and Inspector cleanup GPS, in meters
        ROUND(
          ST_Distance(
            r.location::geography,
            r.cleanup_location::geography
          )::numeric,
          1
        ) AS cleanup_distance_meters,

        w.ward_number,
        w.corporation_code
        FROM reports r
        JOIN wards w ON w.ward_id = r.ward_id
        WHERE r.report_id = $1
        AND (
            $2 = 'Master Admin'
            OR (
                $2 = 'Councillor'
                AND w.councillor_id = $3
            )
            OR (
                $2 = 'Inspector'
                AND r.assigned_inspector_id = $3
            )
        )
        LIMIT 1
        `,
        [id, req.user.role ,req.user.user_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found in your ward'
        });
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: 'Failed to load complaint'
      });
    }
  }
);


router.patch( '/:id', verify, authorization('Inspector'), upload.single('after_photo'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const inspectorId = req.user.user_id;

      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      const inspectorComment = typeof req.body.inspector_comment === 'string' ? req.body.inspector_comment.trim() : '';
      if (inspectorComment.length > 1000) {
        return res.status(400).json({ success: false, message: 'Inspector comment cannot exceed 1000 characters.' });
      }

      // 1. After-photo is required
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Cleanup photo is required'
        });
      }

      // 2. Make sure uploaded file is actually an image
      if (!req.file.mimetype?.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded cleanup evidence must be an image'
        });
      }

      // 3. GPS is required
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: 'Valid cleanup GPS location is required'
        });
      }

      // 4. Make sure this complaint is actually assigned
      //    to the currently logged-in Inspector
      const assignedReport = await pool.query(
        `
        SELECT report_id, status FROM reports
        WHERE report_id = $1
          AND assigned_inspector_id = $2
        LIMIT 1
        `,
        [id, inspectorId]
      );

      if (assignedReport.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assigned complaint not found'
        });
      }

      if (assignedReport.rows[0].status !== 'Assigned') {
        return res.status(409).json({
          success: false,
          message: 'Cleanup evidence can only be submitted for an assigned complaint'
        });
      }

      // 5. Upload AFTER photo to Cloudinary
      const cloudinaryResult = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        {
          folder: 'hazard_reports/cleanup_evidence',
          resource_type: 'image'
        }
      );

      // 6. Save Cloudinary URL + cleanup GPS + timestamp
      //    and move complaint to Pending Verification
      const updateReport = await pool.query(
        `
        UPDATE reports
        SET
          after_photo_url = $1,
          cleanup_location = ST_SetSRID(
            ST_MakePoint($2::float, $3::float),
            4326
          ),
          cleanup_submitted_at = NOW(),
          inspector_comment = $6,
          status = 'Pending Verification',
          updated_at = NOW()
        WHERE report_id = $4
          AND assigned_inspector_id = $5
          AND status = 'Assigned'
        RETURNING *
        `,
        [
          cloudinaryResult.secure_url,
          longitude,
          latitude,
          id,
          inspectorId,
          inspectorComment || null
        ]
      );

      if (updateReport.rowCount === 0) {
        return res.status(409).json({
          success: false,
          message: 'Complaint could not be updated'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Cleanup evidence submitted successfully',
        data: updateReport.rows[0]
      });

    } catch (error) {
      console.error('Cleanup evidence submission error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to submit cleanup evidence'
      });
    }
  }
);

router.patch(
  '/:id/assign', verify, authorization('Councillor','Master Admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { inspector_id } = req.body;

      if (!inspector_id) {
        return res.status(400).json({
          success: false,
          message: 'Inspector ID is required'
        });
      }

      // Make sure selected user is actually an Inspector

      const inspector = await pool.query(
          `
          SELECT u.user_id FROM users u
          JOIN wards w ON w.ward_id = u.ward_id WHERE u.user_id = $1 AND u.role = 'Inspector' AND u.is_active = TRUE AND ($3 = 'Master Admin' OR w.councillor_id = $2)
          `,
          [inspector_id, req.user.user_id, req.user.role]
      );


      if (inspector.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Inspector'
        });
      }

      // Assign ONLY if complaint belongs to this Councillor's ward
      const result = await pool.query(
        `
        UPDATE reports AS r
        SET
          assigned_inspector_id = $1, status = 'Assigned', updated_at = NOW()
        WHERE r.report_id = $2
          AND r.status IN ('Pending', 'Re-assigned')
        AND (
          $4 = 'Master Admin'
          OR EXISTS (
            SELECT 1 FROM wards w WHERE w.ward_id = r.ward_id AND w.councillor_id = $3
          )
        )
        RETURNING r.*
        `,
        [
          inspector_id,
          id,
          req.user.user_id,
          req.user.role
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found in your ward or cannot be assigned'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Inspector assigned successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Assignment error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to assign Inspector'
      });
    }
  }
);

router.patch('/:id/verify', verify, authorization('Councillor', 'Master Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved, Councillors_note } = req.body;

        
        if (typeof is_approved !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_approved must be true or false'
            });
        }

        const newStatus = is_approved ? 'Resolved' : 'Re-assigned';

        // Added councillor_note to the query

      const updated_reports = await pool.query(
          `
          UPDATE reports AS r
          SET
              status = $1, councillor_note = $2, updated_at = NOW()
          WHERE r.report_id = $3 AND r.status = 'Pending Verification'
            AND (
                $4 = 'Master Admin'
                OR EXISTS (
                    SELECT 1 FROM wards w
                    WHERE w.ward_id = r.ward_id AND w.councillor_id = $5
                )
            )
          RETURNING r.*
          `,
          [
              newStatus,
              Councillors_note || null,
              id,
              req.user.role,
              req.user.user_id
          ]
      );


        //  RowCount is the proper way to check if the update worked
        if (updated_reports.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Report is not ready for verification or does not exist."
            });
        }

        const message = is_approved ? "Cleanup verified & Hazard Resolved" : "Cleanup rejected & Re-assigned the task";

        res.status(200).json({
            success: true,
            message,
            data: updated_reports.rows[0]
        });

    } catch (error) {
        console.error("Verification Error: ", error.message);
        res.status(500).json({
            success: false,
            message: "Error occurred while verifying the task"
        });
    }
});

module.exports = router