// dtos/auth.dto.ts
import type { SafeUserDto } from "../user/user.dto.js";

export interface LoginResDto {
  user: SafeUserDto;
}

export interface SignupResDto {
  user: SafeUserDto;
}
