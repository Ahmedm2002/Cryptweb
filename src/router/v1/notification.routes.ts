import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware.js";
import {
  listNotifications,
  markRead,
  markAllRead,
} from "../../controllers/notification.controller.js";

const router: Router = Router();

router.get("/", authenticateUser, listNotifications);
router.patch("/read-all", authenticateUser, markAllRead);
router.patch("/:id/read", authenticateUser, markRead);

export default router;
