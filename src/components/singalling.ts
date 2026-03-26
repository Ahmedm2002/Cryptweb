import { app } from "../app.js";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger/logger.js";
import { createServer } from "node:http";

const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e6,
});

// ─── State Maps ──────────────────────────────────────────────────────────────

/** email → { socketId, name } */
const emailToSocket = new Map<string, { socketId: string; name: string }>();

/** email → peerEmail  (tracks active P2P pairs) */
const activePeers = new Map<string, string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function peerSocketOf(email: string): string | null {
  const entry = emailToSocket.get(email);
  return entry ? entry.socketId : null;
}

// ─── Socket Handlers ─────────────────────────────────────────────────────────

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "socket:connected");

  // ── Registration ─────────────────────────────────────────────────────────

  socket.on("save-user", (data: { email: string; name: string }) => {
    socket.data.email = data.email;
    socket.data.name = data.name;

    // Update map entry regardless (socket id may have changed on reconnect)
    emailToSocket.set(data.email, { socketId: socket.id, name: data.name });
    logger.info({ email: data.email, socketId: socket.id }, "user:registered");
    console.log("Current users:", Array.from(emailToSocket.keys()));
    socket.emit("user-saved", { message: `Hi Mr. ${data.name}` });
  });

  // ── Standard WebRTC Signalling ───────────────────────────────────────────

  socket.on("offer", (data: { from: string; to: string; offer: unknown }) => {
    const friendSid = peerSocketOf(data.to);
    if (!friendSid) {
      socket.emit("friend-status", {
        isOnline: false,
        message: `${data.to} is offline.`,
      });
      logger.warn({ from: data.from, to: data.to }, "offer:peer-offline");
      return;
    }
    // Track the peer pairing
    activePeers.set(data.from, data.to);
    activePeers.set(data.to, data.from);
    logger.info(`Active peers: ${activePeers.entries()}`);
    logger.info({ from: data.from, to: data.to }, "offer:forwarded");
    socket.to(friendSid).emit("offer", data);
  });

  socket.on("answer", (data: { from: string; to: string; answer: unknown }) => {
    const friendSid = peerSocketOf(data.to);
    if (!friendSid) return;
    logger.info({ from: data.from, to: data.to }, "answer:forwarded");
    socket.to(friendSid).emit("answer", data);
  });

  socket.on(
    "ice-candidates",
    (data: { from: string; to: string; candidate: unknown }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) return;
      logger.debug({ from: data.from, to: data.to }, "ice-candidate:forwarded");
      socket.to(friendSid).emit("set-iceCandidates", data);
    },
  );

  // ── Reconnection ─────────────────────────────────────────────────────────

  socket.on(
    "reconnect-request",
    (data: { from: string; to: string; offer: unknown }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) {
        socket.emit("friend-status", {
          isOnline: false,
          message: `${data.to} is offline. Cannot reconnect.`,
        });
        logger.warn({ from: data.from, to: data.to }, "reconnect:peer-offline");
        return;
      }
      logger.info({ from: data.from, to: data.to }, "reconnect:offer-sent");
      socket.to(friendSid).emit("reconnect-offer", data);
    },
  );

  socket.on(
    "reconnect-answer",
    (data: { from: string; to: string; answer: unknown }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) return;
      logger.info({ from: data.from, to: data.to }, "reconnect:answer-sent");
      socket.to(friendSid).emit("reconnect-answer", data);
    },
  );

  // ── Server Relay (P2P Fallback) ──────────────────────────────────────────

  socket.on(
    "relay-chunk",
    (data: {
      from: string;
      to: string;
      fileId: string;
      fileName: string;
      fileSize: number;
      totalChunks: number;
      current: number;
      remaining: number;
      data: string; // base64
    }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) {
        socket.emit("relay-error", {
          fileId: data.fileId,
          current: data.current,
          message: "Receiver is offline",
        });
        logger.error(
          { fileId: data.fileId, current: data.current, to: data.to },
          "relay-chunk:receiver-offline",
        );
        return;
      }

      logger.info(
        {
          fileId: data.fileId,
          chunk: `${data.current + 1}/${data.totalChunks}`,
          remaining: data.remaining,
          from: data.from,
          to: data.to,
        },
        "relay-chunk:forwarded",
      );

      socket.to(friendSid).emit("relay-chunk", data);
    },
  );

  socket.on(
    "relay-chunk-ack",
    (data: { from: string; to: string; fileId: string; current: number }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) return;
      logger.debug(
        { fileId: data.fileId, chunk: data.current },
        "relay-chunk-ack:forwarded",
      );
      socket.to(friendSid).emit("relay-chunk-ack", data);
    },
  );

  socket.on(
    "relay-request-retry",
    (data: {
      from: string;
      to: string;
      fileId: string;
      failedIndices: number[];
    }) => {
      const friendSid = peerSocketOf(data.to);
      if (!friendSid) return;
      logger.warn(
        {
          fileId: data.fileId,
          failedCount: data.failedIndices.length,
          failedIndices: data.failedIndices,
        },
        "relay-request-retry:forwarded",
      );
      socket.to(friendSid).emit("relay-request-retry", data);
    },
  );

  socket.on(
    "relay-transfer-complete",
    (data: { from: string; to: string; fileId: string; fileName: string }) => {
      const friendSid = peerSocketOf(data.to);
      if (friendSid) {
        socket.to(friendSid).emit("relay-transfer-complete", data);
      }
      logger.info(
        { fileId: data.fileId, fileName: data.fileName, from: data.from },
        "relay-transfer:complete",
      );
    },
  );

  // ── Disconnect ───────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    const userMail = socket.data.email as string | undefined;

    if (userMail) {
      // Notify peer about disconnection
      const peerEmail = activePeers.get(userMail);
      if (peerEmail) {
        const peerSid = peerSocketOf(peerEmail);
        if (peerSid) {
          io.to(peerSid).emit("peer-disconnected", {
            email: userMail,
            message: `${userMail} disconnected.`,
          });
          logger.info(
            { user: userMail, peer: peerEmail },
            "disconnect:peer-notified",
          );
        }
        activePeers.delete(peerEmail);
        activePeers.delete(userMail);
      }

      emailToSocket.delete(userMail);
      logger.info({ email: userMail, socketId: socket.id }, "user:removed");
    }

    logger.info({ socketId: socket.id }, "socket:disconnected");
  });
});

export default server;
