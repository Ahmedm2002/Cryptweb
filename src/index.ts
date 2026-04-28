import dotenv from "dotenv";
import { httpServer } from "./components/signalling.js";
import { pool } from "./configs/db.js";
dotenv.config({
  quiet: true,
});

async function startServer() {
  try {
    await pool.connect();
    httpServer.listen(process.env.PORT || 3000, () => {
      console.log({ port: process.env.PORT || 3000 }, "Server started");
    });
  } catch (err) {
    console.log({ err }, "Startup failure");
    console.error("FULL ERROR:", err);
    process.exit(1);
  }
}

startServer();
