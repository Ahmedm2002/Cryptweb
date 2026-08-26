import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware.js";
import {
  listConversations,
  getMessages,
  updatePreferences,
} from "../../controllers/conversation.controller.js";

const router: Router = Router();

router.get("/", authenticateUser, listConversations);
router.get("/:id/messages", authenticateUser, getMessages);
router.patch("/:id/preferences", authenticateUser, updatePreferences);

export default router;
