import CONSTANTS from "../constants.js";
import type { userSessionI } from "../interfaces/user-sessions.model.js";
import UserSession from "../repositories/user_session.repo.js";
import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import isValidUuid from "../utils/helperFuncs/isValidUuid.js";
import logger from "../utils/logger/logger.js";
import Users from "../repositories/user.repo.js";
import { emailToSocketMap } from "../components/signalling.js";
import isValidEmail from "../utils/helperFuncs/isValidEmail.js";
class UserSessionService {
  constructor() {}
  /**
   *
   * @param userId
   * @returns
   */
  async getAllSessions(userId: string): Promise<ApiError | ApiResponse<any>> {
    if (!userId) return new ApiError(400, "User id required");
    if (!isValidUuid(userId)) {
      return new ApiError(400, "Invalid user id");
    }
    try {
      const sessions: userSessionI[] = await UserSession.getAll(userId);
      if (sessions.length === 0) {
        return new ApiError(404, "No user session found");
      }
      return new ApiResponse<any>(
        200,
        sessions,
        "sessions fetched successfully",
      );
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to fetch all sessions");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
  async invalidateSession(
    sessionId: string,
    deviceId: string,
  ): Promise<ApiError | ApiResponse<string>> {
    if (!sessionId || !deviceId) {
      return new ApiError(400, "Required fields missing");
    }
    if (!isValidUuid(sessionId)) {
      return new ApiError(400, "Invalid user id");
    }
    try {
      const id: string = await UserSession.deleteUserSession(
        sessionId,
        deviceId,
      );
      if (!id) {
        return new ApiError(400, "No session found");
      }
      return new ApiResponse<string>(200, id, "Session deleted successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to delete session");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async deleteAllSessions(
    userId: string,
  ): Promise<ApiError | ApiResponse<string[]>> {
    if (!isValidUuid(userId)) {
      return new ApiError(400, "Invalid user id");
    }
    try {
      const deletedSessions = await UserSession.deleteAllSessions(userId);
      if (deletedSessions.length <= 0) {
        return new ApiError(404, "No active user sessions found");
      }
      return new ApiResponse<string[]>(
        200,
        deletedSessions,
        "Log out from all devices sucessfull",
      );
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to delete all sessions");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
  async getCurrentSession(
    userId: string,
    sessionId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!userId || !sessionId) {
      return new ApiError(400, "Missing Fields");
    }
    if (!isValidUuid(userId) || !isValidUuid(sessionId)) {
      return new ApiError(400, "Invalid id");
    }

    try {
      const session = await UserSession.getSession(userId, sessionId);
      if (!session) {
        return new ApiError(404, "Session not found");
      }
      const user = await Users.getById(userId);
      if (!user) {
        return new ApiError(404, "User not found");
      }

      return new ApiResponse(
        200,
        { user, session },
        "Session retrieved successfully",
      );
    } catch (error) {
      logger.fatal({ err: error }, "Failed to get current user session");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
  async checkStatus(email: string): Promise<ApiError | ApiResponse<any>> {
    if (!isValidEmail(email)) return new ApiError(400, "Invalid Email");

    try {
      const friend = await Users.getByEmail(email);
      if (!friend)
        return new ApiError(400, `User not found with email ${email}`);

      const isOnline  = emailToSocketMap.has(email)

      if(!isOnline){
        return new ApiResponse(200, {isOnline}, `${friend.name} is offline`)
      }
      
      return new ApiResponse(
        200,
        { isOnline: true },
        `${friend.name} is offline`,
      );
    } catch (error) {
      logger.fatal({ err: error }, "Failed to get current user session");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const userSessionServ = new UserSessionService();

export default userSessionServ;
