import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware.js";
import { searchUsers, updateSettings, checkUsername } from "../../controllers/user.controller.js";

const router: Router = Router();

router.get("/search", authenticateUser, searchUsers);
router.get("/check-username", checkUsername);
router.patch("/me/settings", authenticateUser, updateSettings);

export default router;
