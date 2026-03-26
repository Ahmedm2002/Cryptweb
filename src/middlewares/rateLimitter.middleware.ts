import rateLimit from "express-rate-limit";

class RateLimiter {
  constructor() {}
  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  signupLimiter = rateLimit({
    windowMs: 10 * 60 * 60 * 1000,
    max: 20,
    message: "Too many accounts created, please try again later",
  });

  healthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many health check requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const rateLimiter = new RateLimiter();
export default rateLimiter as RateLimiter;
