import { getDb } from "../configs/db.js";
import { ObjectId } from "mongodb";
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

  async getRecentByUser(
    userId: string,
    limit: number = 10,
    page: number = 1,
  ) {
    try {
      const skip = (page - 1) * limit;
      const matchStage = {
        $or: [{ sender: userId }, { receiver: userId }],
      };

      const [results, totalSent, totalReceived] = await Promise.all([
        this.col()
          .aggregate([
            { $match: matchStage },
            { $sort: { completed_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "senderDoc",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "receiver",
                foreignField: "_id",
                as: "receiverDoc",
              },
            },
            {
              $unwind: {
                path: "$senderDoc",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$receiverDoc",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 0,
                id: { $toString: "$_id" },
                fileSize: "$file_size",
                fileType: "$file_type",
                timeElapsed: "$time_elapsed",
                transferType: "$transfer_type",
                completedAt: "$completed_at",
                senderName: "$senderDoc.name",
                senderEmail: "$senderDoc.email",
                receiverName: "$receiverDoc.name",
                receiverEmail: "$receiverDoc.email",
              },
            },
          ])
          .toArray(),
        this.col().countDocuments({ sender: userId }),
        this.col().countDocuments({ receiver: userId }),
      ]);

      return {
        transfers: results,
        totalSent,
        totalReceived,
        total: totalSent + totalReceived,
      };
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
