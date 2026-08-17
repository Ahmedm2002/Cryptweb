import { MongoClient, type Db } from "mongodb";
import logger from "../utils/logger/logger.js";

const client: MongoClient = new MongoClient(
  process.env.MONGODB_URI ?? "mongodb://localhost:27017",
);

let db: Db;

async function connectDB(): Promise<Db> {
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME ?? "cryptweb");
  logger.info("MongoDB connected");
  return db;
}

function getDb(): Db {
  if (!db) throw new Error("Database not initialized. Call connectDB first.");
  return db;
}

export { client, connectDB, getDb };
