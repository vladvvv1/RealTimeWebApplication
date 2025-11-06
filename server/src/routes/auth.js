import express from "express";
import { Registration, Login, RefreshSession,  } from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", Registration);
router.post("/login", Login);
router.post("/refresh", RefreshSession);

export default router;