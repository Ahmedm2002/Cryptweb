import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import notificationServ from "../services/notification.service.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";

async function listNotifications(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const unreadOnly = req.query.unreadOnly === "true";
  try {
    const response = await notificationServ.listNotifications(
      userId,
      unreadOnly,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to list notifications");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function markRead(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  try {
    const response = await notificationServ.markRead(userId, id);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to mark notification read");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function markAllRead(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  try {
    const response = await notificationServ.markAllRead(userId);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to mark all notifications read");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export { listNotifications, markRead, markAllRead };
