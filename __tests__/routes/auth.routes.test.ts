import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();

jest.unstable_mockModule("../../src/middlewares/rateLimitter.middleware.js", () => ({
  default: { authLimiter: passThrough, generalLimiter: passThrough },
}));

jest.unstable_mockModule("../../src/services/auth.service.js", () => ({
  default: {
    login: jest.fn(),
    signup: jest.fn(),
    googleLogin: jest.fn(),
  },
}));

const { app } = await import("../../src/app.js");
const { default: authServ } = await import("../../src/services/auth.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");
const { default: ApiError } = await import("../../src/utils/responses/ApiError.js");

const validUser = {
  id: "507f1f77bcf86cd799439011",
  email: "test@example.com",
  name: "Test User",
  password_hash: "$2b$10$hashedpassword",
  created_on: new Date("2024-01-01"),
};

describe("Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiResponse(200, {
          user: validUser,
          accessToken: "access-token-123",
          refreshToken: "refresh-token-123",
          sessionId: "session-id-123",
        }, "logged in successfully")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "Password123" })
        .set("User-Agent", "TestBrowser/1.0");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("logged in successfully");
      expect(res.body.data.accessToken).toBe("access-token-123");
      expect(res.body.data.refreshToken).toBe("refresh-token-123");
      expect(res.body.data.sessionId).toBe("session-id-123");
      expect(res.headers["set-cookie"]).toBeDefined();
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith("accessToken="))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("refreshToken="))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("sessionId="))).toBe(true);
      expect(authServ.login).toHaveBeenCalledWith(
        "test@example.com",
        "Password123",
        expect.any(String)
      );
    });

    it("should return 400 when email is missing", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(400, "Email and Password required")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ password: "Password123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email and Password required");
    });

    it("should return 400 when password is missing", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(400, "Email and Password required")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when user is not found", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(404, "User not found")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "nonexistent@example.com", password: "Password123" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should return 400 when credentials are invalid", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid credentials")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "WrongPassword" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid credentials");
    });

    it("should return 400 for invalid email format", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid fields", ["Invalid email"])
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "Password123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (authServ.login as jest.Mock).mockRejectedValue(new Error("Unexpected DB error"));

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "Password123" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("should not set cookies on failed login", async () => {
      (authServ.login as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid credentials")
      );

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "WrongPassword" });

      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("POST /api/v1/auth/signup", () => {
    it("should signup successfully with valid data", async () => {
      const newUser = {
        id: "507f1f77bcf86cd799439011",
        email: "new@example.com",
        name: "New User",
        created_on: new Date("2024-01-01"),
      };
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiResponse(201, { user: newUser }, "User created successfully")
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "New User",
          email: "new@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User created successfully");
      expect(res.body.data.user.email).toBe("new@example.com");
      expect(res.body.data.user.name).toBe("New User");
      expect(authServ.signup).toHaveBeenCalledWith(
        "New User",
        "Password123",
        "new@example.com"
      );
    });

    it("should return 400 when name is missing", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(400, "Missing input fields")
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ email: "new@example.com", password: "Password123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when email is missing", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(400, "Missing input fields")
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ name: "New User", password: "Password123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when password is missing", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(400, "Missing input fields")
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ name: "New User", email: "new@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when password is too short", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(400, "Password must be of length 8")
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "New User",
          email: "new@example.com",
          password: "Short1",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 409 when email already exists", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(409, "Email already exists", [])
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "Existing User",
          email: "existing@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email already exists");
    });

    it("should return 400 for invalid email format", async () => {
      (authServ.signup as jest.Mock).mockResolvedValue(
        new ApiError(400, "Invalid inputs fields", ["Invalid email"])
      );

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "New User",
          email: "not-valid",
          password: "Password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 500 when service throws unexpectedly", async () => {
      (authServ.signup as jest.Mock).mockRejectedValue(new Error("DB failure"));

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "New User",
          email: "new@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/google-login", () => {
    it("should login via google successfully", async () => {
      (authServ.googleLogin as jest.Mock).mockResolvedValue(
        new ApiResponse(200, "User created")
      );

      const res = await request(app)
        .post("/api/v1/auth/google-login")
        .send({ token: "google-oauth-token-123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(authServ.googleLogin).toHaveBeenCalledWith("google-oauth-token-123");
    });

    it("should return 500 when google login service throws", async () => {
      (authServ.googleLogin as jest.Mock).mockRejectedValue(new Error("Google API error"));

      const res = await request(app)
        .post("/api/v1/auth/google-login")
        .send({ token: "bad-token" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
