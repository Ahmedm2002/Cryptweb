import { getDb } from "../configs/db.js";
import type { PasswordResetI } from "../interfaces/password-reset.model.js";
import { ObjectId } from "mongodb";

class ResetPasswordRepo {
  constructor() {}

  private col() {
    return getDb().collection<PasswordResetI & { _id: ObjectId }>(
      "password_reset_tokens",
    );
  }

  async insertToken(userId: string, tokenHash: string): Promise<string> {
    try {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const now = new Date();

      const existing = await this.col().findOne({ user_id: userId });

      if (existing) {
        await this.col().updateOne(
          { _id: existing._id },
          {
            $set: {
              token_hash: tokenHash,
              created_at: now,
              revoked_at: now,
              expires_at: expiresAt,
            },
          },
        );
        return existing._id.toHexString();
      }

      const result = await this.col().insertOne({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: now,
      } as any);
      return result.insertedId.toHexString();
    } catch (error: any) {
      throw new Error(
        "Error inserting token for password recovery token table",
      );
    }
  }

  async setTokenUsedAt(tokenId: string): Promise<string> {
    try {
      await this.col().updateOne(
        { _id: new ObjectId(tokenId), expires_at: { $exists: true } },
        { $set: { used_at: new Date() } },
      );
      return tokenId;
    } catch (error: any) {
      throw new Error("Error updating token for password recovery token table");
    }
  }

  async getUserToken(userId: string): Promise<PasswordResetI | null> {
    try {
      const doc = await this.col().findOne({ user_id: userId });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as PasswordResetI;
    } catch (error) {
      throw new Error("Error retrieving user password recovery token");
    }
  }

  async getTokenByHash(tokenHash: string): Promise<PasswordResetI | null> {
    try {
      const doc = await this.col().findOne({ token_hash: tokenHash });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toHexString() } as PasswordResetI;
    } catch (error) {
      throw new Error("Error retrieving token by hash");
    }
  }
}

const resetPassRepo = new ResetPasswordRepo();

export default resetPassRepo;
