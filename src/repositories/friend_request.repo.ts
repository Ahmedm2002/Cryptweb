import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import type { friendRequestI } from "../interfaces/friends.model.js";
import logger from "../utils/logger/logger.js";

class FriendRequestRepo {
  constructor() {}

  async create(
    senderId: string,
    receiverId: string,
  ): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        `INSERT INTO friend_requests (sender_id, receiver_id)
         VALUES ($1, $2)
         ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', responded_at = NULL
         RETURNING *`,
        [senderId, receiverId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create friend request");
      throw new Error("Error creating friend request");
    }
  }

  async getById(id: string): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        "SELECT * FROM friend_requests WHERE id = $1",
        [id],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get friend request by id");
      throw new Error("Error retrieving friend request");
    }
  }

  async getBySenderAndReceiver(
    senderId: string,
    receiverId: string,
  ): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        "SELECT * FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'",
        [senderId, receiverId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error(
        { err: error },
        "Failed to get friend request by sender and receiver",
      );
      throw new Error("Error retrieving friend request");
    }
  }

  async getPendingByReceiverAndSender(
    receiverId: string,
    senderId: string,
  ): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        "SELECT * FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'",
        [senderId, receiverId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error(
        { err: error },
        "Failed to get pending friend request by receiver and sender",
      );
      throw new Error("Error retrieving friend request");
    }
  }

  async listByUser(
    userId: string,
    direction: "incoming" | "outgoing",
    status?: string,
  ): Promise<(friendRequestI & { actor_name: string; actor_username: string })[]> {
    try {
      let queryStr: string;
      const params: any[] = [userId];

      if (direction === "incoming") {
        queryStr = `
          SELECT fr.*, u.name as actor_name, u.username as actor_username
          FROM friend_requests fr
          JOIN users u ON u.id = fr.sender_id
          WHERE fr.receiver_id = $1`;
      } else {
        queryStr = `
          SELECT fr.*, u.name as actor_name, u.username as actor_username
          FROM friend_requests fr
          JOIN users u ON u.id = fr.receiver_id
          WHERE fr.sender_id = $1`;
      }

      if (status) {
        params.push(status);
        queryStr += ` AND fr.status = $${params.length}`;
      }

      queryStr += " ORDER BY fr.created_at DESC";
      const result: QueryResult = await pool.query(queryStr, params);
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to list friend requests");
      throw new Error("Error listing friend requests");
    }
  }

  async setStatus(
    id: string,
    status: string,
  ): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        `UPDATE friend_requests SET status = $1, responded_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update friend request status");
      throw new Error("Error updating friend request status");
    }
  }

  async cancel(id: string): Promise<friendRequestI | null> {
    try {
      const result: QueryResult<friendRequestI> = await pool.query(
        `UPDATE friend_requests SET status = 'cancelled', responded_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *`,
        [id],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to cancel friend request");
      throw new Error("Error cancelling friend request");
    }
  }
}

const FriendRequest = new FriendRequestRepo();
export default FriendRequest;
