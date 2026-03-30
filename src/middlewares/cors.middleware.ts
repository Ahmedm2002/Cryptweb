import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

console.log("ALLOWED_ORIGIN", process.env.ALLOWED_ORIGIN);
const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

export default corsOptions;
