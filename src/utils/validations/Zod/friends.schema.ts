import * as z from "zod";
import { createErrorMap } from "zod-validation-error";

z.config({
  customError: createErrorMap(),
});

const searchUsersSchema = z.object({
  q: z.string().trim().min(2, "Query too short"),
  excludeFriends: z.string().optional(),
});

const updateSettingsSchema = z.object({
  saveMessagesDefault: z.boolean(),
  applyToAllConversations: z.boolean().optional(),
});

const sendFriendRequestSchema = z.object({
  receiverUsername: z.string().trim().min(1, "Username is required"),
});

const friendRequestListSchema = z.object({
  direction: z.enum(["incoming", "outgoing"]),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]).optional(),
});

const updateConversationPreferencesSchema = z.object({
  saveMessages: z.boolean(),
});

const checkUsernameSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});

export {
  searchUsersSchema,
  updateSettingsSchema,
  sendFriendRequestSchema,
  friendRequestListSchema,
  updateConversationPreferencesSchema,
  checkUsernameSchema,
};
