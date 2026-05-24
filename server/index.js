const express = require('express');
const cors = require('cors')
const app = express();

app.use(cors());
app.use(express.json());

app.get("/",(req,res)=>{
    res.send("Hello F1 fan. This is the landing page.")
})

app.get("/teams",(req,res)=>{
    res.send("F1 team page")
})

app.get("/drivers",(Req,res)=>{
    res.send("F1 Drivers page")
})

app.get("/gradnprixdashboard",(req,res)=>{
    res.send("This is grand prix dashboard")
})

app.get("/circuitmaps",(req,res)=>{
    res.send("F1 Circuit Maps")
})

app.listen(3000,()=>{
    console.log("Server listening on port 3000")
});
