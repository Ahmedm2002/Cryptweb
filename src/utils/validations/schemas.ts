import * as z from "zod";

const emailSchema = z.email({ message: "Invalid email address" });

const passwordSchema = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long");

const userNameSchema = z.string().trim().min(3, "Invalid user name");

const userHandleSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores",
  );

export { emailSchema, passwordSchema, userNameSchema, userHandleSchema };
