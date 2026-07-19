import { Router } from "express";
import {
  getRecentTransfers,
  saveTransferComplete,
} from "../../controllers/fileTransfers.controller.js";
import authenticateUser from "../../middlewares/auth.middleware.js";

const router: Router = Router();

router.get("/recent", authenticateUser, getRecentTransfers);
router.post("/complete", authenticateUser, saveTransferComplete);

export default router;
