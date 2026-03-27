import { app } from "../app.js";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger/logger.js";
import { createServer } from "node:http";

const server = createServer(app);
const io = new Server(server, {
  serveClient: false,
});

const emailToSocketMap: Map<string, { socketId: string; name: string }> =
  new Map();

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "New client connected");

  socket.on("user:register", (email: string, name: string) => {
    if (!name || !email) {
      logger.warn({ socketId: socket.id }, "Invalid registration data");
      return;
    }
    emailToSocketMap.set(email, { socketId: socket.id, name });
    logger.info(
      { socketId: socket.id, email },
      "User registered for signaling",
    );
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Client disconnected");
  });
});
export default server;
