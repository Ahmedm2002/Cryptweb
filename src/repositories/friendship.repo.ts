import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import type { friendshipI } from "../interfaces/friends.model.js";
import orderPair from "../utils/helperFuncs/orderPair.js";
import logger from "../utils/logger/logger.js";

class FriendshipRepo {
  constructor() {}

  async create(userIdA: string, userIdB: string): Promise<friendshipI | null> {
    const { userOneId, userTwoId } = orderPair(userIdA, userIdB);
    try {
      const result: QueryResult<friendshipI> = await pool.query(
        `INSERT INTO friendships (user_one_id, user_two_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [userOneId, userTwoId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create friendship");
      throw new Error("Error creating friendship");
    }
  }

  async exists(userIdA: string, userIdB: string): Promise<boolean> {
    const { userOneId, userTwoId } = orderPair(userIdA, userIdB);
    try {
      const result: QueryResult = await pool.query(
        "SELECT 1 FROM friendships WHERE user_one_id = $1 AND user_two_id = $2",
        [userOneId, userTwoId],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to check friendship existence");
      throw new Error("Error checking friendship");
    }
  }

  async delete(friendshipId: string): Promise<boolean> {
    try {
      const result: QueryResult = await pool.query(
        "DELETE FROM friendships WHERE id = $1",
        [friendshipId],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to delete friendship");
      throw new Error("Error deleting friendship");
    }
  }

  async getById(friendshipId: string): Promise<friendshipI | null> {
    try {
      const result: QueryResult<friendshipI> = await pool.query(
        "SELECT * FROM friendships WHERE id = $1",
        [friendshipId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get friendship by id");
      throw new Error("Error retrieving friendship");
    }
  }

  async getFriendIds(userId: string): Promise<string[]> {
    try {
      const result: QueryResult = await pool.query(
        `SELECT
           CASE WHEN user_one_id = $1 THEN user_two_id ELSE user_one_id END as friend_id
         FROM friendships
         WHERE user_one_id = $1 OR user_two_id = $1`,
        [userId],
      );
      return result.rows.map((r) => r.friend_id);
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get friend ids");
      throw new Error("Error retrieving friend ids");
    }
  }

  async listByUser(
    userId: string,
  ): Promise<(friendshipI & { friend_id: string; friend_name: string; friend_username: string; friend_profile_picture: string | null })[]> {
    try {
      const result: QueryResult = await pool.query(
        `SELECT f.*,
           CASE WHEN f.user_one_id = $1 THEN f.user_two_id ELSE f.user_one_id END as friend_id,
           u.name as friend_name,
           u.username as friend_username,
           u.profile_picture as friend_profile_picture
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.user_one_id = $1 THEN f.user_two_id ELSE f.user_one_id END
         WHERE f.user_one_id = $1 OR f.user_two_id = $1
         ORDER BY f.created_at DESC`,
        [userId],
      );
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to list friendships");
      throw new Error("Error listing friendships");
    }
  }
}

const Friendship = new FriendshipRepo();
export default Friendship;
