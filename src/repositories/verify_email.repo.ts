import { getDb } from "../configs/db.js";
import type { EmailVerificationI } from "../interfaces/email-verification.model.js";
import { ObjectId } from "mongodb";
import logger from "../utils/logger/logger.js";

class EmailVerificationRepo {
  constructor() {}

  private col() {
    return getDb().collection<EmailVerificationI & { _id: ObjectId }>(
      "email_verification_tokens",
    );
  }

  async insert(userId: string, token: string): Promise<string | null> {
    if (!userId || !token) throw new Error("Token and user id are missing");

    try {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const now = new Date();

      const existing = await this.col().findOne({ user_id: userId });

      if (existing) {
        await this.col().updateOne(
          { _id: existing._id },
          {
            $set: {
              token_hash: token,
              revoked_at: now,
              expires_at: expiresAt,
              created_at: now,
            },
          },
        );
        return existing._id.toHexString();
      }

      const result = await this.col().insertOne({
        user_id: userId,
        token_hash: token,
        expires_at: expiresAt,
        created_at: now,
      } as any);
      return result.insertedId.toHexString();
    } catch (error: any) {
      logger.fatal({ err: error }, "Failed to insert verification token");
      throw new Error("Error adding verification token");
    }
  }

  async getUserCode(userId: string): Promise<EmailVerificationI> {
    try {
      const doc = await this.col().findOne({ user_id: userId });
      if (!doc) return null as any;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as EmailVerificationI;
    } catch (error) {
      logger.fatal({ err: error }, "Failed to retrieve verification token");
      throw new Error("Error getting user code");
    }
  }
}

const emaiVerification = new EmailVerificationRepo();

export default emaiVerification;
