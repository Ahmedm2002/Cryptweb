import CONSTANTS from "../constants.js";
import FriendRequest from "../repositories/friend_request.repo.js";
import Friendship from "../repositories/friendship.repo.js";
import Conversation from "../repositories/conversation.repo.js";
import Users from "../repositories/user.repo.js";
import Notification from "../repositories/notification.repo.js";
import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import isValidUuid from "../utils/helperFuncs/isValidUuid.js";
import {
  sendFriendRequestSchema,
  friendRequestListSchema,
} from "../utils/validations/Zod/friends.schema.js";
import uuidSchema from "../utils/validations/Zod/uuid.schema.js";
import { fromError } from "zod-validation-error";
import logger from "../utils/logger/logger.js";

class FriendService {
  constructor() {}

  async sendRequest(
    senderId: string,
    receiverUsername: string,
  ): Promise<ApiError | ApiResponse<any>> {
    const validate = sendFriendRequestSchema.safeParse({ receiverUsername });
    if (!validate.success) {
      const validationError = fromError(validate.error);
      return new ApiError(400, "Invalid fields", [validationError.message]);
    }

    try {
      const receiver = await Users.getByUsername(receiverUsername);
      if (!receiver) {
        return new ApiError(404, "User not found");
      }

      if (receiver.id === senderId) {
        return new ApiError(400, "Cannot send a friend request to yourself");
      }

      const alreadyFriends = await Friendship.exists(senderId, receiver.id);
      if (alreadyFriends) {
        return new ApiError(409, "Already friends");
      }

      const existingRequest = await FriendRequest.getBySenderAndReceiver(
        senderId,
        receiver.id,
      );
      if (existingRequest) {
        return new ApiError(409, "Friend request already pending");
      }

      const reverseRequest = await FriendRequest.getPendingByReceiverAndSender(
        senderId,
        receiver.id,
      );
      if (reverseRequest) {
        return new ApiError(409, "Friend request already pending");
      }

      const request = await FriendRequest.create(senderId, receiver.id);
      if (!request) {
        return new ApiError(500, CONSTANTS.SERVER_ERROR);
      }

      return new ApiResponse(201, { requestId: request.id }, "Friend request sent");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to send friend request");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async listRequests(
    userId: string,
    direction: "incoming" | "outgoing",
    status?: string,
  ): Promise<ApiError | ApiResponse<any>> {
    const validate = friendRequestListSchema.safeParse({ direction, status });
    if (!validate.success) {
      const validationError = fromError(validate.error);
      return new ApiError(400, "Invalid fields", [validationError.message]);
    }

    try {
      const requests = await FriendRequest.listByUser(
        userId,
        validate.data.direction,
        validate.data.status,
      );
      return new ApiResponse(200, requests, "Friend requests fetched successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to list friend requests");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async acceptRequest(
    userId: string,
    requestId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(requestId)) {
      return new ApiError(400, "Invalid request id");
    }

    try {
      const request = await FriendRequest.getById(requestId);
      if (!request) {
        return new ApiError(404, "Friend request not found");
      }

      if (request.receiver_id !== userId) {
        return new ApiError(403, "Not authorized");
      }

      if (request.status !== "pending") {
        return new ApiError(400, "Request already resolved");
      }

      await FriendRequest.setStatus(requestId, "accepted");
      await Friendship.create(request.sender_id, request.receiver_id);
      await Conversation.create(request.sender_id, request.receiver_id);

      await Notification.create(
        request.sender_id,
        "friend_request_accepted",
        userId,
        requestId,
      );

      return new ApiResponse(200, null, "Friend request accepted");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to accept friend request");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async declineRequest(
    userId: string,
    requestId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(requestId)) {
      return new ApiError(400, "Invalid request id");
    }

    try {
      const request = await FriendRequest.getById(requestId);
      if (!request) {
        return new ApiError(404, "Friend request not found");
      }

      if (request.receiver_id !== userId) {
        return new ApiError(403, "Not authorized");
      }

      if (request.status !== "pending") {
        return new ApiError(400, "Request already resolved");
      }

      await FriendRequest.setStatus(requestId, "declined");

      await Notification.create(
        request.sender_id,
        "friend_request_declined",
        userId,
        requestId,
      );

      return new ApiResponse(200, null, "Friend request declined");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to decline friend request");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async cancelRequest(
    userId: string,
    requestId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(requestId)) {
      return new ApiError(400, "Invalid request id");
    }

    try {
      const request = await FriendRequest.getById(requestId);
      if (!request) {
        return new ApiError(404, "Friend request not found");
      }

      if (request.sender_id !== userId) {
        return new ApiError(403, "Not authorized");
      }

      if (request.status !== "pending") {
        return new ApiError(400, "Request already resolved");
      }

      await FriendRequest.cancel(requestId);

      return new ApiResponse(200, null, "Friend request cancelled");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to cancel friend request");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async listFriends(userId: string): Promise<ApiError | ApiResponse<any>> {
    try {
      const friends = await Friendship.listByUser(userId);
      return new ApiResponse(200, friends, "Friends fetched successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to list friends");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }

  async unfriend(
    userId: string,
    friendshipId: string,
  ): Promise<ApiError | ApiResponse<any>> {
    if (!isValidUuid(friendshipId)) {
      return new ApiError(400, "Invalid friendship id");
    }

    try {
      const friendship = await Friendship.getById(friendshipId);
      if (!friendship) {
        return new ApiError(404, "Friendship not found");
      }

      if (friendship.user_one_id !== userId && friendship.user_two_id !== userId) {
        return new ApiError(403, "Not authorized");
      }

      await Friendship.delete(friendshipId);

      return new ApiResponse(200, null, "Unfriended successfully");
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to unfriend");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const friendServ = new FriendService();
export default friendServ;
