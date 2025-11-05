import express from "express";
import { User } from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get("/register", (req, res) => {
    try {
        const {username, email} = req.body;
    } catch (error) {
        
    }
})