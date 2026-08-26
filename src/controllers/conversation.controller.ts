import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import conversationServ from "../services/conversation.service.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";

async function listConversations(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  try {
    const response = await conversationServ.listConversations(userId);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to list conversations");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function getMessages(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const before = req.query.before as string | undefined;
  try {
    const response = await conversationServ.getMessages(
      userId,
      id,
      limit,
      before,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to get messages");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function updatePreferences(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  const id = req.params.id as string;
  const { saveMessages } = req.body;
  try {
    const response = await conversationServ.updatePreferences(
      userId,
      id,
      saveMessages,
    );
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to update conversation preferences");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export { listConversations, getMessages, updatePreferences };
