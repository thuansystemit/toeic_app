import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(255)
  email!: string;

  // REQ-003: password >= 8 chars and at least one number
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password!: string;

  // REQ-009: display name non-empty, <= 100 chars
  @IsString()
  @MinLength(1, { message: 'Display name is required' })
  @MaxLength(100)
  displayName!: string;
}
