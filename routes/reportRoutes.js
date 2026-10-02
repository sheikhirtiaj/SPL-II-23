const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const verify = require('../middleware/authmiddleware')
const authorization = require('../middleware/rolemiddleware')

const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');

router.get('/', async(req,res) =>{
    try{
        const total_reports = await pool.query('select * from reports')

        res.status(200).json({
            success: true,
            count: total_reports.rowCount,
            data: total_reports.rows
        })
    }catch(error){
        console.error("Error catched while fetching reports ", error.message)
        res.status(500).json({
            success: false,
            message: "Failed to get the reports"
        })
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

    const newReport = await pool.query(
      `INSERT INTO reports
      (description, location, ward_id, before_photo_url, after_photo_url, status, created_at, updated_at)
      VALUES (
        $1,
        CASE
          WHEN $2::float IS NOT NULL AND $3::float IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($2::float,$3::float),4326)
          ELSE NULL
        END,
        NULL, $4, NULL, 'Pending', NOW(), NOW()
      )
      RETURNING *`,
      [description, longitude, latitude, before_photo_url]
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

router.patch('/:id', verify, authorization('Inspector'), async(req,res) => {
    try{
        const { id } = req.params;
        const { after_photo_url } = req.body;
        const updateReport = await pool.query(
            `UPDATE reports SET after_photo_url = $1, status = 'Pending Verification', updated_at = NOW()
            WHERE report_id = $2 RETURNING *
            `,
            [after_photo_url,id]
        )
        if(updateReport.rowCount === 0 ){
            return res.status(404).json({
                success: false,
                message: "Couldn't find the previously existing report"
            })
        }
        res.status(200).json({
            success: true, 
            message: "Hazard cleanup image received", 
            data: updateReport.rows[0]
        })
    }catch(error){
        res.status(500).json({
            success: false,
            message: "Didn't receive the Hazard cleanup image"
        })
    }
});

router.patch('/:id/assign', verify, authorization('Councillor'), async(req,res) => {
    try{
        const { id } = req.params 
        const { inspector_id } = req.body

        if(!inspector_id){
            return res.status(403).json({
                success: false,
                message: "You must provide your ID"
            })
        }

        const allowreport = await pool.query(
            `UPDATE reports SET assigned_inspector_id = $1, status = 'Assigned', updated_at = NOW()
            where report_id = $2 AND status IN ('Pending','Re-assigned') RETURNING *`, 
            [inspector_id,id]
        )  // added the re-assigned option for the Councillor

        if(allowreport.rowCount === 0){
            return res.status(404).json({
                success: false,
                message: "No previously report found"
            })
        }

        res.status(200).json({
            success: true,
            message: "Task Assigned successfully",
            data: allowreport.rows[0]
        })
    }catch(error){
        res.status(500).json({
            success: false,
            message: "Error Occured"
        })
    }
})

router.patch('/:id/verify', verify, authorization('Councillor', 'Master Admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved, Councillors_note } = req.body;

        const newStatus = is_approved ? 'Resolved' : 'Re-assigned';

        // Added councillor_note to the query
        const updated_reports = await pool.query(
            `UPDATE reports 
             SET status = $1, councillor_note = $2, updated_at = NOW() 
             WHERE report_id = $3 AND status = 'Pending Verification' 
             RETURNING *`,
            [newStatus, Councillors_note || null, id]
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