import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/** Chatbot (AI study assistant). Uses raw SQL over chat_* tables + the streaming
 *  LLM provider; no forFeature entities needed. */
@Module({
  imports: [LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
