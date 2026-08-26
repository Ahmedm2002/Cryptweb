import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import type { notificationI } from "../interfaces/friends.model.js";
import logger from "../utils/logger/logger.js";

class NotificationRepo {
  constructor() {}

  async create(
    userId: string,
    type: string,
    actorId?: string,
    referenceId?: string,
  ): Promise<notificationI | null> {
    try {
      const result: QueryResult<notificationI> = await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, reference_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, actorId ?? null, type, referenceId ?? null],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create notification");
      throw new Error("Error creating notification");
    }
  }

  async listByUser(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<(notificationI & { actor_name: string | null; actor_username: string | null })[]> {
    try {
      let queryStr = `
        SELECT n.*,
          u.name as actor_name,
          u.username as actor_username
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        WHERE n.user_id = $1`;
      const params: any[] = [userId];

      if (unreadOnly) {
        queryStr += " AND n.is_read = false";
      }

      queryStr += " ORDER BY n.created_at DESC";
      const result: QueryResult = await pool.query(queryStr, params);
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to list notifications");
      throw new Error("Error listing notifications");
    }
  }

  async markRead(id: string, userId: string): Promise<boolean> {
    try {
      const result: QueryResult = await pool.query(
        "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
        [id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to mark notification read");
      throw new Error("Error marking notification read");
    }
  }

  async markAllRead(userId: string): Promise<void> {
    try {
      await pool.query(
        "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
        [userId],
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to mark all notifications read");
      throw new Error("Error marking all notifications read");
    }
  }
}

const Notification = new NotificationRepo();
export default Notification;
