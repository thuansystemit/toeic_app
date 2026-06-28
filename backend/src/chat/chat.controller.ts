import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/** Chatbot (AI study assistant) — conversations + streaming answers. */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user.id);
  }

  @Get('conversations/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.getConversation(user.id, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.deleteConversation(user.id, id);
  }

  /** Send a message; the answer streams back as Server-Sent Events. */
  @Post('message')
  async message(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx proxy buffering
    res.flushHeaders?.();

    const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    try {
      for await (const ev of this.chat.streamMessage(
        user.id,
        dto.conversationId ?? null,
        dto.message,
        dto.locale ?? 'en',
      )) {
        send(ev);
      }
      send({ type: 'done' });
    } catch (e) {
      send({ type: 'error', message: (e as Error).message });
    } finally {
      res.end();
    }
  }
}
