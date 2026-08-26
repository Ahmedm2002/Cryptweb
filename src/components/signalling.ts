import { app } from "../app.js";
import { Server, Socket } from "socket.io";
import logger from "../utils/logger/logger.js";
import { createServer } from "node:http";
import CONSTANTS from "../constants.js";
import type {
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  WebRTCUsersConnectedPayload,
  CallRequestPayload,
  CallResponsePayload,
  CallEndedPayload,
} from "../interfaces/webrtc.connections.models.js";
import Users from "../repositories/user.repo.js";
import Friendship from "../repositories/friendship.repo.js";
import Conversation from "../repositories/conversation.repo.js";
import Message from "../repositories/message.repo.js";
import Notification from "../repositories/notification.repo.js";
import {
  emailToSocketMap,
  idToSocketMap,
  activePeers,
  inCallUsers,
  ipToUsersMap,
  normalizeIP,
} from "../utils/networkStore.js";
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

io.on("connection", (socket: Socket) => {
  const clientIP = getClientIP(socket);
  logger.info({ socketId: socket.id, ip: clientIP }, "Authenticated client connected");

  socket.on("user:register", async ({ email, name }) => {
    if (!name || !email) {
      logger.warn({ socketId: socket.id }, "Invalid registration data");
      socket.emit("registration-error", {
        isOnline: null,
        name: email,
        userExists: null,
        message: "Conneting with friends is unable. Please try again.",
      });
      return;
    }
    try {
      const user = await Users.getByEmail(email);
      if (!user) {
        logger.warn(
          { email, socketId: socket.id },
          "Registration failed: User not found in DB",
        );
        socket.emit("registration-error", {
          isOnline: false,
          name: email,
          userExists: false,
          message: `${email} not registered with cryptweb`,
        });
        return;
      }
      if (emailToSocketMap.has(email)) {
        emailToSocketMap.delete(email);
        emailToSocketMap.set(email, { socketId: socket.id, name });
      } else {
        emailToSocketMap.set(email, { socketId: socket.id, name });
      }

      if (idToSocketMap.has(user.id)) {
        idToSocketMap.delete(user.id);
      }
      idToSocketMap.set(user.id, { socketId: socket.id, name });

      const room = `network:${clientIP}`;
      socket.join(room);
      if (!ipToUsersMap.has(clientIP)) {
        ipToUsersMap.set(clientIP, new Set());
      }
      ipToUsersMap.get(clientIP)!.add(email);

      io.to(room).emit("network:user-joined", {
        email,
        name,
        onlineUsers: Array.from(ipToUsersMap.get(clientIP)!).map(
          (e) => ({ email: e, name: emailToSocketMap.get(e)?.name || e }),
        ),
      });

      logger.info(
        { socketId: socket.id, email, ip: clientIP },
        "User registered for signaling",
      );
    } catch (err) {
      logger.error({ err, email }, "Database error during registration");
      socket.emit("registration-error", {
        isOnline: true,
        name: email,
        userExists: null,
        message: CONSTANTS.SERVER_ERROR,
      });
    }
  });

  socket.on("network:users", () => {
    const users = ipToUsersMap.get(clientIP);
    if (!users) {
      socket.emit("network:users", []);
      return;
    }
    const onlineUsers = Array.from(users).map((email) => ({
      email,
      name: emailToSocketMap.get(email)?.name || email,
    }));
    socket.emit("network:users", onlineUsers);
  });

  socket.on(
    "connection:request",
    async (data: { from: string; to: string }) => {
      logger.info(
        { from: data.from, to: data.to },
        "Received connection request",
      );
      if (!data.to) return;

      try {
        const user = await Users.getByEmail(data.to);
        if (!user) {
          logger.warn(
            { to: data.to },
            "Connection request failed: User not found",
          );
          socket.emit("status-update", {
            isOnline: false,
            userExists: false,
            name: data.to,
            message: `${data.to} is not registered with Cryptweb`,
          });
          return;
        }

        const targetUser = emailToSocketMap.get(data.to);
        const sender = emailToSocketMap.get(data.from);

        if (targetUser) {
          logger.info(
            { to: data.to },
            "Target user online, sending connection request",
          );
          socket.emit("status-update", {
            isOnline: true,
            userExists: true,
            name: targetUser.name,
            message: "User is online",
          });

          socket.to(targetUser.socketId).emit("connection:incoming", {
            from: data.from,
            fromName: sender?.name || data.from,
          });
        } else {
          logger.info({ to: data.to }, "Target user offline");

          const senderUser = await Users.getByEmail(data.from);
          if (senderUser) {
            const notif = await Notification.create(
              user.id,
              "connection_attempt",
              senderUser.id,
            );
            if (notif) {
              const targetSocket = idToSocketMap.get(user.id);
              if (targetSocket) {
                io.to(targetSocket.socketId).emit("notification:new", notif);
              }
            }
          }

          socket.emit("status-update", {
            isOnline: false,
            userExists: true,
            name: user.name || data.to,
            message: "User is offline",
          });
        }
      } catch (err) {
        logger.error(
          { err, to: data.to },
          "Database error during connection request",
        );
        socket.emit("registration-error", {
          isOnline: null,
          name: data.to,
          userExists: null,
          message: "Unable to process connection request. Please try again.",
        });
      }
    },
  );

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

      socket.to(initiator.socketId).emit("connection:response", {
        from: data.from,
        name: responder?.name || data.from,
        accepted: data.accepted,
      });

      // if (data.accepted) {
      //   activePeers.set(data.from, data.to);
      //   activePeers.set(data.to, data.from);
      // }
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

  // *------------------------------------ Call Signalling Events ---------------------------------------*
  socket.on("call:request", (data: CallRequestPayload) => {
    logger.info(
      { from: data.from, to: data.to, type: data.type },
      "Received call request",
    );
    if (!data.from || !data.to || !data.type) return;

    const target = emailToSocketMap.get(data.to);
    const sender = emailToSocketMap.get(data.from);

    if (!target || inCallUsers.has(data.to)) {
      socket.emit("call:response", { accepted: false });
      return;
    }

    inCallUsers.set(data.from, data.to);
    inCallUsers.set(data.to, data.from);

    io.to(target.socketId).emit("call:incoming", {
      from: data.from,
      name: sender?.name || data.from,
      type: data.type,
    });
  });

  socket.on("call:response", (data: CallResponsePayload) => {
    logger.info(
      { from: data.from, to: data.to, accepted: data.accepted },
      "Received call response",
    );
    const caller = emailToSocketMap.get(data.to);
    if (!caller) return;

    if (!data.accepted) {
      inCallUsers.delete(data.from);
      inCallUsers.delete(data.to);
    }

    io.to(caller.socketId).emit("call:response", { accepted: data.accepted });
  });

  socket.on("call:ended", (data: CallEndedPayload) => {
    logger.info({ from: data.from, to: data.to }, "Received call ended");
    const peer = emailToSocketMap.get(data.to);

    inCallUsers.delete(data.from);
    inCallUsers.delete(data.to);

    if (!peer) return;
    io.to(peer.socketId).emit("call:ended", {});
  });

  socket.on("disconnect", () => {
    const email = getEmailBySocketId(socket.id);
    if (email) {
      const peerEmail = activePeers.get(email);
      if (peerEmail) {
        const peerInfo = emailToSocketMap.get(peerEmail);
        const disconnectedUser = emailToSocketMap.get(email);
        const name = disconnectedUser?.name || email;
        if (peerInfo) {
          io.to(peerInfo.socketId).emit("peer:disconnected", {
            name,
            email,
            message: `${name} went offline. Try again later`,
          });
        }
        activePeers.delete(email);
        activePeers.delete(peerEmail);
      }

      const callPeerEmail = inCallUsers.get(email);
      if (callPeerEmail) {
        const callPeerInfo = emailToSocketMap.get(callPeerEmail);
        if (callPeerInfo) {
          io.to(callPeerInfo.socketId).emit("call:ended", {});
        }
        inCallUsers.delete(email);
        inCallUsers.delete(callPeerEmail);
      }

      const usersOnIP = ipToUsersMap.get(clientIP);
      if (usersOnIP) {
        usersOnIP.delete(email);
        if (usersOnIP.size === 0) {
          ipToUsersMap.delete(clientIP);
        } else {
          io.to(`network:${clientIP}`).emit("network:user-left", {
            email,
            onlineUsers: Array.from(usersOnIP).map(
              (e) => ({ email: e, name: emailToSocketMap.get(e)?.name || e }),
            ),
          });
        }
      }
    }
    removeEmailFromMap(socket.id);
    removeIdFromMap(socket.id);
    logger.info({ socketId: socket.id, ip: clientIP }, "Client disconnected");
  });

  // *------------------------------------ Chat Messaging ---------------------------------------*
  socket.on(
    "message:send",
    async (data: { conversationId: string; to: string; content: string }) => {
      const senderEmail = getEmailBySocketId(socket.id);
      if (!senderEmail) return;

      const senderUser = await Users.getByEmail(senderEmail);
      if (!senderUser) return;

      const { conversationId, to, content } = data;
      if (!conversationId || !to || !content) return;

      try {
        const isFriend = await Friendship.exists(senderUser.id, to);
        if (!isFriend) {
          logger.warn(
            { senderId: senderUser.id, to },
            "Message rejected: not friends",
          );
          return;
        }

        const conversation = await Conversation.getById(conversationId);
        if (!conversation) return;
        if (
          conversation.user_one_id !== senderUser.id &&
          conversation.user_two_id !== senderUser.id
        ) {
          return;
        }

        const senderPref = await Conversation.getPreference(
          conversationId,
          senderUser.id,
        );
        const receiverPref = await Conversation.getPreference(
          conversationId,
          to,
        );

        const senderDefault = await Users.getSaveMessagesDefault(senderUser.id);
        const receiverDefault = await Users.getSaveMessagesDefault(to);

        const saveForSender = senderPref
          ? senderPref.save_messages
          : senderDefault;
        const saveForReceiver = receiverPref
          ? receiverPref.save_messages
          : receiverDefault;

        let messageId: string | null = null;
        if (saveForSender || saveForReceiver) {
          const msg = await Message.create(
            conversationId,
            senderUser.id,
            content,
            saveForSender,
            saveForReceiver,
          );
          if (msg) messageId = msg.id;
        }

        const receiverSocket = idToSocketMap.get(to);
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit("message:receive", {
            conversationId,
            from: senderUser.id,
            content,
            createdAt: new Date(),
          });
          socket.emit("message:send-ack", {
            delivered: true,
            messageId,
          });
        } else {
          socket.emit("message:send-ack", {
            delivered: false,
            messageId,
          });
        }
      } catch (err) {
        logger.error(
          { err, senderId: senderUser.id, to },
          "Error processing message:send",
        );
        socket.emit("message:send-ack", {
          delivered: false,
          messageId: null,
        });
      }
    },
  );

  // *------------------------------------ WebRTC Signalling Events ---------------------------------------*
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
    logger.info({ from: data.from, to: data.to }, "Forwarding WebRTC Answer");
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
    logger.info(
      { from: data.from, to: data.to },
      "Forwarding WebRTC ICE Candidate",
    );
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
});

export { httpServer, io };

// **************************************** Helper Functions ********************************************
function removeEmailFromMap(id: string) {
  if (!id) return;
  const entry = getEmailBySocketId(id);
  if (!entry) return;
  emailToSocketMap.delete(entry);
}

function removeIdFromMap(socketId: string) {
  if (!socketId) return;
  for (const [userId, entry] of idToSocketMap.entries()) {
    if (entry.socketId === socketId) {
      idToSocketMap.delete(userId);
      break;
    }
  }
}

function getEmailBySocketId(id: string): string | null {
  const sockets = Array.from(emailToSocketMap.entries());
  const entry = sockets.find(([_, value]) => value.socketId === id);
  return entry ? entry[0] : null;
}

function getClientIP(socket: Socket): string {
  const fwd = socket.handshake.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) {
    return normalizeIP(fwd.split(",")[0]!.trim());
  }
  if (Array.isArray(fwd) && fwd[0]) {
    return normalizeIP(fwd[0].split(",")[0]!.trim());
  }
  return normalizeIP(socket.handshake.address);
}


