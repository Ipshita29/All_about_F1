const User = require("../models/User");

const savePreferences = async (req,res)=>{
    const { favoriteTeam } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id,
        {favoriteTeam},
        {returnDocument: "after"}
    )
    res.json({
        id:user._id,
        name:user.name,
        email:user.email,
        favoriteTeam:user.favoriteTeam
    })
}
module.exports = {
    savePreferences
};