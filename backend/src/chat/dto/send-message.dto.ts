import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  /** Existing conversation to append to; omit to start a new one. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  /** Reply language (defaults to English). */
  @IsOptional()
  @IsIn(['en', 'vi'])
  locale?: 'en' | 'vi';
}
