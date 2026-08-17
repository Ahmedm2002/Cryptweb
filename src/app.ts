import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import v1Router from "./router/v1/index.js";
import ApiResponse from "./utils/responses/ApiResponse.js";
import transport from "./configs/nodemailer.js";
import helmet from "helmet";

import logger from "./utils/logger/logger.js";
import logRequest from "./middlewares/logger.middleware.js";
import corsMiddleware from "./middlewares/cors.middleware.js";
import os from "node:os";
import { ipToUsersMap, emailToSocketMap, normalizeIP } from "./utils/networkStore.js";

const apiVersion = process.env.API_VERSION;

const app: Express = express();
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(helmet());
app.use(corsMiddleware);

// transport.verify();
app.use(logRequest);
app.use(`/api`, v1Router);

app.get("/api/", (req, res) => {
  logger.info("/GET successfull");
  return res
    .status(200)
    .json(new ApiResponse(200, { version: apiVersion }, "Working fine."));
});

app.get("/api/network/ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let lanIP = "127.0.0.1";
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        lanIP = addr.address;
        break;
      }
    }
    if (lanIP !== "127.0.0.1") break;
  }

  const clientIP = normalizeIP(req.ip || req.socket.remoteAddress || "");
  const usersOnNetwork = ipToUsersMap.get(clientIP);
  const onlineUsers = usersOnNetwork
    ? Array.from(usersOnNetwork).map((email) => ({
        email,
        name: emailToSocketMap.get(email)?.name || email,
      }))
    : [];

  return res.status(200).json(
    new ApiResponse(200, { ip: lanIP, onlineUsers }, "Local network IP"),
  );
});

export { app };
