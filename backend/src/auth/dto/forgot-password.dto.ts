import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(255)
  email!: string;
}
