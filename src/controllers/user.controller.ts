import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import userServ from "../services/user.service.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";

async function searchUsers(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const q = req.query.q as string;
  const excludeFriends = req.query.excludeFriends as string | undefined;
  try {
    const response = await userServ.searchUsers(
      q,
      userId,
      excludeFriends,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to search users");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function updateSettings(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const { saveMessagesDefault, applyToAllConversations } = req.body;
  try {
    const response = await userServ.updateSettings(
      userId,
      saveMessagesDefault,
      applyToAllConversations,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to update settings");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function checkUsername(req: Request, res: Response) {
  const { username } = req.query;
  try {
    const response = await userServ.checkUsername(username as string);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to check username");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export { searchUsers, updateSettings, checkUsername };
