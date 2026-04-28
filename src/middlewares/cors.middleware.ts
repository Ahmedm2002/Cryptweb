import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
console.log("Cors: ", process.env.ALLOWED_ORIGIN);
const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};

export default cors(corsOptions);
