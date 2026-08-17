import type { CONSTS } from "./types/constants.type.js";

const CONSTANTS: CONSTS = {
  SERVER_ERROR: "Something went wrong at our end. Please Try again later",
  cookieOpts: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
  OTP_EXPIRY_MS: 300000,
};

export default CONSTANTS;
