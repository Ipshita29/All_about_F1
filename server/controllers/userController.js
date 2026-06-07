const User = require("../models/User");

const savePreferences = async (req,res)=>{
    const { favoriteTeam,favoriteDriver } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id,
        {favoriteTeam,favoriteDriver},
        {returnDocument: "after"}
    )
    res.json({
        id:user._id,
        name:user.name,
        email:user.email,
        favoriteTeam:user.favoriteTeam,
        favoriteDriver:user.favoriteDriver
    })
}
const getProfile = async (req,res)=>{

    const user = await User.findById(req.user.id);

    res.json({
        id:user._id,
        name:user.name,
        email:user.email,
        favoriteTeam:user.favoriteTeam,
        favoriteDriver:user.favoriteDriver
    });

};
module.exports = {
    savePreferences,
    getProfile
};