import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
