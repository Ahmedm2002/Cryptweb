import {
  googleLogin,
  loginUser,
  signupUser,
} from "../../controllers/auth.controller.js";
import { Router } from "express";
import rateLimiter from "../../middlewares/rateLimitter.middleware.js";

const router: Router = Router();

router.post("/login", rateLimiter.authLimiter, loginUser);
router.post("/signup", rateLimiter.authLimiter, signupUser);
router.post("/google-login", rateLimiter.authLimiter, googleLogin);

export default router;
