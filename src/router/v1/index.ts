import { Router } from "express";
import authRoutes from "./auth.routes.js";
import verficationRoutes from "./verifyUser.routes.js";
import sessionRoutes from "./userSessions.routes.js";
import resetPassRoutes from "./resetPassword.routes.js";
import healthRoutes from "./health.routes.js";
import fileTransferRoutes from "./fileTransfers.routes.js";
import userRoutes from "./user.routes.js";
import friendRoutes from "./friend.routes.js";
import conversationRoutes from "./conversation.routes.js";
import notificationRoutes from "./notification.routes.js";

const router: Router = Router({
  strict: true,
  caseSensitive: true,
});

router.use("/v1/auth", authRoutes);
router.use("/v1/verify", verficationRoutes);
router.use("/v1/session", sessionRoutes);
router.use("/v1/password", resetPassRoutes);
router.use("/v1/health", healthRoutes);
router.use("/v1/file-transfers", fileTransferRoutes);
router.use("/v1/users", userRoutes);
router.use("/v1/friends", friendRoutes);
router.use("/v1/conversations", conversationRoutes);
router.use("/v1/notifications", notificationRoutes);

export default router;
