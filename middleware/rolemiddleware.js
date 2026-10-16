const authorization = (...allowedroles) => {
    return (req,res,next) => {
        if(!req.user || !allowedroles.includes(req.user.role)){
            return res.status(403).json({
                success: false,
                message: "Access Denied."
            })
        }

        next()
    }
}

module.exports = authorization