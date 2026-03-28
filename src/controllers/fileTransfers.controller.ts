import type { Request, Response } from "express";
import ApiError from "../utils/responses/ApiError.js";
import CONSTANTS from "../constants.js";
import fileTransfersServ from "../services/fileTransfers.service.js";
import logger from "../utils/logger/logger.js";

/**
 *
 * @param req
 * @param res
 * @returns
 */
async function saveTransferComplete(req: Request, res: Response) {
  try {
    const response = await fileTransfersServ.saveTransferComplete(req.body);
    return res.status(response.statusCode).json(response);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to save file transfer unexpectedly");
    return res.status(500).json(new ApiError(500, CONSTANTS.SERVER_ERROR));
  }
}

export { saveTransferComplete };
