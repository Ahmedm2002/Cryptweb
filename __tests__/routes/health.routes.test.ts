import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

jest.unstable_mockModule("../../src/services/health.service.js", () => ({
  default: { serverHealth: jest.fn() },
}));

const { app } = await import("../../src/app.js");
const { default: healthServ } = await import("../../src/services/health.service.js");
const { default: ApiResponse } = await import("../../src/utils/responses/ApiResponse.js");

describe("Health Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/health", () => {
    it("should return 200 with health data when database is up", async () => {
      const healthData = {
        app: {
          status: "up",
          uptime: 123.45,
          memoryUsage: {
            rss: "50.00 MB",
            heapTotal: "30.00 MB",
            heapUsed: "20.00 MB",
            external: "5.00 MB",
          },
        },
        database: { status: "healthy", latency: "2 ms" },
      };
      (healthServ.serverHealth as jest.Mock).mockResolvedValue(
        new ApiResponse(200, healthData, "Health check successful")
      );

      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Health check successful");
      expect(res.body.data.app.status).toBe("up");
      expect(res.body.data.database.status).toBe("healthy");
      expect(healthServ.serverHealth).toHaveBeenCalled();
    });

    it("should return 503 when database is down", async () => {
      const healthData = {
        app: {
          status: "up",
          uptime: 123.45,
          memoryUsage: {
            rss: "50.00 MB",
            heapTotal: "30.00 MB",
            heapUsed: "20.00 MB",
            external: "5.00 MB",
          },
        },
        database: { status: "down", latency: "0 ms" },
      };
      (healthServ.serverHealth as jest.Mock).mockResolvedValue(
        new ApiResponse(503, healthData, "Service unavailable")
      );

      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.database.status).toBe("down");
    });

    it("should return health data with correct memory format", async () => {
      const healthData = {
        app: {
          status: "up",
          uptime: 0.01,
          memoryUsage: {
            rss: "10.50 MB",
            heapTotal: "5.25 MB",
            heapUsed: "3.75 MB",
            external: "1.00 MB",
          },
        },
        database: { status: "healthy", latency: "1 ms" },
      };
      (healthServ.serverHealth as jest.Mock).mockResolvedValue(
        new ApiResponse(200, healthData, "Health check successful")
      );

      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.data.app.uptime).toBe(0.01);
      expect(res.body.data.app.memoryUsage.rss).toBe("10.50 MB");
      expect(res.body.data.app.memoryUsage.heapTotal).toBe("5.25 MB");
      expect(res.body.data.app.memoryUsage.heapUsed).toBe("3.75 MB");
      expect(res.body.data.app.memoryUsage.external).toBe("1.00 MB");
    });
  });
});
