const User = require("../models/User");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const updateProfile = async (req, res) => {
    try {
        const { name, email, favoriteTeam, favoriteDriver } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ message: "Name cannot be empty" });
            }
            updates.name = name.trim();
        }

        if (email !== undefined) {
            const normalizedEmail = email.trim().toLowerCase();
            if (!EMAIL_RE.test(normalizedEmail)) {
                return res.status(400).json({ message: "Enter a valid email address" });
            }
            const existing = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: req.user.id },
            });
            if (existing) {
                return res.status(400).json({ message: "Email already in use" });
            }
            updates.email = normalizedEmail;
        }

        if (favoriteTeam !== undefined) updates.favoriteTeam = favoriteTeam;
        if (favoriteDriver !== undefined) updates.favoriteDriver = favoriteDriver;

        const user = await User.findByIdAndUpdate(req.user.id, updates, {
            returnDocument: "after",
            runValidators: true,
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            favoriteTeam: user.favoriteTeam,
            favoriteDriver: user.favoriteDriver,
        });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Could not update profile" });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            favoriteTeam: user.favoriteTeam,
            favoriteDriver: user.favoriteDriver,
        });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Could not load profile" });
    }
};

module.exports = {
    updateProfile,
    getProfile,
};
