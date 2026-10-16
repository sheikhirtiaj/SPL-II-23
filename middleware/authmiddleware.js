const jsonwebtoken = require("jsonwebtoken")
require('dotenv').config()

const verifyToken = (req,res,next) => {
    const authHeader = req.header('Authorization')

    if(!authHeader){
        return res.status(401).json({
            success: false,
            message: "Access Denied. No token provided"
        })
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authHeader);

    if (!match) {
        return res.status(401).json({
        success: false,
        message: 'Invalid Token Format'
        });
    }



  try {
    const verified = jsonwebtoken.verify(
      match[1],
      process.env.Jeson_Web_Token
    );

    req.user = verified;
    return next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or Expired Token'
    });
  }
};

module.exports = verifyToken