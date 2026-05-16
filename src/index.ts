import { httpServer } from "./components/signalling.js";
import { pool } from "./configs/db.js";

async function bootstrapApplication(server: any) {
  try {
    await pool.connect();
    server.listen(process.env.PORT || 3000, () => {
      console.log({ port: process.env.PORT || 3000 }, "Server started");
    });
  } catch (err) {
    console.log({ err }, "Startup failure");
    console.error("COMPLETE ERROR:", err);
    process.exit(1);
  }
}

bootstrapApplication(httpServer);
