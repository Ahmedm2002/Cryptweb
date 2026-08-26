import { pool } from "../configs/db.js";
import type { userI } from "../interfaces/user.model.js";
import type { QueryResult } from "pg";
import logger from "../utils/logger/logger.js";

/**
 *
 */
class UsersRepo {
  constructor() {}

  /**
   *
   * @param userId
   * @returns
   */
  async getById(userId: string): Promise<userI> {
    try {
      const result: QueryResult = await pool.query(
        "Select name, email, verified_at, profile_picture, id from users where id = $1 AND deleted_at IS NULL",
        [userId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get user by id");
      throw new Error("Error retreving user by id");
    }
  }

  /**
   *
   * @param email
   * @returns
   */
  async getByEmail(email: string): Promise<userI> {
    try {
      const result: QueryResult = await pool.query(
        "Select name, email, verified_at, profile_picture, password_hash, id from users where email = $1 AND deleted_at IS NULL",
        [email],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get user by email");
      throw new Error("Error retrieving user by email");
    }
  }

  /**
   *
   * @param user
   * @returns
   */
  async createUser(
    user: Pick<userI, "name" | "password_hash" | "email" | "username">,
  ): Promise<userI> {
    const { name, email, password_hash, username } = user;
    try {
      const result: QueryResult = await pool.query(
        `INSERT INTO users (name, email, password_hash, username) VALUES ($1, $2, $3, $4) RETURNING id, name, email, username, verified_at, created_on`,
        [name, email, password_hash, username],
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create user");
      throw new Error("Error creating user");
    }
  }

  async updatePassword(userId: string, updatedPasswordHash: string) {
    try {
      const result: QueryResult = await pool.query(
        "Update users set password_hash = $1 where id = $2 returning id",
        [updatedPasswordHash, userId],
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update user password");
      throw new Error("Error updating user password");
    }
  }

  async updateLastLogin(userId: string) {
    try {
      const result: QueryResult = await pool.query(
        "UPDATE users SET last_login_at = now() WHERE id = $1 RETURNING id",
        [userId]
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update last login");
      throw new Error("Error updating user last login timestamp");
    }
  }

  /**
   *
   * @param userId
   * @returns
   */
  async deleteUser(userId: string): Promise<userI> {
    try {
      const result: QueryResult = await pool.query(
        "Update users set deleted_at = $1 where id = $2",
        [new Date(), userId],
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to soft-delete user");
      throw new Error("Error deleting user");
    }
  }
  /**
   *
   * @param userId
   * @param tokenId
   * @returns
   */
  async setUserVerified(userId: string, tokenId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE users
       SET verified_at = now()
       WHERE id = $1
       AND verified_at is NULL
       `,
        [userId],
      );

      await client.query(
        `UPDATE email_verification_tokens
       SET used_at = now()
       WHERE id = $1
       AND used_at is NULL
       `,
        [tokenId],
      );

      await client.query("COMMIT");
    } catch (error: any) {
      logger.error({ err: error }, "Failed to set user verified");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  /**
   *
   * @param userId
   */
  async setVerifiedState(userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE users
         SET verified_at = now()
         WHERE id = $1
         AND verified_at is NULL`,
        [userId],
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to set user verified state");
    }
  }

  async getByUsername(username: string): Promise<userI> {
    try {
      const result: QueryResult = await pool.query(
        "SELECT id, name, email, username, profile_picture FROM users WHERE username = $1 AND deleted_at IS NULL",
        [username],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get user by username");
      throw new Error("Error retrieving user by username");
    }
  }

  async searchByUsername(
    query: string,
    requesterId: string,
    excludeFriendIds: string[],
  ): Promise<Pick<userI, "id" | "name" | "username" | "email" | "profile_picture">[]> {
    try {
      const params: any[] = [`%${query}%`, requesterId];
      let queryStr =
        "SELECT id, name, username, email, profile_picture FROM users WHERE (username ILIKE $1 OR email ILIKE $1) AND id != $2 AND deleted_at IS NULL";

      if (excludeFriendIds.length > 0) {
        params.push(excludeFriendIds);
        queryStr += ` AND id != ALL($${params.length}::uuid[])`;
      }

      queryStr += " LIMIT 20";
      const result: QueryResult = await pool.query(queryStr, params);
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to search users by username or email");
      throw new Error("Error searching users by username or email");
    }
  }

  async updateSaveMessagesDefault(
    userId: string,
    saveMessagesDefault: boolean,
  ): Promise<void> {
    try {
      await pool.query(
        "UPDATE users SET save_messages_default = $1 WHERE id = $2",
        [saveMessagesDefault, userId],
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update save messages default");
      throw new Error("Error updating save messages default");
    }
  }

  async getSaveMessagesDefault(userId: string): Promise<boolean> {
    try {
      const result: QueryResult = await pool.query(
        "SELECT save_messages_default FROM users WHERE id = $1",
        [userId],
      );
      return result.rows[0]?.save_messages_default ?? false;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get save messages default");
      throw new Error("Error getting save messages default");
    }
  }
}

const Users = new UsersRepo();
export default Users;
