import cors from "cors";

const corsOptions: cors.CorsOptions = {
  origin: [process.env.ALLOWED_ORIGIN || "*"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
