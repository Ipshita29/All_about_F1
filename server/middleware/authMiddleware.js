const jwt = require("jsonwebtoken")
const authMiddleware = (req,res,next)=>{
    try{
        const token = req.headers.authorization;
        if(!token){
            return res.status(401).json({
                message:"No token provided"
            })
        }
        const decoded = jwt.verify(token,process.env.JWT_SECRET)
        req.user=decoded
        next()
    }
    catch(e){
        console.log(e)
        return res.status(401).json({
            message: "Invalid token"
        })
    }
}
module.exports=authMiddleware;