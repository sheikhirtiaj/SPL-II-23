const express = require('express')
const bcrypt = require('bcrypt')
const jsonwebtoken = require('jsonwebtoken')
const pool = require('../config/db')

const verify = require('../middleware/authmiddleware')
const authorization = require('../middleware/rolemiddleware')

const router = express.Router()

router.post('/register', async(req,res) => {
    try{
        const {full_name,email,phone_number,role,password} = req.body

        if(!email && !phone_number){
            return res.status(404).json({
                success: false,
                message: "Either one of the email or phone number must be present."
            })
        }

        const saltRounds = 12
        const password_hash = await bcrypt.hash(password, saltRounds)

        const newUser = await pool.query(
            `INSERT INTO users (full_name, email, phone_number, role, password_hash, created_at)
            VALUES($1,$2,$3,$4,$5,NOW())
            RETURNING user_id, full_name, email, role`,
            [full_name,email || null,phone_number || null,role,password_hash]
        )

        res.status(201).json({
            success: true,
            message: "User registration completed",
            data: newUser.rows[0]
        })
    }
    catch(error){
        res.status(500).json({
            success: false,
            message: "Error occuresd while saving user info"
        })
    }
})

router.post('/login', async(req,res) => {
    try{
        const {email, phone_number, password} = req.body

        const uniqe_identifier = email || phone_number

        // Used a LEFT JOIN to fetch the ward_id if the user is a Councillor
        const query = `
            SELECT u.*, w.ward_id 
            FROM users u
            LEFT JOIN wards w ON w.councillor_id = u.user_id
            WHERE u.email = $1 OR u.phone_number = $1
        `;
        
        const userInput = await pool.query(query, [uniqe_identifier])

        if(userInput.rows.length === 0){
            return res.status(401).json({
                success: false,
                message: "Invalid userId or Password"
            })
        }

        const user = userInput.rows[0]

        const matchedPass = await bcrypt.compare(password, user.password_hash)

        if(!matchedPass){
            return res.status(401).json({
                success: false,
                message: "Invalid userId or Password"
            })
        }

        // Added ward_id as the frontend required that
        const tokeninfo = {
            user_id: user.user_id,
            role: user.role,
            ward_id: user.ward_id || null
        }

        const token = jsonwebtoken.sign(tokeninfo, process.env.Jeson_Web_Token, {expiresIn: '1d'})

        // Added ward_id in the response as per the frontend requirements
        res.status(200).json({
            success: true,
            message: "Successfully Logged In",
            token: token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                role: user.role,
                ward_id: user.ward_id || null
            }
        })
    }
    catch(error){
        console.error("Login Error: ", error.message)
        res.status(500).json({
            success: false,
            message: "Failed to log in"
        })
    }
})


router.get('/staff', verify, authorization('Master Admin'), async (req, res) => {
    try {
        const councillors = await pool.query(
            `SELECT u.user_id, u.full_name, u.email, u.phone_number, u.ward_id,
                COUNT(r.report_id) AS complaints_received,
                COUNT(r.report_id) FILTER (WHERE r.status = 'Resolved') AS complaints_resolved,
                COUNT(r.report_id) FILTER (WHERE r.status != 'Resolved') AS complaints_pending
             FROM users u
             LEFT JOIN reports r ON r.ward_id = u.ward_id
             WHERE u.role = 'Councillor'
             GROUP BY u.user_id
             ORDER BY u.full_name`
        )

        const inspectors = await pool.query(
            `SELECT u.user_id, u.full_name, u.email, u.phone_number,
                COUNT(r.report_id) FILTER (WHERE r.assigned_inspector_id = u.user_id) AS complaints_assigned,
                COUNT(r.report_id) FILTER (WHERE r.assigned_inspector_id = u.user_id AND r.status = 'Resolved') AS complaints_resolved
             FROM users u
             LEFT JOIN reports r ON r.assigned_inspector_id = u.user_id
             WHERE u.role = 'Inspector'
             GROUP BY u.user_id
             ORDER BY u.full_name`
        )

        res.status(200).json({
            success: true,
            data: {
                councillors: councillors.rows,
                inspectors: inspectors.rows
            }
        })
    } catch (error) {
        console.error("Error occured while fetching staff list ", error.message)
        res.status(500).json({
            success: false,
            message: "Failed to get Councillor/Inspector list"
        })
    }
})


router.post('/create-staff', verify, authorization('Master Admin'), async (req, res) => {
    try {
        const { full_name, email, phone_number, role, password, ward_id } = req.body

        if (!['Councillor', 'Inspector'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "role must be either 'Councillor' or 'Inspector'"
            })
        }

        const saltRounds = 12
        const password_hash = await bcrypt.hash(password, saltRounds)

        // removed ward_id from the SQL and the array
        const newStaff = await pool.query(
            `INSERT INTO users (full_name, email, phone_number, role, password_hash, created_at)
            VALUES ($1,$2,$3,$4,$5,NOW())
            RETURNING user_id, full_name, email, phone_number, role`,
            [full_name, email || null, phone_number || null, role, password_hash]
        )

        const user = newStaff.rows[0];

        // if it's a Councillor, linked them in the wards table
        if (role === 'Councillor' && ward_id) {
            await pool.query(
                `UPDATE wards SET councillor_id = $1 WHERE ward_id = $2`,
                [user.user_id, ward_id]
            );
            user.ward_id = ward_id; // attached this to the response towards the frontend
        } else {
            user.ward_id = null; 
        }

        res.status(201).json({
            success: true,
            message: `${role} account created successfully`,
            data: user // matched the response with the frontend's requirement
        })
    } catch (error) {
        console.error("Error occurred while creating staff account: ", error.message)
        res.status(500).json({
            success: false,
            message: "Error occurred while creating staff account"
        })
    }
})


// bcrypt.hash("123456", 12).then(console.log);

module.exports = router;