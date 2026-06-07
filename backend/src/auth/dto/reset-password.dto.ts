import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  // Same policy as registration (REQ-003): >= 8 chars and one number.
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}
