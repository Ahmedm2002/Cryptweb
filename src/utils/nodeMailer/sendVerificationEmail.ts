import transport from "../../configs/nodemailer.js";
import verificationEmailTemplate from "../../templates/emailVerification.temp.js";
import crypto from "node:crypto";
import logger from "../logger/logger.js";

async function sendVerificationCode(email: string, username: string) {
  const code = String(crypto.randomInt(100000, 999999));
  try {
    await transport.sendMail({
      to: email,
      subject: "Verify your email address",
      html: verificationEmailTemplate(username, code),
    });
    logger.info({ email }, "Verification email sent successfully");
    return code;
  } catch (error: any) {
    logger.fatal({ err: error, message: error.message }, "Failed to send verification email");
    throw new Error("Error sending verification code to email");
  }
}

export default sendVerificationCode;
