import { httpServer } from "./components/signalling.js";
import { pool } from "./configs/db.js";
import logger from "./utils/logger/logger.js";

async function bootstrapApplication(server: any) {
  try {
    await pool.connect();
    server.listen(process.env.PORT || 3000, () => {
      logger.info({ port: process.env.PORT || 3000 }, "Server started");
    });
  } catch (err) {
    logger.fatal({ err, message: "Server failed to start" });
    process.exit(1);
  }
}

bootstrapApplication(httpServer);
