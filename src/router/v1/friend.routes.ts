import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware.js";
import {
  sendRequest,
  listRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listFriends,
  unfriend,
} from "../../controllers/friend.controller.js";

const router: Router = Router();

router.post("/requests", authenticateUser, sendRequest);
router.get("/requests", authenticateUser, listRequests);
router.post("/requests/:id/accept", authenticateUser, acceptRequest);
router.post("/requests/:id/decline", authenticateUser, declineRequest);
router.delete("/requests/:id", authenticateUser, cancelRequest);
router.get("/", authenticateUser, listFriends);
router.delete("/:friendshipId", authenticateUser, unfriend);

export default router;
