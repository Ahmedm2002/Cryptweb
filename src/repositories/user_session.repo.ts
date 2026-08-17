import { getDb } from "../configs/db.js";
import crypto from "node:crypto";
import type {
  userSessionI,
  DeviceInfo,
} from "../interfaces/user-sessions.model.js";
import { ObjectId } from "mongodb";
import logger from "../utils/logger/logger.js";

class UserSessionsRepo {
  constructor() {}

  private col() {
    return getDb().collection<userSessionI & { _id: ObjectId }>(
      "user_sessions",
    );
  }

  async create(
    userId: string,
    deviceId: string,
    refreshTokenHash: string,
    deviceType: DeviceInfo,
  ): Promise<Pick<userSessionI, "id"> | null> {
    if (!userId || !deviceId || !refreshTokenHash) {
      throw new Error("Missing required session fields");
    }

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = await this.col().insertOne({
        user_id: userId,
        device_id: deviceId,
        refresh_token: refreshTokenHash,
        expires_at: expiresAt,
        created_at: new Date(),
        device_type: deviceType,
      } as any);
      return { id: result.insertedId.toHexString() };
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create user session");
      throw new Error("Error while registering user session: " + error.message);
    }
  }

  async deleteAllSessions(userId: string): Promise<string[]> {
    try {
      const sessions = await this.col().find({ user_id: userId }).toArray();
      const ids = sessions.map((s) => s._id.toHexString());
      await this.col().deleteMany({ user_id: userId });
      return ids;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to delete all user sessions");
      throw new Error("Error occured during deleting user session");
    }
  }

  async getAll(userId: string): Promise<userSessionI[]> {
    try {
      const docs = await this.col()
        .find({
          user_id: userId,
          expires_at: { $gt: new Date() },
        })
        .toArray();
      return docs.map((doc) => {
        const { _id, ...rest } = doc;
        return { ...rest, id: _id.toHexString() } as userSessionI;
      });
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get all user sessions");
      throw new Error("Error getting users sessions");
    }
  }

  async deleteUserSession(sessionId: string): Promise<string> {
    try {
      await this.col().deleteOne({ _id: new ObjectId(sessionId) });
      return sessionId;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to delete user session");
      throw new Error("Error deleting user session");
    }
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<userSessionI | null> {
    try {
      const doc = await this.col().findOne({
        _id: new ObjectId(sessionId),
        user_id: userId,
      });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as userSessionI;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to retrieve user session");
      throw new Error("Error retreiveng user session");
    }
  }
}

const UserSession = new UserSessionsRepo();

export default UserSession;
