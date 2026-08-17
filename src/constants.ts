import type { CONSTS } from "./types/constants.type.js";

const CONSTANTS: CONSTS = {
  SERVER_ERROR: "Something went wrong at our end. Please Try again later",
  cookieOpts: {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000,
  },
  clearCookieOpts: {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "none",
  },
  OTP_EXPIRY_MS: 300000,
};

export default CONSTANTS;
