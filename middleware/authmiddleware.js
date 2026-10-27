const jsonwebtoken = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied. No token provided'
    });
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Token Format'
    });
  }

  let verified;
  try {
    verified = jsonwebtoken.verify(match[1], process.env.Jeson_Web_Token);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or Expired Token'
    });
  }

  try {
    // Check account status on each protected request so a deactivated staff
    // member cannot continue using a previously issued JWT.
    const account = await pool.query(
      'SELECT is_active FROM users WHERE user_id = $1',
      [verified.user_id]
    );

    if (!account.rowCount) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists. Please sign in again.'
      });
    }

    if (account.rows[0].is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact the Master Admin.'
      });
    }

    req.user = verified;
    return next();
  } catch (error) {
    console.error('Account status check failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not verify account status. Please try again.'
    });
  }
};

module.exports = verifyToken;
