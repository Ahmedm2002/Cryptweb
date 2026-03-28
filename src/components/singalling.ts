import { app } from "../app.js";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger/logger.js";
import { createServer } from "node:http";
import type {
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
} from "../interfaces/webrtc.connections.models.js";

const server = createServer(app);
const io = new Server(server);

const emailToSocketMap: Map<string, { socketId: string; name: string }> =
  new Map();

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "New client connected");

  socket.on("register", ({ email, name }) => {
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

  socket.on("offer", (data: WebRTCOfferPayload) => {
    const targetUser = emailToSocketMap.get(data.to);
    if (!targetUser) {
      socket.emit("user-status", { isOnline: false, message: "user offline" });
      return;
    }
    socket.to(targetUser.socketId).emit("offer", {
      offer: data.offer,
      from: data.from,
    });
  });

  socket.on("answer", (data: WebRTCAnswerPayload) => {
    const targetUser = emailToSocketMap.get(data.to);
    if (!targetUser) {
      socket.emit("user-status", { isOnline: false, message: "user offline" });
      return;
    }
    socket.to(targetUser.socketId).emit("answer", {
      answer: data.answer,
      from: data.from,
    });
  });

  socket.on("ice-candidate", (data: WebRTCIceCandidatePayload) => {
    const targetUser = emailToSocketMap.get(data.to);
    if (!targetUser) {
      socket.emit("user-status", { isOnline: false, message: "user offline" });
      return;
    }
    socket.to(targetUser.socketId).emit("ice-candidate", {
      candidate: data.candidate,
      from: data.from,
    });
  });

  socket.on("disconnect", () => {
    removeEmailFromMap(socket.id);
    logger.info({ socketId: socket.id }, "Client disconnected");
  });
});

export default server;

function removeEmailFromMap(id: string) {
  if (!id) return;
  const entry = getEmailBySocketId(id);
  if (!entry) return;
  emailToSocketMap.delete(entry);
}

function getEmailBySocketId(id: string): string | null {
  const sockets = Array.from(emailToSocketMap.entries());
  const entry = sockets.find(([_, value]) => value.socketId === id);
  return entry ? entry[0] : null;
}
