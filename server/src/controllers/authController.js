import { User } from "../models/user.js";
import bcrypt from "bcrypt";
import { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRATION, JWT_REFRESH_EXPIRATION } from "../config/config.js";
import jwt from "jsonwebtoken";

let refreshTokens = [];

const generateAccessToken = (user) => {
    return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

const generateRefreshToken = (user) => {
    return jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION });
};

export const Registration = async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: "No username or email provided." });
    }

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: "Username already exists." });
        }
    
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, passwordHash: hashedPassword});

        await newUser.save();
        res.status(201).json({ message: "User registered successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const Login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: "No username or password provided." });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: "Invalid username or password."});
        }

        if (username !== user.username) {
            return res.status(401).json({error: "Invalid credentials"});
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const accessToken = generateAccessToken({ id: user.id });
        const refreshToken = generateRefreshToken({ id: user.id });

        refreshTokens.push(refreshToken);
        res.json({ accessToken, refreshToken });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export const refreshSession = async (req, res) => {
    const { token } = req.body;

    if (!token || !refreshTokens.includes(token)) {
        return res.status(401).json({ error: "Invalid reshresh token" });
    }

    try {
        const user = jwt.verify(token, JWT_REFRESH_SECRET);
        const accessToken = generateAccessToken({ id: user.id })
        return res.json({ accessToken });
    } catch (error) {
        res.status(403).json({ error: "Invalid refresh token." });        
    }
};

