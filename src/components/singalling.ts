import { app } from "../app.js";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger/logger.js";
import { createServer } from "node:http";
import type {
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  WebRTCUsersConnectedPayload,
} from "../interfaces/webrtc.connections.models.js";
import Users from "../repositories/user.repo.js";
import dotenv from "dotenv";
dotenv.config();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

const emailToSocketMap: Map<string, { socketId: string; name: string }> =
  new Map();

const activePeers: Map<string, string> = new Map();

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "Authenticated client connected");

  socket.on("register", async ({ email, name }) => {
    if (!name || !email) {
      logger.warn({ socketId: socket.id }, "Invalid registration data");
      return;
    }
    try {
      const user = await Users.getByEmail(email);
      if (!user) {
        logger.warn(
          { email, socketId: socket.id },
          "Registration failed: User not found in DB",
        );
        socket.emit("registration-error", { message: "User does not exist" });
        return;
      }
      emailToSocketMap.set(email, { socketId: socket.id, name });
      logger.info(
        { socketId: socket.id, email },
        "User registered for signaling",
      );
    } catch (err) {
      logger.error({ err, email }, "Database error during registration");
      socket.emit("registration-error", { message: "Internal server error" });
    }
  });

  socket.on("check-status", async (data: { email: string }) => {
    logger.info(
      { socketId: socket.id, targetEmail: data.email },
      "Received check-status request",
    );
    if (!data.email) return;
    const user = await Users.getByEmail(data.email);
    if (!user) {
      logger.warn(
        { socketId: socket.id, targetEmail: data.email },
        "Target user not found in DB",
      );
      socket.emit("status-update", {
        isOnline: false,
        name: data.email,
        userExists: false,
        message: "User not found in DB",
      });
      return;
    }
    const targetUser = emailToSocketMap.get(data.email);
    if (targetUser) {
      logger.info(
        { socketId: socket.id, targetEmail: data.email },
        "Target user is online, emitting status-update true",
      );
      socket.emit("status-update", {
        isOnline: true,
        userExists: true,
        name: targetUser.name,
        message: "User is online",
      });
    } else {
      logger.info(
        { socketId: socket.id, targetEmail: data.email },
        "Target user is offline, emitting status-update false",
      );
      socket.emit("status-update", {
        isOnline: false,
        userExists: true,
        message: "User is offline",
      });
    }
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

  socket.on("connection:request", (data: { from: string; to: string }) => {
    logger.info(
      { from: data.from, to: data.to },
      "Received connection request",
    );
    const targetUser = emailToSocketMap.get(data.to);
    const sender = emailToSocketMap.get(data.from);
    if (!targetUser) {
      socket.emit("status-update", {
        isOnline: false,
        message: "User offline",
      });
      return;
    }
    socket.to(targetUser.socketId).emit("connection:incoming", {
      from: data.from,
      fromName: sender?.name || data.from,
    });
  });

  socket.on(
    "connection:response",
    (data: { from: string; to: string; accepted: boolean }) => {
      logger.info(
        { from: data.from, to: data.to, accepted: data.accepted },
        "Received connection response",
      );
      const initiator = emailToSocketMap.get(data.to);
      const responder = emailToSocketMap.get(data.from);
      if (!initiator) return;

      socket.to(initiator.socketId).emit("connection:result", {
        from: data.from,
        name: responder?.name || data.from,
        accepted: data.accepted,
      });

      if (data.accepted) {
        activePeers.set(data.from, data.to);
        activePeers.set(data.to, data.from);
      }
    },
  );

  socket.on("users:connected", (data: WebRTCUsersConnectedPayload) => {
    activePeers.set(data.initiator, data.receiver);
    activePeers.set(data.receiver, data.initiator);
    logger.info(
      { initiator: data.initiator, receiver: data.receiver },
      "Users connected and added to active peers",
    );
  });

  socket.on("disconnect", () => {
    const email = getEmailBySocketId(socket.id);
    if (!email) return;
    const peerEmail = activePeers.get(email);
    if (!peerEmail) return;
    const peer = emailToSocketMap.get(peerEmail);
    if (peer) {
      const user = emailToSocketMap.get(email);
      const name = user ? user.name : "User";
      socket.to(peer.socketId).emit("user-status", {
        isOnline: false,
        message: `${name} went offline`,
      });
    }
    activePeers.delete(email);
    activePeers.delete(peerEmail);
    removeEmailFromMap(socket.id);
    logger.info({ socketId: socket.id }, "Client disconnected");
  });
});

export default httpServer;

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
