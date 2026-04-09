import jwt from "jsonwebtoken";

function decodeRefreshToken(refreshToken: string) {
  try {
    const decoded = jwt.decode(refreshToken);
    return decoded?.sub as String;
  } catch (error) {}
}

export default decodeRefreshToken;
