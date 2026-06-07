const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const User = require("../models/User")

const signup = async (req,res)=>{
    try{
        const {name,email,password}=req.body;
        const hashedpass = await bcrypt.hash(password,10)
        const existingUser = await User.findOne({
            email
        })
        if (existingUser){
            return res.status(400).json({
                message:"User Already exists"
            })
        }
        const user = await User.create({
            name,email,password:hashedpass
        })
        return res.status(201).json({
            id:user._id,
            name:user.name,
            email:user.email
        })
    }
    catch(e){
        console.log(e)
        return res.status(401).json({
            message: "Signup failed"
        })
    }
}


const login = async (req,res)=>{
    try{
        const {email,password}=req.body;
        const user = await User.findOne({email})
        if (!user){
            return res.status(400).json({message:"User dosent exist please signup"})
        }
        const matchPass = await bcrypt.compare(password,user.password)
        if(!matchPass){
            return res.status(400).json({message:"Invalid Credentials"})
        }
        const token = jwt.sign(
            {id:user._id},
            process.env.JWT_SECRET,
            {expiresIn:"7d"}
        )
        res.json({token})
    }
    catch(e){
        console.log(e)
        return res.status(401).json({
            message: "Login failed"
        })
    }

}

module.exports = {
    signup,
    login
}