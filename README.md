# CryptWeb Backend

## 1. System Overview

CryptWeb is a Node.js/Express backend service providing:

- **Authentication** (signup, login with JWT + cookie-based sessions)
- **Email Verification** (OTP code verification flow)
- **Password Management** (forgot + reset password with email token)
- **Session Management** (multi-device sessions, logout, token refresh)
- **File Transfer Logging** (persists completed P2P file transfer metadata)
- **File Transfer History** (retrieve recent transfers for the authenticated user)
- **WebRTC Signaling** (Socket.IO-based offer/answer/ICE exchange with active peer tracking)
- **Network Discovery** (Socket.IO rooms grouped by client IP + REST endpoint for LAN IP and online users)
- **Health Check** (application + database status)

**Base URL:** All REST routes are prefixed with `/api`.
**Source:** `src/app.ts` — `app.use('/api', v1Router)`

---

## 2. Response Formats

All responses use one of two standardized classes.

### `ApiResponse` (Success)

**Source:** `src/utils/responses/ApiResponse.ts`

```json
{
  "statusCode": 200,
  "data": {},
  "message": "Success message",
  "success": true
}
```

| Field        | Type      | Description                                 |
| ------------ | --------- | ------------------------------------------- |
| `statusCode` | `number`  | HTTP status code                            |
| `data`       | `T`       | Response payload (type varies per endpoint) |
| `message`    | `string`  | Human-readable summary                      |
| `success`    | `boolean` | `true` when `statusCode < 400`              |

### `ApiError` (Error)

**Source:** `src/utils/responses/ApiError.ts`

```json
{
  "statusCode": 400,
  "data": null,
  "message": "Error description",
  "success": false,
  "errors": ["Optional array of validation details"]
}
```

| Field        | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `statusCode` | `number`  | HTTP status code                   |
| `data`       | `null`    | Always `null` on errors            |
| `message`    | `string`  | Error description                  |
| `success`    | `boolean` | Always `false`                     |
| `errors`     | `any[]`   | Optional. Validation error details |

---

## 3. Authentication Mechanism

**Source:** `src/middlewares/auth.middleware.ts`

Routes marked as ** Authenticated** require the following header:

```
Authorization: Bearer <accessToken>
```

**Middleware behavior:**

| Scenario                    | Status | Message                                                   |
| --------------------------- | ------ | --------------------------------------------------------- |
| No `Authorization` header   | `400`  | `Auth headers missing`                                    |
| Header present, no token    | `401`  | `Access token required`                                   |
| Token expired / invalid JWT | `401`  | `Token expired`                                           |
| Unexpected error            | `500`  | `Something went wrong at our end. Please Try again later` |

The middleware extracts `sub` from the JWT payload and attaches it as `req.user.id`.

---

## 4. Rate Limiting

**Source:** `src/middlewares/rateLimitter.middleware.ts`

| Limiter          | Window     | Max Requests | Applied To                                     |
| ---------------- | ---------- | ------------ | ---------------------------------------------- |
| `authLimiter`    | 15 minutes | 5            | `POST /api/v1/auth/login`                      |
| `signupLimiter`  | 10 hours   | 20           | `POST /api/v1/auth/signup`                     |
| `healthLimiter`  | 15 minutes | 5            | `GET /api/v1/health`                           |
| `generalLimiter` | 1 minute   | 100          | Not found applied to any route in current code |

When exceeded, the response body is a plain string message (e.g., `"Too many login attempts, please try again later"`).

---

## 5. REST API Endpoints

### 5.1 Root

#### `GET /api/`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/app.ts`

**Response (200):**

```json
{
  "statusCode": 200,
  "data": { "version": "<API_VERSION from env>" },
  "message": "Welcome to auth service backend",
  "success": true
}
```

---

### 5.2 Authentication

#### `POST /api/v1/auth/signup`

**Auth:** None  
**Rate Limit:** `signupLimiter` (20 req / 10 hours)  
**Source:** `src/controllers/auth.controller.ts` → `src/services/auth.service.ts`

**Request Body:**

```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

Validated using `signupSchema` (Zod). Fields: `userName` (mapped from `name`), `email`, `password`.

**Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "profile_picture": "string | undefined",
      "created_on": "Date | undefined"
    }
  },
  "message": "User created successfully",
  "success": true
}
```

A verification code email is automatically sent after signup.

**Errors:**

| Status | Message                   | Condition                                             |
| ------ | ------------------------- | ----------------------------------------------------- |
| `400`  | `Missing input fields`    | Any of name/email/password missing                    |
| `400`  | `Invalid inputs fields`   | Zod validation failed (errors array contains details) |
| `409`  | `Email already exists`    | Email already registered                              |
| `500`  | `Something went wrong...` | Unexpected server error                               |

---

#### `POST /api/v1/auth/login`

**Auth:** None  
**Rate Limit:** `authLimiter` (5 req / 15 min)  
**Source:** `src/controllers/auth.controller.ts` → `src/services/auth.service.ts`

**Request Body:**

```json
{
  "email": "string",
  "password": "string"
}
```

Validated using `loginSchema` (Zod).

**Response (200):**

Sets three `httpOnly`, `secure` cookies: `accessToken`, `refreshToken`, `deviceId`.

```json
{
  "statusCode": 200,
  "data": {
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "profile_picture": "string | undefined",
      "created_on": "Date | undefined"
    },
    "accessToken": "jwt string",
    "refreshToken": "jwt string",
    "deviceId": "hex string (20 chars)",
    "sessionId": "uuid"
  },
  "message": "logged in successfully",
  "success": true
}
```

**Errors:**

| Status | Message                                               | Condition               |
| ------ | ----------------------------------------------------- | ----------------------- |
| `400`  | `Email and Password required`                         | Missing fields          |
| `400`  | `Invalid fields`                                      | Zod validation failed   |
| `404`  | `User not found`                                      | Email not in database   |
| `400`  | `Invalid credentials`                                 | Password mismatch       |
| `500`  | `There was unexpected error creating your session...` | Session creation failed |
| `500`  | `Something went wrong...`                             | Unexpected server error |

---

### 5.3 Email Verification

#### `POST /api/v1/verify/email`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/controllers/verfiyUser.controller.ts` → `src/services/verify-email.service.ts`

**Request Body:**

```json
{
  "email": "string",
  "code": "string (6 characters)"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "data": null,
  "message": "User verified successfully",
  "success": true
}
```

**Errors:**

| Status | Message                                                   | Condition                                                  |
| ------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| `400`  | `Please enter 4 verification code`                        | Missing code, email, or code length ≠ 6                    |
| `400`  | `Invalid email address`                                   | Email format validation failed                             |
| `404`  | `User not found`                                          | Email not in database                                      |
| `404`  | `No code found. Please signup or send click resend token` | No verification token exists                               |
| `200`  | `Email already verified`                                  | `token.used_at` is set (not an error, returns ApiResponse) |
| `400`  | `Token Expired`                                           | Code older than 5 minutes (`OTP_EXPIRY_MS: 300000`)        |
| `400`  | `Invalid code`                                            | bcrypt compare fails                                       |
| `500`  | `Something went wrong...`                                 | Unexpected error                                           |

---

#### `POST /api/v1/verify/resend-code`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/controllers/verfiyUser.controller.ts` → `src/services/verify-email.service.ts`

**Request Body:**

```json
{
  "email": "string"
}
```

**Response (201):**

```json
{
  "statusCode": 201,
  "data": null,
  "message": "Code send to email",
  "success": true
}
```

**Errors:**

| Status | Message                   | Condition                                                  |
| ------ | ------------------------- | ---------------------------------------------------------- |
| `400`  | `Email Required`          | Empty email                                                |
| `400`  | `Invalid email address`   | Format check failed                                        |
| `404`  | `User not found`          | Email not in database                                      |
| `200`  | `User already verified`   | `user.verified_at` is set (returns ApiResponse, not error) |
| `500`  | `Something went wrong...` | Unexpected error                                           |

---

### 5.4 Password Management

#### `POST /api/v1/password/forgot`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/controllers/resetPassword.controller.ts` → `src/services/reset-password.service.ts`

**Request Body:**

```json
{
  "email": "string"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "data": null,
  "message": "If the email exists, a reset link has been sent.",
  "success": true
}
```

A reset token is emailed asynchronously via `process.nextTick`.

**Errors:**

| Status | Message                                 | Condition             |
| ------ | --------------------------------------- | --------------------- |
| `400`  | `Invalid email address`                 | Format validation     |
| `404`  | `User not found`                        | Email not in database |
| `500`  | `Error generating reset password token` | Token storage failed  |
| `500`  | `Something went wrong...`               | Unexpected error      |

---

#### `POST /api/v1/password/reset`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/controllers/resetPassword.controller.ts` → `src/services/reset-password.service.ts`

**Request Body:**

```json
{
  "email": "string",
  "password": "string",
  "confirmPassword": "string",
  "token": "string (received via email)"
}
```

On success, **all existing sessions for the user are invalidated** (forced re-login).

**Response (200):**

```json
{
  "statusCode": 200,
  "data": null,
  "message": "Password reset successfull, Please Login again",
  "success": true
}
```

**Errors:**

| Status | Message                                            | Condition                                      |
| ------ | -------------------------------------------------- | ---------------------------------------------- |
| `400`  | `Email and password required`                      | Missing fields                                 |
| `400`  | `Invalid email address`                            | Format validation                              |
| `400`  | `Password does not match`                          | `password ≠ confirmPassword`                   |
| `400`  | `Invalid Password`                                 | Zod `passwordSchema` failed                    |
| `200`  | `If the email exists, a reset link has been sent.` | Email not found (ambiguous response by design) |
| `404`  | `No active reset token found`                      | No token in database                           |
| `400`  | `Token already used`                               | `resetToken.used_at` is set                    |
| `400`  | `Reset Token Expired`                              | Token past `expires_at`                        |
| `400`  | `Invalid Token`                                    | Token hash comparison fails                    |
| `500`  | `Something went wrong...`                          | Unexpected error                               |

---

### 5.5 Session Management

#### `GET /api/v1/session/all`

**Auth:** Authenticated  
**Rate Limit:** None  
**Source:** `src/controllers/userSessions.controller.ts` → `src/services/user-session.service.ts`

**Query Parameters:**

| Param    | Type            | Required |
| -------- | --------------- | -------- |
| `userId` | `string (UUID)` | Yes      |

**Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "device_id": "string",
      "device_type": {
        "browser": "string",
        "os": "string",
        "device": "string",
        "vendor": "string",
        "model": "string"
      },
      "refresh_token": "string",
      "expires_at": "ISO date",
      "created_at": "ISO date"
    }
  ],
  "message": "sessions fetched successfully",
  "success": true
}
```

**Errors:**

| Status | Message                   | Condition         |
| ------ | ------------------------- | ----------------- |
| `400`  | `User id required`        | Missing userId    |
| `400`  | `Invalid user id`         | Not a valid UUID  |
| `404`  | `No user session found`   | No sessions exist |
| `500`  | `Something went wrong...` | Unexpected error  |

---

#### `DELETE /api/v1/session/log-out`

**Auth:** Authenticated  
**Rate Limit:** None  
**Source:** `src/controllers/userSessions.controller.ts` → `src/services/user-session.service.ts`

**Request Body:**

```json
{
  "sessionId": "uuid",
  "deviceId": "string"
}
```

On success, clears cookies: `accessToken`, `refreshToken`, `deviceId`.

**Response (200):**

```json
{
  "statusCode": 200,
  "data": "deleted session uuid",
  "message": "Session deleted successfully",
  "success": true
}
```

**Errors:**

| Status | Message                   | Condition                     |
| ------ | ------------------------- | ----------------------------- |
| `400`  | `Required fields missing` | Missing sessionId or deviceId |
| `400`  | `Invalid user id`         | sessionId not valid UUID      |
| `400`  | `No session found`        | Session doesn't exist         |
| `500`  | `Something went wrong...` | Unexpected error              |

---

#### `POST /api/v1/session/log-out/all-sessions`

**Auth:** Authenticated  
**Rate Limit:** None  
**Source:** `src/controllers/userSessions.controller.ts` → `src/services/user-session.service.ts`

**Request Body:** None. User ID is extracted from `req.user.id` (set by auth middleware).

**Response (200):**

```json
{
  "statusCode": 200,
  "data": ["array of deleted session ids"],
  "message": "Log out from all devices sucessfull",
  "success": true
}
```

**Errors:**

| Status | Message                         | Condition              |
| ------ | ------------------------------- | ---------------------- |
| `400`  | `Invalid user id`               | UUID validation failed |
| `404`  | `No active user sessions found` | No sessions to delete  |
| `500`  | `Something went wrong...`       | Unexpected error       |

---

#### `POST /api/v1/session/renew`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/controllers/userSessions.controller.ts` → `src/services/tokens.service.ts`

**Request Body:**

```json
{
  "refreshToken": "string",
  "userId": "uuid",
  "deviceId": "string",
  "sessionId": "uuid"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "new jwt string"
  },
  "message": "Access token generated successfully",
  "success": true
}
```

**Errors:**

| Status | Message                                  | Condition                   |
| ------ | ---------------------------------------- | --------------------------- |
| `400`  | `Bad Request, Required fields are empty` | Missing any field           |
| `400`  | `Invalid user id`                        | UUID validation failed      |
| `404`  | `User not found`                         | userId not in database      |
| `404`  | `No session found`                       | Session doesn't exist       |
| `400`  | `Refresh token expired`                  | Session `expires_at` passed |
| `400`  | `Invalid refresh Token`                  | bcrypt compare fails        |
| `500`  | `Something went wrong...`                | Unexpected error            |

---

### 5.6 File Transfers

#### `POST /api/v1/file-transfers/complete`

**Auth:** Authenticated  
**Rate Limit:** None  
**Source:** `src/controllers/fileTransfers.controller.ts` → `src/services/fileTransfers.service.ts` → `src/repositories/file_transfers.repo.ts`

**Request Body:**

```json
{
  "senderEmail": "string",
  "receiverEmail": "string",
  "fileName": "string",
  "fileSize": 1048576,
  "fileType": "application/pdf",
  "timeElapsed": 4500,
  "transferType": "WebRTC"
}
```

| Field           | Type     | Description                                   |
| --------------- | -------- | --------------------------------------------- |
| `senderEmail`   | `string` | Email of file sender                          |
| `receiverEmail` | `string` | Email of file receiver                        |
| `fileName`      | `string` | Name of the transferred file                  |
| `fileSize`      | `number` | File size in bytes (converted to MB on save)  |
| `fileType`      | `string` | MIME type                                     |
| `timeElapsed`   | `number` | Transfer duration in milliseconds             |
| `transferType`  | `string` | Transfer method (e.g., `"WebRTC"`, `"Relay"`) |

**Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "sender": "uuid",
    "receiver": "uuid",
    "file_name": "string",
    "file_size": 1048576,
    "file_type": "string",
    "time_elapsed": 4500,
    "completed_at": "ISO date",
    "transfer_type": "string"
  },
  "message": "File transfer recorded successfully",
  "success": true
}
```

**Errors:**

| Status | Message                        | Condition                                                   |
| ------ | ------------------------------ | ----------------------------------------------------------- |
| `400`  | `Invalid email address`        | Email format validation failed                              |
| `400`  | `Invalid file transfer data`   | Missing fileName/fileSize/fileType/timeElapsed/transferType |
| `404`  | `Sender or receiver not found` | Email not found in database                                 |
| `500`  | `Something went wrong...`      | Unexpected error                                            |

---

#### `GET /api/v1/file-transfers/recent`

**Auth:** Authenticated  
**Rate Limit:** None  
**Source:** `src/controllers/fileTransfers.controller.ts` → `src/services/fileTransfers.service.ts` → `src/repositories/file_transfers.repo.ts`

**Query Parameters:**

| Param   | Type     | Default | Max | Description                   |
| ------- | -------- | ------- | --- | ----------------------------- |
| `limit` | `number` | 10      | 50  | Number of transfers to return |

**Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid",
      "fileSize": 0.01,
      "fileType": "text/markdown",
      "timeElapsed": 0.045,
      "transferType": "send",
      "completedAt": "2026-07-18T12:28:09.034Z",
      "senderName": "Alice",
      "senderEmail": "alice@example.com",
      "receiverName": "Bob",
      "receiverEmail": "bob@example.com"
    }
  ],
  "message": "Recent transfers fetched",
  "success": true
}
```

**Errors:**

| Status | Message                   | Condition         |
| ------ | ------------------------- | ----------------- |
| `401`  | `Unauthorized`            | Not authenticated |
| `500`  | `Something went wrong...` | Unexpected error  |

---

### 5.7 Network

#### `GET /api/network/ip`

**Auth:** None  
**Rate Limit:** None  
**Source:** `src/app.ts`

Returns the server's LAN IP and all online users on the requesting client's network.

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "ip": "192.168.1.100",
    "onlineUsers": [
      { "email": "alice@example.com", "name": "Alice" },
      { "email": "bob@example.com", "name": "Bob" }
    ]
  },
  "message": "Local network IP",
  "success": true
}
```

---

### 5.8 Health Check

#### `GET /api/v1/health`

**Auth:** None  
**Rate Limit:** `healthLimiter` (5 req / 15 min)  
**Source:** `src/controllers/health.controller.ts` → `src/services/health.service.ts`

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "app": {
      "status": "up",
      "uptime": 123.45,
      "memoryUsage": {
        "rss": "45.23 MB",
        "heapTotal": "30.12 MB",
        "heapUsed": "25.67 MB",
        "external": "1.23 MB"
      }
    },
    "database": {
      "status": "healthy",
      "latency": "3 ms"
    }
  },
  "message": "Health check successful",
  "success": true
}
```

**Response (503) — Database Down:**

```json
{
  "statusCode": 503,
  "data": {
    "app": { "status": "up", "uptime": 123.45, "memoryUsage": { "..." } },
    "database": { "status": "down", "latency": "0 ms" }
  },
  "message": "Service unavailable",
  "success": false
}
```

---

## 6. Socket.IO Documentation

**Source:** `src/components/signalling.ts`

The Socket.IO server runs on the same HTTP server as Express. Connect using:

```javascript
const socket = io("http://localhost:<PORT>");
```

Registration is handled via the `user:register` event with database validation.  
Client IP is detected via `x-forwarded-for` header (trust proxy) or `socket.handshake.address`, normalized for both IPv4 and IPv6, and used to group users into network rooms for local discovery.

**Shared State:** Socket state (`emailToSocketMap`, `activePeers`, `ipToUsersMap`) lives in `src/utils/networkStore.ts` and is also accessible from REST endpoints.

---

### 6.1 `user:register`

**Direction:** Client → Server

**Payload:**

```json
{ "email": "string", "name": "string" }
```

**Behavior:**

1. If `name` or `email` is missing → emits `registration-error`.
2. Queries the database via `Users.getByEmail(email)`.
3. If user not found → emits `registration-error`.
4. On success → adds to `emailToSocketMap`, joins socket to room `network:<normalizedIP>`, adds to `ipToUsersMap`, and broadcasts `network:user-joined` to all other sockets on the same IP.

**Emitted responses:**

`registration-error`:

```json
{ "isOnline": null, "name": "<email>", "userExists": null, "message": "..." }
```

`network:user-joined` (broadcast to network room):

```json
{
  "email": "string",
  "name": "string",
  "onlineUsers": [{ "email": "string", "name": "string" }]
}
```

---

### 6.2 `connection:request`

**Direction:** Client → Server

**Payload:**

```json
{ "from": "sender email", "to": "target email" }
```

**Behavior:**

1. Validates target user exists in database.
2. If target is online → emits `status-update` (`isOnline: true`) to sender and forwards `connection:incoming` to target.
3. If target is offline → emits `status-update` (`isOnline: false`) to sender.

---

### 6.3 `connection:response`

**Direction:** Client → Server

**Payload:**

```json
{ "from": "string", "to": "string", "accepted": true }
```

**Behavior:**

- Forwards the response to the initiator. No peer tracking on this event.

---

### 6.4 `users:connected`

**Direction:** Client → Server

**Payload:**

```json
{ "initiator": "string", "receiver": "string" }
```

**Behavior:**

- Stores bidirectional mapping in `activePeers` map: `initiator ↔ receiver`.

---

### 6.5 `network:users`

**Direction:** Client → Server

**Payload:** _(none)_

**Response:**

`network:users` (Server → Client):

```json
[{ "email": "string", "name": "string" }]
```

Returns all registered users connected from the same IP.

---

### 6.6 WebRTC Signaling (`offer`, `answer`, `ice-candidate`)

**Direction:** Client → Server (forwarded Server → Client)

**Client sends:**

```json
{
  "from": "sender email",
  "to": "target email",
  "offer"/"answer"/"candidate": "..."
}
```

**If target is online** → forwards payload to target.  
**If target is offline** → emits `user-status` back to sender:

```json
{ "isOnline": false, "message": "user offline" }
```

---

### 6.7 `disconnect` (automatic)

**Behavior:**

1. Looks up the disconnected socket's email via `getEmailBySocketId`.
2. If connected to an active peer → emits `peer:disconnected` to the peer's socket and cleans up `activePeers`.
3. If registered on a network IP → removes from `ipToUsersMap` and broadcasts `network:user-left` to the remaining room members.
4. Removes from `emailToSocketMap`.

**Emitted to peer** (`peer:disconnected`):

```json
{
  "name": "string",
  "email": "string",
  "message": "<name> went offline. Try again later"
}
```

**Emitted to network room** (`network:user-left`):

```json
{
  "email": "string",
  "onlineUsers": [{ "email": "string", "name": "string" }]
}
```

---

### 6.8 Summary of Server → Client Events

| Event Name            | When Emitted                                             |
| --------------------- | -------------------------------------------------------- |
| `registration-error`  | `user:register` fails (user not in DB or internal error) |
| `network:user-joined` | A new user registered on the same network IP             |
| `network:user-left`   | A user on the same network IP disconnected               |
| `network:users`       | Response to a `network:users` request                    |
| `status-update`       | Response to `connection:request` (online/offline status) |
| `connection:incoming` | Forwarded to target when someone requests a connection   |
| `connection:response` | Forwarded to initiator with the responder's decision     |
| `offer`               | Forwarded from another peer                              |
| `answer`              | Forwarded from another peer                              |
| `ice-candidate`       | Forwarded from another peer                              |
| `user-status`         | Target user offline (on offer/answer/ice-candidate)      |
| `peer:disconnected`   | An active peer disconnected                              |

---

## 7. In-Memory Data Structures

**Source:** `src/utils/networkStore.ts`

| Map                | Key Type         | Value Type                           | Purpose                                   |
| ------------------ | ---------------- | ------------------------------------ | ----------------------------------------- |
| `emailToSocketMap` | `string` (email) | `{ socketId: string, name: string }` | Maps registered emails to socket IDs      |
| `activePeers`      | `string` (email) | `string` (peer email)                | Tracks active P2P connections             |
| `ipToUsersMap`     | `string` (IP)    | `Set<string>` (emails)               | Groups connected users by their client IP |

---

## 8. Complete Flows

### 8.1 Signup → Verification → Login Flow

```
1. POST /api/v1/auth/signup         → Creates user, sends OTP email
2. POST /api/v1/verify/email        → Verifies OTP code
3. POST /api/v1/auth/login          → Returns tokens + cookies + session
```

### 8.2 Password Reset Flow

```
1. POST /api/v1/password/forgot     → Sends reset token via email
2. POST /api/v1/password/reset      → Validates token, updates password, invalidates ALL sessions
3. POST /api/v1/auth/login          → User must re-login
```

### 8.3 Token Refresh Flow

```
1. POST /api/v1/session/renew → Send refreshToken + userId + deviceId + sessionId
2. Receive new accessToken in response
```

### 8.4 WebRTC Signaling Flow

```
1. Both clients connect via Socket.IO
2. Both emit "user:register" with { email, name } → server validates against DB, joins network room
3. Initiator emits "connection:request" → server checks online status, forwards to target
4. Target responds with "connection:response" → server forwards back to initiator
5. Initiator emits "offer" → server forwards to receiver
6. Receiver emits "answer" → server forwards to initiator
7. Both exchange "ice-candidate" events
8. Once WebRTC connection established, either side emits "users:connected"
9. On disconnect, server emits "peer:disconnected" to the connected peer
```

### 8.5 File Transfer Logging Flow

```
1. File transfer happens over WebRTC DataChannel (not implemented in backend)
2. After completion, client calls POST /api/v1/file-transfers/complete
3. Server resolves emails to user UUIDs and persists the record
4. Client can retrieve transfer history via GET /api/v1/file-transfers/recent
```

---

## 9. Database Schema

**Source:** `database/001_init.sql`

### `users`

| Column            | Type           | Constraints                     |
| ----------------- | -------------- | ------------------------------- |
| `id`              | `UUID`         | PK, default `gen_random_uuid()` |
| `name`            | `VARCHAR(30)`  | NOT NULL                        |
| `email`           | `VARCHAR(255)` | NOT NULL, UNIQUE                |
| `password_hash`   | `TEXT`         | NOT NULL                        |
| `last_login_at`   | `TIMESTAMPTZ`  |                                 |
| `profile_picture` | `TEXT`         |                                 |
| `verified_at`     | `TIMESTAMPTZ`  |                                 |
| `deleted_at`      | `TIMESTAMPTZ`  |                                 |
| `created_on`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()         |
| `updated_on`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()         |

### `user_sessions`

| Column          | Type          | Constraints                       |
| --------------- | ------------- | --------------------------------- |
| `id`            | `UUID`        | PK                                |
| `user_id`       | `UUID`        | FK → users(id), ON DELETE CASCADE |
| `device_id`     | `TEXT`        | UNIQUE, NOT NULL                  |
| `refresh_token` | `TEXT`        | NOT NULL                          |
| `expires_at`    | `TIMESTAMPTZ` | NOT NULL                          |
| `created_at`    | `TIMESTAMPTZ` | DEFAULT NOW()                     |
| `device_type`   | `JSONB`       | DEFAULT `{}`                      |

### `email_verification_tokens`

| Column       | Type          | Constraints                      |
| ------------ | ------------- | -------------------------------- |
| `id`         | `UUID`        | PK                               |
| `user_id`    | `UUID`        | NOT NULL, UNIQUE, FK → users(id) |
| `token_hash` | `TEXT`        | NOT NULL                         |
| `used_at`    | `TIMESTAMPTZ` | DEFAULT NULL                     |
| `revoked_at` | `TIMESTAMPTZ` | DEFAULT NULL                     |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW()                    |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL                         |

### `password_reset_tokens`

| Column       | Type          | Constraints              |
| ------------ | ------------- | ------------------------ |
| `id`         | `UUID`        | PK                       |
| `user_id`    | `UUID`        | NOT NULL, FK → users(id) |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL                 |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW()            |
| `token_hash` | `TEXT`        | NOT NULL                 |
| `used_at`    | `TIMESTAMPTZ` | DEFAULT NULL             |

### `file_transfers`

| Column          | Type               | Constraints              |
| --------------- | ------------------ | ------------------------ |
| `id`            | `UUID`             | PK                       |
| `sender`        | `UUID`             | NOT NULL, FK → users(id) |
| `receiver`      | `UUID`             | NOT NULL, FK → users(id) |
| `file_size`     | `NUMERIC(10,2)`    | NOT NULL (in MB)         |
| `file_type`     | `TEXT`             | NOT NULL                 |
| `time_elapsed`  | `DOUBLE PRECISION` | NOT NULL                 |
| `completed_at`  | `TIMESTAMPTZ`      | DEFAULT NULL             |
| `transfer_type` | `TEXT`             | NOT NULL                 |

---

## 10. Edge Cases Handled In Code

| Scenario                              | Where Handled                        | Response                          |
| ------------------------------------- | ------------------------------------ | --------------------------------- |
| Missing required fields               | All services                         | `400` with specific message       |
| Invalid email format                  | Verify, Reset, FileTransfer services | `400` Invalid email address       |
| Invalid UUID format                   | Session service, Token service       | `400` Invalid user id             |
| User not found by email               | Auth, Verify, Reset, Signaling       | `404` User not found              |
| User not found by ID                  | Token service                        | `404` User not found              |
| Duplicate email on signup             | Auth service                         | `409` Email already exists        |
| Password mismatch on login            | Auth service                         | `400` Invalid credentials         |
| Password ≠ confirmPassword on reset   | Reset service                        | `400` Password does not match     |
| Expired OTP code                      | Verify service                       | `400` Token Expired               |
| Already verified email                | Verify service                       | `200` Email already verified      |
| Reset token already used              | Reset service                        | `400` Token already used          |
| Reset token expired                   | Reset service                        | `400` Reset Token Expired         |
| Refresh token expired                 | Token service                        | `400` Refresh token expired       |
| Invalid refresh token hash            | Token service                        | `400` Invalid refresh Token       |
| No active sessions found              | Session service                      | `404` No user session found       |
| Target user offline (socket)          | Signaling (offer/answer/ice)         | `user-status` event emitted       |
| Unregistered email on socket register | Signaling                            | `registration-error` event        |
| Active peer disconnects               | Signaling (disconnect handler)       | `peer:disconnected` event to peer |
| Network user joins                    | Signaling (`user:register`)          | `network:user-joined` broadcast   |
| Network user leaves                   | Signaling (disconnect handler)       | `network:user-left` broadcast     |
| IPv4-mapped IPv6 (`::ffff:...`)       | `normalizeIP` in networkStore.ts     | Stripped to IPv4                  |
| Rate limit exceeded                   | Auth login, signup, health           | `429` with text message           |

---

## 11. Cookie Configuration

**Source:** `src/constants.ts`

```json
{
  "httpOnly": true,
  "secure": true
}
```

Cookies set on login: `accessToken`, `refreshToken`, `deviceId`.  
Cookies cleared on logout: `accessToken`, `refreshToken`, `deviceId`.

---
