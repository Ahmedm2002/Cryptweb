import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

jest.unstable_mockModule("../../src/services/verify-email.service.js", () => ({
  default: { verifyEmail: jest.fn(), resendCode: jest.fn() },
}));

const { app } = await import("../../src/app.js");
const { default: verifyUserServ } = await import("../../src/services/verify-email.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");
const { default: ApiError } = await import("../../src/utils/responses/ApiError.js");

describe("Verify User Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/verify/email", () => {
    it("should verify email successfully with valid code", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiResponse(200, null, "User verified successfully")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User verified successfully");
      expect(verifyUserServ.verifyEmail).toHaveBeenCalledWith("test@example.com", "123456");
    });

    it("should return 400 when code is missing", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(400, "Please enter 6 digit verification code")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when email is missing", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(400, "Please enter 6 digit verification code")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ code: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when code is wrong length", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(400, "Please enter 6 digit verification code")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when user is not found", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(404, "User not found")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "unknown@example.com", code: "123456" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when code is invalid", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid code")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "000000" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when token is expired", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiError(400, "Token Expired")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "123456" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 when email is already verified", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockResolvedValue(
        new ApiResponse(200, null, "Email already verified")
      );

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (verifyUserServ.verifyEmail as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const res = await request(app)
        .post("/api/v1/verify/email")
        .send({ email: "test@example.com", code: "123456" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/verify/resend-code", () => {
    it("should resend code successfully", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockResolvedValue(
        new ApiResponse(201, null, "Code send to email")
      );

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Code send to email");
      expect(verifyUserServ.resendCode).toHaveBeenCalledWith("test@example.com");
    });

    it("should return 400 when email is missing", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockResolvedValue(
        new ApiError(400, "Email Required")
      );

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid email format", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid email address")
      );

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({ email: "not-valid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when user is not found", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockResolvedValue(
        new ApiError(404, "User not found")
      );

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({ email: "unknown@example.com" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 when user is already verified", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockResolvedValue(
        new ApiResponse(200, null, "User already verified")
      );

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({ email: "verified@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (verifyUserServ.resendCode as jest.Mock).mockRejectedValue(new Error("Email service down"));

      const res = await request(app)
        .post("/api/v1/verify/resend-code")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
