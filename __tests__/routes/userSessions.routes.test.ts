import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../../src/services/user-session.service.js", () => ({
  default: {
    getAllSessions: jest.fn(),
    invalidateSession: jest.fn(),
    deleteAllSessions: jest.fn(),
    getCurrentSession: jest.fn(),
    checkStatus: jest.fn(),
    getActiveUsers: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/services/tokens.service.js", () => ({
  default: { generateAccessToken: jest.fn() },
}));

const { app } = await import("../../src/app.js");
const { default: userSessionServ } = await import("../../src/services/user-session.service.js");
const { default: tokensServ } = await import("../../src/services/tokens.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");
const { default: ApiError } = await import("../../src/utils/responses/ApiError.js");

function generateValidAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "access" },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "15m", issuer: "auth-service", audience: "user" }
  );
}

function generateValidRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d", issuer: "auth-service", audience: "user" }
  );
}

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const TEST_SESSION_ID = "507f1f77bcf86cd799439012";

describe("User Sessions Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/session/all", () => {
    it("should return all sessions for authenticated user", async () => {
      const sessions = [
        { id: TEST_SESSION_ID, user_id: TEST_USER_ID, device_id: "abc123" },
      ];
      (userSessionServ.getAllSessions as jest.Mock).mockResolvedValue(
        new ApiResponse(200, sessions, "sessions fetched successfully")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/session/all")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(userSessionServ.getAllSessions).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("should return 401 when no access token is provided", async () => {
      const res = await request(app)
        .get("/api/v1/session/all");

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
        .get("/api/v1/session/all")
        .set("Cookie", `accessToken=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (userSessionServ.getAllSessions as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/session/all")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/session/1", () => {
    it("should return current session for authenticated user", async () => {
      (userSessionServ.getCurrentSession as jest.Mock).mockResolvedValue(
        new ApiResponse(200, { user: { id: TEST_USER_ID }, session: { id: TEST_SESSION_ID } }, "Session retrieved successfully")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/session/1")
        .set("Cookie", `accessToken=${token}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(userSessionServ.getCurrentSession).toHaveBeenCalledWith(TEST_USER_ID, TEST_SESSION_ID);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get("/api/v1/session/1");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (userSessionServ.getCurrentSession as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .get("/api/v1/session/1")
        .set("Cookie", `accessToken=${token}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/session/logout", () => {
    it("should invalidate session successfully", async () => {
      (userSessionServ.invalidateSession as jest.Mock).mockResolvedValue(
        new ApiResponse(200, TEST_SESSION_ID, "Session deleted successfully")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/logout")
        .set("Cookie", `accessToken=${token}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Session deleted successfully");
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith("accessToken=;"))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("refreshToken=;"))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("sessionId=;"))).toBe(true);
      const accessClearCookie = cookies.find((c: string) => c.startsWith("accessToken=;"))!;
      expect(accessClearCookie).toContain("Path=/");
      expect(accessClearCookie).toContain("SameSite=None");
      expect(accessClearCookie).toContain("Secure");
      expect(accessClearCookie).toContain("HttpOnly");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/v1/session/logout");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (userSessionServ.invalidateSession as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/logout")
        .set("Cookie", `accessToken=${token}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/session/logout/all", () => {
    it("should logout from all devices successfully", async () => {
      (userSessionServ.deleteAllSessions as jest.Mock).mockResolvedValue(
        new ApiResponse(200, ["session1", "session2"], "Log out from all devices sucessfull")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/logout/all")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(userSessionServ.deleteAllSessions).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/v1/session/logout/all");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when no active sessions found", async () => {
      (userSessionServ.deleteAllSessions as jest.Mock).mockResolvedValue(
        new ApiError(404, "No active user sessions found")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/logout/all")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (userSessionServ.deleteAllSessions as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/logout/all")
        .set("Cookie", `accessToken=${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/session/renew", () => {
    it("should renew access token successfully", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockResolvedValue(
        new ApiResponse(200, { accessToken: "new-access-token" }, "Access token generated successfully")
      );

      const refreshToken = generateValidRefreshToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `refreshToken=${refreshToken}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe("new-access-token");
      const cookies = res.headers["set-cookie"] as unknown as string[];
      const accessCookie = cookies.find((c: string) => c.startsWith("accessToken=new-access-token"))!;
      expect(accessCookie).toContain("HttpOnly");
      expect(accessCookie).toContain("Secure");
      expect(accessCookie).toContain("SameSite=None");
      expect(accessCookie).toContain("Path=/");
    });

    it("should return 400 when refresh token is missing", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockResolvedValue(
        new ApiError(400, "Bad Request, Required fields are empty")
      );

      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when session id is missing", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockResolvedValue(
        new ApiError(400, "Bad Request, Required fields are empty")
      );

      const refreshToken = generateValidRefreshToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `refreshToken=${refreshToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 when refresh token is expired", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockResolvedValue(
        new ApiError(403, "Refresh token expired")
      );

      const refreshToken = generateValidRefreshToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `refreshToken=${refreshToken}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when refresh token is invalid", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid refresh Token")
      );

      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `refreshToken=invalid-token; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (tokensServ.generateAccessToken as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const refreshToken = generateValidRefreshToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/renew")
        .set("Cookie", `refreshToken=${refreshToken}; sessionId=${TEST_SESSION_ID}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/session/get-friend-status", () => {
    it("should return online status for a user", async () => {
      (userSessionServ.checkStatus as jest.Mock).mockResolvedValue(
        new ApiResponse(200, { isOnline: true }, "John is online")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/get-friend-status")
        .set("Cookie", `accessToken=${token}`)
        .send({ email: "friend@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnline).toBe(true);
      expect(userSessionServ.checkStatus).toHaveBeenCalledWith("friend@example.com");
    });

    it("should return offline status for a user", async () => {
      (userSessionServ.checkStatus as jest.Mock).mockResolvedValue(
        new ApiResponse(200, { isOnline: false }, "John is offline")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/get-friend-status")
        .set("Cookie", `accessToken=${token}`)
        .send({ email: "friend@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.data.isOnline).toBe(false);
    });

    it("should return 400 for invalid email", async () => {
      (userSessionServ.checkStatus as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid Email")
      );

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/get-friend-status")
        .set("Cookie", `accessToken=${token}`)
        .send({ email: "not-valid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/v1/session/get-friend-status")
        .send({ email: "friend@example.com" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (userSessionServ.checkStatus as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const token = generateValidAccessToken(TEST_USER_ID);
      const res = await request(app)
        .post("/api/v1/session/get-friend-status")
        .set("Cookie", `accessToken=${token}`)
        .send({ email: "friend@example.com" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
