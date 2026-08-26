import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import friendServ from "../services/friend.service.js";
import Notification from "../repositories/notification.repo.js";
import { emailToSocketMap } from "../utils/networkStore.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";

async function sendRequest(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const { receiverUsername } = req.body;
  try {
    const response = await friendServ.sendRequest(userId, receiverUsername);
    if (response.success) {
      const requestId = response.data?.requestId;
      const receiver = await import("../repositories/user.repo.js").then(
        (m) => m.default.getByUsername(receiverUsername),
      );
      if (receiver) {
        const notification = await Notification.create(
          receiver.id,
          "friend_request_received",
          userId,
          requestId,
        );
        if (notification) {
          const receiverSocket = emailToSocketMap.get(receiver.email);
          if (receiverSocket) {
            const { io } = await import("../components/signalling.js");
            io.to(receiverSocket.socketId).emit("notification:new", notification);
          }
        }
      }
    }
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to send friend request");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function listRequests(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const direction = req.query.direction as string;
  const status = req.query.status as string | undefined;
  try {
    const response = await friendServ.listRequests(
      userId,
      direction as "incoming" | "outgoing",
      status,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to list friend requests");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function acceptRequest(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  try {
    const response = await friendServ.acceptRequest(userId, id);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to accept friend request");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function declineRequest(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  try {
    const response = await friendServ.declineRequest(userId, id);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to decline friend request");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function cancelRequest(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  try {
    const response = await friendServ.cancelRequest(userId, id);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to cancel friend request");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function listFriends(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  try {
    const response = await friendServ.listFriends(userId);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to list friends");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function unfriend(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const friendshipId = req.params.friendshipId as string;
  try {
    const response = await friendServ.unfriend(userId, friendshipId);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to unfriend");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export {
  sendRequest,
  listRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listFriends,
  unfriend,
};
