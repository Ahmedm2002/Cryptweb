import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import type {
  conversationI,
  conversationPreferenceI,
} from "../interfaces/friends.model.js";
import orderPair from "../utils/helperFuncs/orderPair.js";
import logger from "../utils/logger/logger.js";

class ConversationRepo {
  constructor() {}

  async create(userIdA: string, userIdB: string): Promise<conversationI | null> {
    const { userOneId, userTwoId } = orderPair(userIdA, userIdB);
    try {
      const result: QueryResult<conversationI> = await pool.query(
        `INSERT INTO conversations (user_one_id, user_two_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [userOneId, userTwoId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create conversation");
      throw new Error("Error creating conversation");
    }
  }

  async getById(conversationId: string): Promise<conversationI | null> {
    try {
      const result: QueryResult<conversationI> = await pool.query(
        "SELECT * FROM conversations WHERE id = $1",
        [conversationId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get conversation by id");
      throw new Error("Error retrieving conversation");
    }
  }

  async getByUsers(userIdA: string, userIdB: string): Promise<conversationI | null> {
    const { userOneId, userTwoId } = orderPair(userIdA, userIdB);
    try {
      const result: QueryResult<conversationI> = await pool.query(
        "SELECT * FROM conversations WHERE user_one_id = $1 AND user_two_id = $2",
        [userOneId, userTwoId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get conversation by users");
      throw new Error("Error retrieving conversation");
    }
  }

  async isParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const result: QueryResult = await pool.query(
        "SELECT 1 FROM conversations WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)",
        [conversationId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to check conversation participation");
      throw new Error("Error checking conversation participation");
    }
  }

  async listByUser(
    userId: string,
  ): Promise<
    (conversationI & {
      other_user_id: string;
      other_user_name: string;
      other_user_username: string;
      other_user_profile_picture: string | null;
      last_message: string | null;
      last_message_at: Date | null;
    })[]
  > {
    try {
      const result: QueryResult = await pool.query(
        `SELECT c.*,
           CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END as other_user_id,
           u.name as other_user_name,
           u.username as other_user_username,
           u.profile_picture as other_user_profile_picture,
           m.content as last_message,
           m.created_at as last_message_at
         FROM conversations c
         JOIN users u ON u.id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
         LEFT JOIN LATERAL (
           SELECT content, created_at
           FROM messages
           WHERE conversation_id = c.id
             AND ((sender_id = $1 AND saved_for_sender) OR (sender_id != $1 AND saved_for_receiver))
           ORDER BY created_at DESC
           LIMIT 1
         ) m ON true
         WHERE c.user_one_id = $1 OR c.user_two_id = $1
         ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
        [userId],
      );
      return result.rows;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to list conversations");
      throw new Error("Error listing conversations");
    }
  }

  async upsertPreference(
    conversationId: string,
    userId: string,
    saveMessages: boolean,
  ): Promise<conversationPreferenceI> {
    try {
      const result: QueryResult<conversationPreferenceI> = await pool.query(
        `INSERT INTO conversation_preferences (conversation_id, user_id, save_messages)
         VALUES ($1, $2, $3)
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET save_messages = $3, updated_at = NOW()
         RETURNING *`,
        [conversationId, userId, saveMessages],
      );
      return result.rows[0]!;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to upsert conversation preference");
      throw new Error("Error upserting conversation preference");
    }
  }

  async getPreference(
    conversationId: string,
    userId: string,
  ): Promise<conversationPreferenceI | null> {
    try {
      const result: QueryResult<conversationPreferenceI> = await pool.query(
        "SELECT * FROM conversation_preferences WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId],
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to get conversation preference");
      throw new Error("Error retrieving conversation preference");
    }
  }

  async deletePreferencesForUser(userId: string): Promise<void> {
    try {
      await pool.query(
        "DELETE FROM conversation_preferences WHERE user_id = $1",
        [userId],
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to delete user conversation preferences");
      throw new Error("Error deleting user conversation preferences");
    }
  }
}

const Conversation = new ConversationRepo();
export default Conversation;
