import CONSTANTS from "../constants.js";
import Users from "../repositories/user.repo.js";
import Friendship from "../repositories/friendship.repo.js";
import Conversation from "../repositories/conversation.repo.js";
import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import { searchUsersSchema, updateSettingsSchema } from "../utils/validations/Zod/friends.schema.js";
import { fromError } from "zod-validation-error";
import logger from "../utils/logger/logger.js";

class UserService {
  constructor() {}

  async searchUsers(
    query: string,
    requesterId: string,
    excludeFriends?: string,
  ): Promise<ApiError | ApiResponse<any>> {
    const validate = searchUsersSchema.safeParse({ q: query, excludeFriends });
    if (!validate.success) {
      const validationError = fromError(validate.error);
      return new ApiError(400, "Invalid fields", [validationError.message]);
    }

    try {
      let friendIds: string[] = [];
      if (excludeFriends === "true") {
        friendIds = await Friendship.getFriendIds(requesterId);
      }

      const users = await Users.searchByUsername(
        validate.data.q,
        requesterId,
        friendIds,
      );

      return new ApiResponse(200, users, "Users fetched successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to search users");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async updateSettings(
    userId: string,
    saveMessagesDefault: boolean,
    applyToAllConversations?: boolean,
  ): Promise<ApiError | ApiResponse<any>> {
    const validate = updateSettingsSchema.safeParse({
      saveMessagesDefault,
      applyToAllConversations,
    });
    if (!validate.success) {
      const validationError = fromError(validate.error);
      return new ApiError(400, "Invalid fields", [validationError.message]);
    }

    try {
      await Users.updateSaveMessagesDefault(userId, validate.data.saveMessagesDefault);

      if (validate.data.applyToAllConversations) {
        await Conversation.deletePreferencesForUser(userId);
      }

      return new ApiResponse(200, null, "Settings updated successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to update settings");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const userServ = new UserService();
export default userServ;
