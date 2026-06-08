type CONSTS = {
  SERVER_ERROR: string;
  cookieOpts: {
    httpOnly: boolean;
    secure: boolean;
    path: string;
    sameSite: "lax" | "none" | "strict" | boolean;
    maxAge: number;
  };
  authCookieOpts: {
    httpOnly: boolean;
    secure: boolean;
    path: string;
    sameSite: "lax" | "none" | "strict" | boolean;
    maxAge: number;
  };
  OTP_EXPIRY_MS: number;
};

export type { CONSTS };
