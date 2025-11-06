import express from "express";
import { Registration, Login } from "../controllers/authController.js";
// import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/registration", Registration);
router.post("/login", Login);

export default router;