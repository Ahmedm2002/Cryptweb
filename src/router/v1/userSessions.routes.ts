import {
  getAllSessions,
  invalidateSession,
  logOutAllDevices,
  getAccessToken,
  getCurrentSession,
} from "../../controllers/userSessions.controller.js";
import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware.js";

const router: Router = Router();

router.get("/all", authenticateUser, getAllSessions);
router.get("/1", authenticateUser, getCurrentSession);
router.delete("/log-out", authenticateUser, invalidateSession);
router.post("/log-out/all-sessions", authenticateUser, logOutAllDevices);
router.post("/get-access-token", getAccessToken);

export default router;
