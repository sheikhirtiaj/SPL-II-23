const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const verify = require('../middleware/authmiddleware')
const authorization = require('../middleware/rolemiddleware')

const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');


router.get('/', verify, async (req, res) => {
    try {
        const { role, user_id } = req.user;

        let query;
        let params = [];

        if (role === 'Master Admin') {

            query = `
                SELECT * FROM report ORDER BY created_at DESC`;

        } else if (role === 'Councillor') {

            query = `
                SELECT r.* FROM reports r
                JOIN wards w ON r.ward_id = w.ward_id WHERE w.councillor_id = $1 ORDER BY r.created_at DESC
            `;
            params = [user_id];

        } else if (role === 'Inspector') {
            query = `
                SELECT r.* FROM reports r
                WHERE r.assigned_inspector_id = $1 ORDER BY r.created_at DESC
            `;
            params = [user_id];

        } else if (role === 'Citizen') {
            // Return only public complaint fields.
            query = `
                SELECT
                    report_id, description, ward_id, before_photo_url, after_photo_url, status, created_at, updated_at
                FROM reports
                ORDER BY created_at DESC
            `;
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


router.post('/', upload.single('before_photo'), async (req, res) => {
  try {

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const { description, longitude, latitude } = req.body;
    
    if (!req.file) {
        return res.status(400).json({
        success: false,
        message: "Before photo was not received"
    });
    }

    if (!longitude || !latitude) {
    return res.status(400).json({
        success: false,
        message: "Location is required"
    });
    }


    let before_photo_url = null;

    if (req.file) {
    const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        {
        folder: "hazard_reports",
        }
    );

    before_photo_url = result.secure_url;
    }

    const wardResult = await pool.query(
        `
        SELECT ward_id, ward_number, corporation_code
        FROM wards
        WHERE ST_Covers(
            boundaries,
            ST_SetSRID(
            ST_MakePoint($1::float, $2::float),
            4326
            )
        )
        LIMIT 1
        `,
        [longitude, latitude]
        );

        let detectedWardId = null;

        if (wardResult.rowCount > 0) {
        detectedWardId = wardResult.rows[0].ward_id;

        console.log(
            "Ward detected:",
            wardResult.rows[0].corporation_code,
            "Ward",
            wardResult.rows[0].ward_number
        );
        } else {
        console.log("No ward found for submitted GPS location");
        }

    const newReport = await pool.query(
    `
    INSERT INTO reports
    (description, location, ward_id, before_photo_url, after_photo_url, status, created_at, updated_at)
    VALUES
    ($1, ST_SetSRID(ST_MakePoint($2::float, $3::float),4326),$4,$5,NULL,'Pending',NOW(),NOW())
    RETURNING *
    `,
    [
        description, longitude, latitude, detectedWardId, before_photo_url
    ]
    );

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: newReport.rows[0],
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Couldn't save report",
    });
  }
});


router.get(
  '/councillor',
  verify,
  authorization('Councillor'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          r.*,
          ST_Y(r.location) AS latitude,
          ST_X(r.location) AS longitude,
          w.ward_number,
          w.corporation_code
        FROM reports r
        JOIN wards w ON w.ward_id = r.ward_id
        WHERE w.councillor_id = $1
        ORDER BY r.created_at DESC
        `,
        [req.user.user_id]
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

router.get(
  '/:id',
  verify,
  authorization('Councillor', 'Inspector'),
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
            (
            $2 = 'Councillor'
            AND w.councillor_id = $3
            )
            OR
            (
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
          inspectorId
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
  '/:id/assign', verify, authorization('Councillor'),
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
          JOIN wards w ON w.ward_id = u.ward_id WHERE u.user_id = $1 AND u.role = 'Inspector' AND w.councillor_id = $2
          `,
          [inspector_id, req.user.user_id]
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
          AND EXISTS (
            SELECT 1 
            FROM wards w
            WHERE w.ward_id = r.ward_id
              AND w.councillor_id = $3
          )
        RETURNING r.*
        `,
        [
          inspector_id,
          id,
          req.user.user_id
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