import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import type { messageI } from "../interfaces/friends.model.js";
import logger from "../utils/logger/logger.js";

class MessageRepo {
  constructor() {}

  async create(
    conversationId: string,
    senderId: string,
    content: string,
    savedForSender: boolean,
    savedForReceiver: boolean,
  ): Promise<messageI | null> {
    try {
      const result: QueryResult<messageI> = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content, saved_for_sender, saved_for_receiver)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [conversationId, senderId, content, savedForSender, savedForReceiver],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create message");
      throw new Error("Error creating message");
    }
  }

  async getSavedByUser(
    conversationId: string,
    userId: string,
    limit: number,
    before?: string,
  ): Promise<messageI[]> {
    try {
      const params: any[] = [conversationId, userId, limit];
      let queryStr = `
        SELECT * FROM messages
        WHERE conversation_id = $1
          AND ((sender_id = $2 AND saved_for_sender) OR (sender_id != $2 AND saved_for_receiver))`;

      if (before) {
        params.push(before);
        queryStr += ` AND created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
      }

      queryStr += " ORDER BY created_at DESC LIMIT $3";
      const result: QueryResult<messageI> = await pool.query(queryStr, params);
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get saved messages");
      throw new Error("Error retrieving saved messages");
    }
  }
}

const Message = new MessageRepo();
export default Message;
