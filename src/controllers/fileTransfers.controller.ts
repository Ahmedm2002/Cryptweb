import type { Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import fileTransfersServ from "../services/fileTransfers.service.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";

async function getRecentTransfers(req: CustomRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(new ApiError(401, "Unauthorized"));
    }
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const response = await fileTransfersServ.getRecentTransfers(userId, limit);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch recent transfers");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function saveTransferComplete(req: CustomRequest, res: Response) {
  try {
    const response = await fileTransfersServ.saveTransferComplete(req.body);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to save file transfer unexpectedly");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export { getRecentTransfers, saveTransferComplete };
