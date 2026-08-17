import { getDb } from "../configs/db.js";
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
  private col() {
    return getDb().collection("file_transfers");
  }

  async createTransfer(data: CreateFileTransferDTO) {
    try {
      const result = await this.col().insertOne({
        sender: data.sender,
        receiver: data.receiver,
        file_size: data.fileSize,
        file_type: data.fileType,
        time_elapsed: data.timeElapsed,
        completed_at: new Date(),
        transfer_type: data.transferType,
      });
      return { id: result.insertedId.toHexString() };
    } catch (error: any) {
      logger.error(
        { err: error, data },
        "Failed to create file transfer record",
      );
      throw new Error("Error creating file transfer record");
    }
  }

  async getRecentByUser(userId: string, limit: number = 10, page: number = 1) {
    try {
      const skip = (page - 1) * limit;
      const matchStage = {
        $or: [{ sender: userId }, { receiver: userId }],
      };

      const [results, total] = await Promise.all([
        this.col()
          .find(matchStage)
          .sort({ completed_at: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.col().countDocuments(matchStage),
      ]);

      const transfers = results.map((doc) => {
        const { _id, sender, receiver, ...rest } = doc;
        return { id: _id.toHexString(), ...rest };
      });

      return { transfers, total };
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
