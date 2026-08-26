import CONSTANTS from "../constants.js";
import Conversation from "../repositories/conversation.repo.js";
import Message from "../repositories/message.repo.js";
import Users from "../repositories/user.repo.js";
import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import isValidUuid from "../utils/helperFuncs/isValidUuid.js";
import { updateConversationPreferencesSchema } from "../utils/validations/Zod/friends.schema.js";
import { fromError } from "zod-validation-error";
import logger from "../utils/logger/logger.js";

class ConversationService {
  constructor() {}

  async listConversations(
    userId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    try {
      const conversations = await Conversation.listByUser(userId);
      return new ApiResponse(
        200,
        conversations,
        "Conversations fetched successfully",
      );
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to list conversations");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async getMessages(
    userId: string,
    conversationId: string,
    limit?: number,
    before?: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(conversationId)) {
      return new ApiError(400, "Invalid conversation id");
    }

    try {
      const isParticipant = await Conversation.isParticipant(
        conversationId,
        userId,
      );
      if (!isParticipant) {
        return new ApiError(403, "Not authorized");
      }

      const messages = await Message.getSavedByUser(
        conversationId,
        userId,
        limit || 50,
        before,
      );

      return new ApiResponse(200, messages, "Messages fetched successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to get messages");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async updatePreferences(
    userId: string,
    conversationId: string,
    saveMessages: boolean,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(conversationId)) {
      return new ApiError(400, "Invalid conversation id");
    }

    const validate = updateConversationPreferencesSchema.safeParse({
      saveMessages,
    });
    if (!validate.success) {
      const validationError = fromError(validate.error);
      return new ApiError(400, "Invalid fields", [validationError.message]);
    }

    try {
      const isParticipant = await Conversation.isParticipant(
        conversationId,
        userId,
      );
      if (!isParticipant) {
        return new ApiError(403, "Not authorized");
      }

      await Conversation.upsertPreference(
        conversationId,
        userId,
        validate.data.saveMessages,
      );

      return new ApiResponse(200, null, "Preferences updated successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to update conversation preferences");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const conversationServ = new ConversationService();
export default conversationServ;
