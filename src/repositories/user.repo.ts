import { getDb } from "../configs/db.js";
import type { userI } from "../interfaces/user.model.js";
import { ObjectId } from "mongodb";
import logger from "../utils/logger/logger.js";

class UsersRepo {
  constructor() {}

  private col() {
    return getDb().collection<userI & { _id: ObjectId }>("users");
  }

  async getById(userId: string): Promise<userI> {
    try {
      const doc = await this.col().findOne({
        _id: new ObjectId(userId),
        deleted_at: { $exists: false },
      });
      if (!doc) return null as any;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as userI;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get user by id");
      throw new Error("Error retreving user by id");
    }
  }

  async getByEmail(email: string): Promise<userI> {
    try {
      const doc = await this.col().findOne({
        email,
        deleted_at: { $exists: false },
      });
      if (!doc) return null as any;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as userI;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get user by email");
      throw new Error("Error retrieving user by email");
    }
  }

  async createUser(
    user: Pick<userI, "name" | "password_hash" | "email">,
  ): Promise<userI> {
    const { name, email, password_hash } = user;
    try {
      const now = new Date();
      const result = await this.col().insertOne({
        name,
        email,
        password_hash,
        created_on: now,
        updated_on: now,
      } as any);
      return {
        id: result.insertedId.toHexString(),
        name,
        email,
        password_hash,
        created_on: now,
      } as userI;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create user");
      throw new Error("Error creating user");
    }
  }

  async updatePassword(userId: string, updatedPasswordHash: string) {
    try {
      await this.col().updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: { password_hash: updatedPasswordHash, updated_on: new Date() },
        },
      );
      return { id: userId };
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update user password");
      throw new Error("Error updating user password");
    }
  }

  async updateLastLogin(userId: string) {
    try {
      await this.col().updateOne(
        { _id: new ObjectId(userId) },
        { $set: { last_login_at: new Date() } },
      );
      return { id: userId };
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update last login");
      throw new Error("Error updating user last login timestamp");
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.col().updateOne(
        { _id: new ObjectId(userId) },
        { $set: { deleted_at: new Date() } },
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to soft-delete user");
      throw new Error("Error deleting user");
    }
  }

  async setUserVerified(userId: string, tokenId: string) {
    const db = getDb();
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await db
          .collection("users")
          .updateOne(
            { _id: new ObjectId(userId), verified_at: { $exists: false } },
            { $set: { verified_at: new Date() } },
            { session },
          );

        await db
          .collection("email_verification_tokens")
          .updateOne(
            { _id: new ObjectId(tokenId), used_at: { $exists: false } },
            { $set: { used_at: new Date() } },
            { session },
          );
      });
    } catch (error: any) {
      logger.error({ err: error }, "Failed to set user verified");
    } finally {
      await session.endSession();
    }
  }

  async setVerifiedState(userId: string): Promise<void> {
    try {
      await this.col().updateOne(
        { _id: new ObjectId(userId), verified_at: { $exists: false } },
        { $set: { verified_at: new Date() } },
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to set user verified state");
    }
  }
}

const Users = new UsersRepo();
export default Users;
