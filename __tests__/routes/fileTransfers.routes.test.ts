import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../../src/services/fileTransfers.service.js", () => ({
  default: { getRecentTransfers: jest.fn(), saveTransferComplete: jest.fn() },
}));

const { app } = await import("../../src/app.js");
const { default: fileTransfersServ } = await import("../../src/services/fileTransfers.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");
const { default: ApiError } = await import("../../src/utils/responses/ApiError.js");

function generateValidAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "access" },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "15m", issuer: "auth-service", audience: "user" }
  );
}

const TEST_USER_ID = "507f1f77bcf86cd799439011";

describe("File Transfers Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/file-transfers/recent", () => {
    it("should return recent transfers for authenticated user", async () => {
      const transfers = [
        {
          id: "transfer1",
          fileSize: 5.5,
          fileType: "image/png",
          timeElapsed: 12.3,
          transferType: "p2p",
          completedAt: new Date().toISOString(),
          senderName: "Alice",
          senderEmail: "alice@example.com",
          receiverName: "Bob",
          receiverEmail: "bob@example.com",
        },
      ];
      (fileTransfersServ.getRecentTransfers as jest.Mock).mockResolvedValue(
        new ApiResponse(200, {
          transfers,
          pageNo: 1,
          totalPages: 1,
          totalSent: 5,
          totalReceived: 3,
        }, "Recent transfers fetched")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/file-transfers/recent")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transfers).toHaveLength(1);
      expect(res.body.data.transfers[0].fileType).toBe("image/png");
      expect(res.body.data.pageNo).toBe(1);
      expect(res.body.data.totalPages).toBe(1);
      expect(res.body.data.totalSent).toBe(5);
      expect(res.body.data.totalReceived).toBe(3);
      expect(fileTransfersServ.getRecentTransfers).toHaveBeenCalledWith(TEST_USER_ID, 10, 1);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get("/api/v1/file-transfers/recent");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when access token is expired", async () => {
      const expiredToken = jwt.sign(
        { sub: TEST_USER_ID, type: "access" },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "0s", issuer: "auth-service", audience: "user" }
      );

      const res = await request(app)
        .get("/api/v1/file-transfers/recent")
        .set("Cookie", `accessToken=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should use custom limit when provided", async () => {
      (fileTransfersServ.getRecentTransfers as jest.Mock).mockResolvedValue(
        new ApiResponse(200, {
          transfers: [],
          pageNo: 1,
          totalPages: 0,
          totalSent: 0,
          totalReceived: 0,
        }, "Recent transfers fetched")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/file-transfers/recent?limit=5")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(fileTransfersServ.getRecentTransfers).toHaveBeenCalledWith(TEST_USER_ID, 5, 1);
    });

    it("should default to limit 10 when no limit is provided", async () => {
      (fileTransfersServ.getRecentTransfers as jest.Mock).mockResolvedValue(
        new ApiResponse(200, {
          transfers: [],
          pageNo: 1,
          totalPages: 0,
          totalSent: 0,
          totalReceived: 0,
        }, "Recent transfers fetched")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/file-transfers/recent")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(fileTransfersServ.getRecentTransfers).toHaveBeenCalledWith(TEST_USER_ID, 10, 1);
    });

    it("should pass page number to service when provided", async () => {
      (fileTransfersServ.getRecentTransfers as jest.Mock).mockResolvedValue(
        new ApiResponse(200, {
          transfers: [],
          pageNo: 3,
          totalPages: 5,
          totalSent: 20,
          totalReceived: 30,
        }, "Recent transfers fetched")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/file-transfers/recent?page=3")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pageNo).toBe(3);
      expect(res.body.data.totalPages).toBe(5);
      expect(fileTransfersServ.getRecentTransfers).toHaveBeenCalledWith(TEST_USER_ID, 10, 3);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (fileTransfersServ.getRecentTransfers as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/file-transfers/recent")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/file-transfers/complete", () => {
    it("should save transfer successfully", async () => {
      const transferData = { id: "new-transfer-id" };
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockResolvedValue(
        new ApiResponse(201, transferData, "File transfer recorded successfully")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "alice@example.com",
          receiverEmail: "bob@example.com",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("File transfer recorded successfully");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .send({
          senderEmail: "alice@example.com",
          receiverEmail: "bob@example.com",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid sender email", async () => {
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid email address")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "not-valid",
          receiverEmail: "bob@example.com",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid receiver email", async () => {
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid email address")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "alice@example.com",
          receiverEmail: "not-valid",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when required fields are missing", async () => {
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid file transfer data")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "alice@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when sender or receiver is not found", async () => {
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockResolvedValue(
        new ApiError(404, "Sender or receiver not found")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "alice@example.com",
          receiverEmail: "nonexistent@example.com",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (fileTransfersServ.saveTransferComplete as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/file-transfers/complete")
        .set("Cookie", `accessToken=${token}`)
        .send({
          senderEmail: "alice@example.com",
          receiverEmail: "bob@example.com",
          fileName: "photo.png",
          fileSize: 1048576,
          fileType: "image/png",
          timeElapsed: 5.2,
          transferType: "p2p",
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
