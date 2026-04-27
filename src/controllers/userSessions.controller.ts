import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import userSessionServ from "../services/user-session.service.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";
import tokensServ from "../services/tokens.service.js";
/**
 *
 * @param req
 * @param res
 * @returns
 */
async function getAllSessions(req: CustomRequest, res: Response) {
  const userId = req.user?.id as string;
  try {
    const response = await userSessionServ.getAllSessions(userId);
    res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to fetch user sessions");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

/**
 *
 * @param req
 * @param res
 */
async function invalidateSession(req: Request, res: Response) {
  const { sessionId, deviceId } = req.body;

  try {
    const response = await userSessionServ.invalidateSession(
      sessionId,
      deviceId,
    );
    return res
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .clearCookie("deviceId")
      .status(response.statusCode)
      .json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to invalidate session");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

/**
 *
 * @param req
 * @param res
 * @returns
 */
async function logOutAllDevices(req: CustomRequest, res: Response) {
  const userId = req?.user?.id;
  try {
    const response = await userSessionServ.deleteAllSessions(userId!);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.fatal({ err: error }, "Failed to log out all devices");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

/**
 *
 * @param req
 * @param res
 * @returns
 */
async function getAccessToken(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken;
  const sessionId = req.cookies?.sessionId;

  try {
    const response = await tokensServ.generateAccessToken(
      refreshToken,
      sessionId,
    );
    if (response.success) {
      return res
        .status(response.statusCode)
        .cookie(
          "accessToken",
          response.data?.accessToken,
          CONSTANTS.authCookieOpts,
        )
        .json(response);
    }

    return res.status(response.statusCode).json(response);
  } catch (error) {
    logger.fatal(
      { err: error },
      "Failed to generate new access token for user",
    );
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

/**
 *
 * @param req
 * @param res
 * @returns
 */
async function getCurrentSession(req: CustomRequest, res: Response) {
  const userId = req?.user?.id;
  if (!userId) {
    return res.status(401).json(new ApiError(401, "Unauthorized"));
  }
  const sessionId = req.cookies?.sessionId;
  try {
    const response = await userSessionServ.getCurrentSession(userId, sessionId);
    return res.status(response.statusCode).json(response);
  } catch (error) {
    logger.fatal({ err: error }, "Failed to retrieve current session");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function checkUserStatus(req: Request, res: Response) {
  try {
    const { email } = req.body;
    const response = await userSessionServ.checkStatus(email);
    return res.status(response.statusCode).json(response)
  } catch (error) {
    logger.fatal({ err: error }, "Failed to retrieve current session");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export {
  getAllSessions,
  invalidateSession,
  getAccessToken,
  logOutAllDevices,
  getCurrentSession,
  checkUserStatus,
};
