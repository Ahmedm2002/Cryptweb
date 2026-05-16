import cors from "cors";

const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};

export default cors(corsOptions);
