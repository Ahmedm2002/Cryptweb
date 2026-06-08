import type { CONSTS } from "./types/constants.type.js";

const CONSTANTS: CONSTS = {
  SERVER_ERROR: "Something went wrong at our end. Please Try again later",
  cookieOpts: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 8000,
    Domain: process.env.ALLOWED_ORIGIN,
  },
  authCookieOpts: {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60 * 8000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    Domain: process.env.ALLOWED_ORIGIN,
  },
  OTP_EXPIRY_MS: 300000,
};

export default CONSTANTS;
