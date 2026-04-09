import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

export default cors(corsOptions);
