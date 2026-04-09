// dtos/auth.dto.ts
import type { SafeUserDto } from "../user/user.dto.js";

export interface LoginResDto {
  user: SafeUserDto;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface SignupResDto {
  user: SafeUserDto;
}
