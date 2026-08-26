import CONSTANTS from "../constants.js";
import Notification from "../repositories/notification.repo.js";
import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import isValidUuid from "../utils/helperFuncs/isValidUuid.js";
import logger from "../utils/logger/logger.js";

class NotificationService {
  constructor() {}

  async listNotifications(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<ApiError | ApiResponse<any>> {
    try {
      const notifications = await Notification.listByUser(userId, unreadOnly);
      return new ApiResponse(
        200,
        notifications,
        "Notifications fetched successfully",
      );
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to list notifications");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(notificationId)) {
      return new ApiError(400, "Invalid notification id");
    }

    try {
      const updated = await Notification.markRead(notificationId, userId);
      if (!updated) {
        return new ApiError(404, "Notification not found");
      }
      return new ApiResponse(200, null, "Notification marked as read");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to mark notification read");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async markAllRead(userId: string): Promise<ApiError | ApiResponse<any>> {
    try {
      await Notification.markAllRead(userId);
      return new ApiResponse(200, null, "All notifications marked as read");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to mark all notifications read");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const notificationServ = new NotificationService();
export default notificationServ;
