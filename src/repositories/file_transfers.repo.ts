import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import logger from "../utils/logger/logger.js";

export interface CreateFileTransferDTO {
  sender: string;
  receiver: string;
  fileSize: number;
  fileType: string;
  timeElapsed: number;
  transferType: string;
}

class FileTransfersRepository {
  async createTransfer(data: CreateFileTransferDTO) {
    try {
      const result: QueryResult = await pool.query(
        `INSERT INTO file_transfers 
          (sender, receiver, file_size, file_type, time_elapsed, completed_at, transfer_type) 
         VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING id`,
        [
          data.sender,
          data.receiver,
          data.fileSize,
          data.fileType,
          data.timeElapsed,
          data.transferType,
        ],
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error(
        { err: error, data },
        "Failed to create file transfer record",
      );
      throw new Error("Error creating file transfer record");
    }
  }

  async getRecentByUser(userId: string, limit: number = 10) {
    try {
      const result: QueryResult = await pool.query(
        `SELECT
          ft.id,
          ft.file_size AS "fileSize",
          ft.file_type AS "fileType",
          ft.time_elapsed AS "timeElapsed",
          ft.transfer_type AS "transferType",
          ft.completed_at AS "completedAt",
          senderUser.name AS "senderName",
          senderUser.email AS "senderEmail",
          receiverUser.name AS "receiverName",
          receiverUser.email AS "receiverEmail"
         FROM file_transfers ft
         JOIN users senderUser ON ft.sender = senderUser.id
         JOIN users receiverUser ON ft.receiver = receiverUser.id
         WHERE ft.sender = $1 OR ft.receiver = $1
         ORDER BY ft.completed_at DESC NULLS LAST
         LIMIT $2`,
        [userId, limit],
      );
      return result.rows;
    } catch (error: any) {
      logger.error(
        { err: error, userId },
        "Failed to fetch recent file transfers",
      );
      throw new Error("Error fetching recent file transfers");
    }
  }
}

const FileTransfers = new FileTransfersRepository();
export default FileTransfers;
