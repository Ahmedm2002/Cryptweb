# CryptWeb Backend

## 1. System Overview

CryptWeb is a Node.js/Express backend service providing:

- **Authentication** (signup, login with JWT + cookie-based sessions)
- **Email Verification** (OTP code verification flow)
- **Password Management** (forgot + reset password with email token)
- **Session Management** (multi-device sessions, logout, token refresh)
- **File Transfer Logging** (persists completed P2P file transfer metadata)
- **WebRTC Signaling** (Socket.IO-based offer/answer/ICE exchange with active peer tracking)
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

#### `GET /api/v1/user-session/all`

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

#### `DELETE /api/v1/user-session/log-out`

**Auth:**  Authenticated  
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

#### `POST /api/v1/user-session/log-out/all-sessions`

**Auth:**  Authenticated  
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

#### `POST /api/v1/user-session/get-access-token`

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

**Auth:**  Authenticated  
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
| `fileSize`      | `number` | File size in bytes                            |
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

### 5.7 Health Check

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

**Source:** `src/components/singalling.ts`

The Socket.IO server runs on the same HTTP server as Express. Connect using:

```javascript
const socket = io("http://localhost:<PORT>");
```

No socket-level authentication middleware is found in the codebase. Registration is handled via the `register` event with database validation.

---

### 6.1 `register`

**Direction:** Client → Server  
**Source:** `singalling.ts` lines 25–49

**Payload:**

```json
{ "email": "string", "name": "string" }
```

**Behavior:**

1. If `name` or `email` is missing → silently returns (no response emitted).
2. Queries the database via `Users.getByEmail(email)`.
3. If user not found → emits `registration-error`.
4. If database query throws → emits `registration-error`.
5. On success → adds to `emailToSocketMap` (no response event emitted).

**Possible emitted responses:**

`registration-error` (Server → Client):

```json
{ "message": "User does not exist" }
```

```json
{ "message": "Internal server error" }
```

---

### 6.2 `offer`

**Direction:** Client → Server (then forwarded Server → Client)  
**Source:** `singalling.ts` lines 51–61

**Client sends:**

```json
{
  "from": "sender email",
  "to": "target email",
  "offer": "RTCSessionDescriptionInit"
}
```

**If target user is online** — emits `offer` to target socket:

```json
{
  "offer": "RTCSessionDescriptionInit",
  "from": "sender email"
}
```

**If target user is NOT online** — emits `user-status` back to sender:

```json
{ "isOnline": false, "message": "user offline" }
```

---

### 6.3 `answer`

**Direction:** Client → Server (then forwarded Server → Client)  
**Source:** `singalling.ts` lines 63–72

**Client sends:**

```json
{
  "from": "sender email",
  "to": "target email",
  "answer": "RTCSessionDescriptionInit"
}
```

**If target user is online** — emits `answer` to target socket:

```json
{
  "answer": "RTCSessionDescriptionInit",
  "from": "sender email"
}
```

**If target user is NOT online** — emits `user-status` back to sender:

```json
{ "isOnline": false, "message": "user offline" }
```

---

### 6.4 `ice-candidate`

**Direction:** Client → Server (then forwarded Server → Client)  
**Source:** `singalling.ts` lines 75–85

**Client sends:**

```json
{
  "from": "sender email",
  "to": "target email",
  "candidate": "RTCIceCandidateInit"
}
```

**If target user is online** — emits `ice-candidate` to target socket:

```json
{
  "candidate": "RTCIceCandidateInit",
  "from": "sender email"
}
```

**If target user is NOT online** — emits `user-status` back to sender:

```json
{ "isOnline": false, "message": "user offline" }
```

---

### 6.5 `users:connected`

**Direction:** Client → Server  
**Source:** `singalling.ts` lines 87–94

**Client sends:**

```json
{
  "initiator": "email of the user who created the offer",
  "receiver": "email of the user who received the offer"
}
```

**Behavior:**

- Stores bidirectional mapping in `activePeers` map: `initiator ↔ receiver`.
- No response event is emitted.

---

### 6.6 `disconnect` (automatic)

**Direction:** Automatic (triggered by Socket.IO on connection loss)  
**Source:** `singalling.ts` lines 96–114

**Behavior:**

1. Looks up the disconnected socket's email via `getEmailBySocketId`.
2. If email not found → returns (no action).
3. Checks `activePeers` map for a connected peer.
4. If no peer found → returns (only cleans up emailToSocketMap).
5. If peer found → emits `user-status` to the peer's socket.
6. Cleans up both entries from `activePeers` and removes from `emailToSocketMap`.

**Emitted to peer** (`user-status`, Server → Client):

```json
{
  "isOnline": false,
  "message": "<name> went offline"
}
```

Where `<name>` is the registered name of the disconnected user, or `"User"` if lookup fails.

---

### 6.7 Summary of Server → Client Events

| Event Name           | When Emitted                                                                   |
| -------------------- | ------------------------------------------------------------------------------ |
| `registration-error` | `register` fails (user not in DB or internal error)                            |
| `offer`              | Forwarded from another peer                                                    |
| `answer`             | Forwarded from another peer                                                    |
| `ice-candidate`      | Forwarded from another peer                                                    |
| `user-status`        | Target user offline (on offer/answer/ice-candidate) OR active peer disconnects |

---

## 7. In-Memory Data Structures

**Source:** `singalling.ts` lines 17–20

| Map                | Key Type         | Value Type                           | Purpose                              |
| ------------------ | ---------------- | ------------------------------------ | ------------------------------------ |
| `emailToSocketMap` | `string` (email) | `{ socketId: string, name: string }` | Maps registered emails to socket IDs |
| `activePeers`      | `string` (email) | `string` (peer email)                | Tracks active P2P connections        |

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
1. POST /api/v1/user-session/get-access-token → Send refreshToken + userId + deviceId + sessionId
2. Receive new accessToken in response
```

### 8.4 WebRTC Signaling Flow

```
1. Both clients connect via Socket.IO
2. Both emit "register" with { email, name } → server validates against DB
3. Initiator emits "offer" → server forwards to receiver
4. Receiver emits "answer" → server forwards to initiator
5. Both exchange "ice-candidate" events
6. Once WebRTC connection established, either side emits "users:connected"
7. On disconnect, server automatically notifies the peer via "user-status"
```

### 8.5 File Transfer Logging Flow

```
1. File transfer happens over WebRTC DataChannel (not implemented in backend)
2. After completion, client calls POST /api/v1/file-transfers/complete
3. Server resolves emails to user UUIDs and persists the record
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

| Column          | Type          | Constraints              |
| --------------- | ------------- | ------------------------ |
| `id`            | `UUID`        | PK                       |
| `sender`        | `UUID`        | NOT NULL, FK → users(id) |
| `receiver`      | `UUID`        | NOT NULL, FK → users(id) |
| `file_name`     | `TEXT`        | NOT NULL                 |
| `file_size`     | `BIGINT`      | NOT NULL                 |
| `file_type`     | `TEXT`        | NOT NULL                 |
| `time_elapsed`  | `INTEGER`     | NOT NULL                 |
| `completed_at`  | `TIMESTAMPTZ` | DEFAULT NULL             |
| `transfer_type` | `TEXT`        | NOT NULL                 |

---

## 10. Edge Cases Handled In Code

| Scenario                              | Where Handled                        | Response                      |
| ------------------------------------- | ------------------------------------ | ----------------------------- |
| Missing required fields               | All services                         | `400` with specific message   |
| Invalid email format                  | Verify, Reset, FileTransfer services | `400` Invalid email address   |
| Invalid UUID format                   | Session service, Token service       | `400` Invalid user id         |
| User not found by email               | Auth, Verify, Reset, Signaling       | `404` User not found          |
| User not found by ID                  | Token service                        | `404` User not found          |
| Duplicate email on signup             | Auth service                         | `409` Email already exists    |
| Password mismatch on login            | Auth service                         | `400` Invalid credentials     |
| Password ≠ confirmPassword on reset   | Reset service                        | `400` Password does not match |
| Expired OTP code                      | Verify service                       | `400` Token Expired           |
| Already verified email                | Verify service                       | `200` Email already verified  |
| Reset token already used              | Reset service                        | `400` Token already used      |
| Reset token expired                   | Reset service                        | `400` Reset Token Expired     |
| Refresh token expired                 | Token service                        | `400` Refresh token expired   |
| Invalid refresh token hash            | Token service                        | `400` Invalid refresh Token   |
| No active sessions found              | Session service                      | `404` No user session found   |
| Target user offline (socket)          | Signaling (offer/answer/ice)         | `user-status` event emitted   |
| Unregistered email on socket register | Signaling                            | `registration-error` event    |
| Active peer disconnects               | Signaling (disconnect handler)       | `user-status` event to peer   |
| Rate limit exceeded                   | Auth login, signup, health           | `429` with text message       |

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
