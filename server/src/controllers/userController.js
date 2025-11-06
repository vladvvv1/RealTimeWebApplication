import { User } from "../models/user.js";
import { ObjectId } from "mongodb";

export const getUserProfile = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "user not found" });
        }

        res.json(user);
    
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return res.status(500).json({ error: "Server error." });    
    }
}