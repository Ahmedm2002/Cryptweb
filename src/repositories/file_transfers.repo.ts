import { pool } from "../configs/db.js";
import type { QueryResult } from "pg";
import logger from "../utils/logger/logger.js";

export interface CreateFileTransferDTO {
  sender: string;
  receiver: string;
  fileName: string;
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
          (sender, receiver, file_name, file_size, file_type, time_elapsed, completed_at, transfer_type) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING *`,
        [
          data.sender,
          data.receiver,
          data.fileName,
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
}

const FileTransfers = new FileTransfersRepository();
export default FileTransfers;
