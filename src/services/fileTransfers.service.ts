import ApiError from "../utils/responses/ApiError.js";
import ApiResponse from "../utils/responses/ApiResponse.js";
import Users from "../repositories/user.repo.js";
import FileTransfers from "../repositories/file_transfers.repo.js";
import CONSTANTS from "../constants.js";
import isValidEmail from "../utils/helperFuncs/isValidEmail.js";
import logger from "../utils/logger/logger.js";

class FileTransfersService {
  constructor() {}

  async saveTransferComplete(data: any): Promise<ApiError | ApiResponse<any>> {
    const {
      senderEmail,
      receiverEmail,
      fileName,
      fileSize,
      fileType,
      timeElapsed,
      transferType,
    } = data;

    if (!isValidEmail(senderEmail) || !isValidEmail(receiverEmail)) {
      return new ApiError(400, "Invalid email address");
    }
    if (!fileName || !fileSize || !fileType || !timeElapsed || !transferType) {
      return new ApiError(400, "Invalid file transfer data");
    }

    try {
      const senderUser = await Users.getByEmail(senderEmail);
      const receiverUser = await Users.getByEmail(receiverEmail);

      if (!senderUser || !receiverUser) {
        logger.warn(
          "Sender or receiver not found in database for transfer-complete",
        );
        return new ApiError(404, "Sender or receiver not found");
      }

      const transfer = await FileTransfers.createTransfer({
        sender: senderUser.id as string,
        receiver: receiverUser.id as string,
        fileSize,
        fileType,
        timeElapsed,
        transferType,
      });

      logger.info(
        { sender: senderEmail, receiver: receiverEmail, fileName },
        "File transfer saved to database via HTTP service",
      );

      return new ApiResponse(
        201,
        transfer,
        "File transfer recorded successfully",
      );
    } catch (error: any) {
      logger.error({ err: error }, "Failed to save file transfer in service");
      return new ApiError(500, CONSTANTS.SERVER_ERROR);
    }
  }
}

const fileTransfersServ = new FileTransfersService();

export default fileTransfersServ;
