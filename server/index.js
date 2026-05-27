const express = require('express');
const cors = require('cors')
const app = express();
const driverRoutes =require("./routes/driverRoutes")
const teamRoutes = require("./routes/teamRoutes")
const grandprixRoutes = require("./routes/grandprixRoutes")
const circuitRoutes = require("./routes/circuitRoutes")

app.use(cors());
app.use(express.json());

app.get("/",(req,res)=>{
    res.send("Hello F1 fan. This is the landing page.")
})

app.use("/teams",teamRoutes)
app.use("/drivers",driverRoutes)
app.use("/grandprixdashboard",grandprixRoutes)
app.use("/circuitmaps",circuitRoutes)

app.listen(3000,()=>{
    console.log("Server listening on port 3000")
});
