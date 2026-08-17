import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

jest.unstable_mockModule("../../src/services/reset-password.service.js", () => ({
  default: { forgotPassword: jest.fn(), resetPassword: jest.fn() },
}));

const { app } = await import("../../src/app.js");
const { default: resetPasswordServ } = await import("../../src/services/reset-password.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");
const { default: ApiError } = await import("../../src/utils/responses/ApiError.js");

describe("Reset Password Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/password/forgot", () => {
    it("should send reset email successfully", async () => {
      (resetPasswordServ.forgotPassword as jest.Mock).mockResolvedValue(
        new ApiResponse(200, null, "If the email exists, a reset link has been sent.")
      );

      const res = await request(app)
        .post("/api/v1/password/forgot")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("If the email exists, a reset link has been sent.");
      expect(resetPasswordServ.forgotPassword).toHaveBeenCalledWith("test@example.com");
    });

    it("should return 400 for invalid email format", async () => {
      (resetPasswordServ.forgotPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid email address")
      );

      const res = await request(app)
        .post("/api/v1/password/forgot")
        .send({ email: "not-valid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email address");
    });

    it("should return 404 when user is not found", async () => {
      (resetPasswordServ.forgotPassword as jest.Mock).mockResolvedValue(
        new ApiError(404, "User not found")
      );

      const res = await request(app)
        .post("/api/v1/password/forgot")
        .send({ email: "unknown@example.com" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should return 500 when token generation fails", async () => {
      (resetPasswordServ.forgotPassword as jest.Mock).mockResolvedValue(
        new ApiError(500, "Error generating reset password token")
      );

      const res = await request(app)
        .post("/api/v1/password/forgot")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (resetPasswordServ.forgotPassword as jest.Mock).mockRejectedValue(new Error("Email service down"));

      const res = await request(app)
        .post("/api/v1/password/forgot")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/password/reset", () => {
    it("should reset password successfully", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiResponse(200, null, "Password reset successful, Please Login again")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "NewPassword123",
          confirmPassword: "NewPassword123",
          token: "valid-reset-token-abc123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Password reset successful, Please Login again");
      expect(resetPasswordServ.resetPassword).toHaveBeenCalledWith(
        "NewPassword123",
        "valid-reset-token-abc123",
        "NewPassword123"
      );
    });

    it("should return 400 when token is missing", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Token and password required")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({ password: "NewPassword123", confirmPassword: "NewPassword123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when password is missing", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Token and password required")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({ token: "valid-token", confirmPassword: "NewPassword123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when passwords do not match", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Password does not matches")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "Password123",
          confirmPassword: "DifferentPassword123",
          token: "valid-token",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Password does not matches");
    });

    it("should return 404 when reset token is invalid", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(404, "Invalid or no active reset token found")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "NewPassword123",
          confirmPassword: "NewPassword123",
          token: "invalid-token",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when token is already used", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Token already used")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "NewPassword123",
          confirmPassword: "NewPassword123",
          token: "used-token",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token already used");
    });

    it("should return 400 when token is expired", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Reset Token Expired")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "NewPassword123",
          confirmPassword: "NewPassword123",
          token: "expired-token",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Reset Token Expired");
    });

    it("should return 400 for invalid password format", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid Password")
      );

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "short",
          confirmPassword: "short",
          token: "valid-token",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (resetPasswordServ.resetPassword as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const res = await request(app)
        .post("/api/v1/password/reset")
        .send({
          password: "NewPassword123",
          confirmPassword: "NewPassword123",
          token: "valid-token",
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
