import type { CONSTS } from "./types/constants.type.js";

const CONSTANTS: CONSTS = {
  SERVER_ERROR: "Something went wrong at our end. Please Try again later",
  cookieOpts: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 8000,
    domain: process.env.ALLOWED_ORIGIN,
  },
  authCookieOpts: {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 8000,
    domain: process.env.ALLOWED_ORIGIN,
  },
  OTP_EXPIRY_MS: 300000,
};

console.log("Constants: ", CONSTANTS);
export default CONSTANTS;
