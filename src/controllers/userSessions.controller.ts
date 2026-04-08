import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import userSessionServ from "../services/user-session.service.js";
import tokensServ from "../services/tokens.service.js";
import UserSession from "../repositories/user_session.repo.js";
import logger from "../utils/logger/logger.js";
import type CustomRequest from "../types/customReq.type.js";
import Users from "../repositories/user.repo.js";
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
    logger.error({ err: error }, "Failed to fetch user sessions");
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
    logger.error({ err: error }, "Failed to invalidate session");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function logOutAllDevices(req: CustomRequest, res: Response) {
  const userId = req?.user?.id;
  try {
    const response = await userSessionServ.deleteAllSessions(userId!);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to log out all devices");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function getAccessToken(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken;
  const deviceId = req.cookies?.deviceId;
  const sessionId = req.cookies?.sessionId;

  const authHeader = req.headers?.authorization;
  const accessToken =
    req.cookies?.accessToken || (authHeader ? authHeader.split(" ")[1] : null);

  if (!refreshToken || !deviceId || !sessionId || !accessToken) {
    return res
      .status(400)
      .json(new ApiError(400, "Missing required session parameters"));
  }

  let userId: string;
  try {
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    if (!decoded || !decoded.sub) throw new Error("Invalid token");
    userId = decoded.sub as string;
  } catch (error) {
    return res
      .status(400)
      .json(new ApiError(400, "Invalid access token structure"));
  }

  try {
    const response = await tokensServ.generateAccessToken(
      refreshToken,
      userId,
      deviceId,
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
  } catch (error: any) {
    logger.error({ err: error }, "Failed to generate access token");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

async function getCurrentSession(req: CustomRequest, res: Response) {
  try {
    const user = req?.user;
    if (!user) {
      return res.status(401).json(new ApiError(401, "Unauthorized"));
    }

    const deviceId = req.cookies?.deviceId;
    const accessToken = req.cookies?.accessToken;
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) {
      return res
        .status(400)
        .json(new ApiError(400, "Session ID cookie missing"));
    }

    const sessionData = await UserSession.getSession(user.id, sessionId);
    const userInfo = await Users.getById(user.id);
    if (!sessionData) {
      return res.status(404).json(new ApiError(404, "Session not found"));
    }

    return res.status(200).json({
      statusCode: 200,
      data: {
        user: userInfo,
        session: sessionData,
        deviceInfo: {
          deviceId,
          accessToken,
          sessionId,
        },
      },
      message: "Session retrieved successfully",
      success: true,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to get current session");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export {
  getAllSessions,
  invalidateSession,
  getAccessToken,
  logOutAllDevices,
  getCurrentSession,
};
