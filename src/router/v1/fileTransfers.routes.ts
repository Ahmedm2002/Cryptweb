import { Router } from "express";
import { saveTransferComplete } from "../../controllers/fileTransfers.controller.js";
import authenticateUser from "../../middlewares/auth.middleware.js";

const router: Router = Router();

router.post("/complete", authenticateUser, saveTransferComplete);

export default router;
