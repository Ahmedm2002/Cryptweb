import pino from "pino";

const ENV = process.env.NODE_ENV;
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const sharedOptions = {
  level: LOG_LEVEL,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "token",
    "refreshToken",
    "accessToken",
  ],
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { pid: false, hostname: false },
};

const prettyOptions = {
  colorize: true,
  translateTime: "yyyy-mm-dd HH:MM:ss.l o",
  ignore: "pid,hostname",
};

const logger =
  ENV === "development"
    ? pino({
        ...sharedOptions,
        transport: {
          target: "pino-pretty",
          options: prettyOptions,
        },
      })
    : pino({
        ...sharedOptions,
        transport: {
          targets: [
            {
              target: "pino-pretty",
              options: prettyOptions,
              level: LOG_LEVEL,
            },
            {
              target: "pino-roll",
              options: {
                file: "logs/app.log",
                frequency: "daily",
                mkdir: true,
              },
              level: LOG_LEVEL,
            },
          ],
        },
      });

export default logger;
