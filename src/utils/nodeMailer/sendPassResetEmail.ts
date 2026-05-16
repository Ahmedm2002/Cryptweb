import transport from "../../configs/nodemailer.js";
import resetPasswordTemplate from "../../templates/passwordReset.temp.js";
import logger from "../logger/logger.js";

async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = process.env.RESET_PASSWORD_REDIRECT_BASE_URL + `?t=${token}`;
  try {
    await transport.sendMail({
      to: email,
      subject: "Reset Password",
      html: resetPasswordTemplate(resetUrl),
    });
    logger.info({ email }, "Password reset email sent successfully");
  } catch (error: any) {
    logger.fatal(
      { err: error, message: error.message },
      "Failed to send password reset email",
    );
    throw new Error("Error sending reset password to user: ", error.message);
  }
}

export default sendPasswordResetEmail;
