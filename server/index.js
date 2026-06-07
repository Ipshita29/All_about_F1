require("dotenv").config()
const express = require('express');
const cors = require('cors')
const app = express();
const driverRoutes =require("./routes/driverRoutes")
const teamRoutes = require("./routes/teamRoutes")
const grandprixRoutes = require("./routes/grandprixRoutes")
const circuitRoutes = require("./routes/circuitRoutes")
const connectDB = require("./config/db")
const authRoutes = require("./routes/authRoutes")
const authMiddleware = require("./middleware/authMiddleware");
const userRoutes = require("./routes/userRoutes");

app.use(cors());
app.use(express.json());

connectDB()

app.get("/",(req,res)=>{
    res.send("Hello F1 fan. This is the landing page.")
})

app.get("/profile",authMiddleware,(req,res)=>{
        res.json(req.user);
    }
)

app.use("/teams",teamRoutes)
app.use("/drivers",driverRoutes)
app.use("/grandprixdashboard",grandprixRoutes)
app.use("/circuitmaps",circuitRoutes)
app.use("/auth", authRoutes)
app.use("/user", userRoutes);

app.listen(process.env.PORT||3000,()=>{
    console.log("Server listening on port 3000")
});
