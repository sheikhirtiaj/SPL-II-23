const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const verify = require('../middleware/authmiddleware');
const authorization = require('../middleware/rolemiddleware');

router.get('/', verify, authorization('Councillor', 'Master Admin'), async (req, res) => {
    try {

        let query;
        let params = [];

        if (req.user.role === 'Master Admin') {
            query = `
                SELECT
                    u.user_id, u.full_name, u.email, u.phone_number, u.ward_id,
                    COUNT(r.report_id) AS assigned_tasks
                FROM users u
                LEFT JOIN reports r
                    ON r.assigned_inspector_id = u.user_id
                    AND r.status = 'Assigned'
                WHERE u.role = 'Inspector'
                GROUP BY u.user_id
                ORDER BY u.full_name
            `;
        } else {
            query = `
                SELECT
                    u.user_id, u.full_name, u.email, u.phone_number, u.ward_id,
                    COUNT(r.report_id) AS assigned_tasks
                FROM users u
                LEFT JOIN reports r
                    ON r.assigned_inspector_id = u.user_id
                    AND r.status = 'Assigned'
                WHERE u.role = 'Inspector' AND u.ward_id = $1
                GROUP BY u.user_id
                ORDER BY u.full_name
            `;
            params = [req.user.ward_id];
        }

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("Error occurred while fetching inspectors: ", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch inspectors"
        });
    }
});

module.exports = router;