import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { Engine6Service, ChatResponse } from './engine6.service';

class ChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}

@Controller('engine6')
export class Engine6Controller {
  constructor(private readonly engine6Service: Engine6Service) {}

  /**
   * POST /api/engine6/chat
   * Public — no auth required.
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() dto: ChatDto,
  ): Promise<{ success: true; data: ChatResponse }> {
    try {
      const data = await this.engine6Service.chat(dto.question);
      return { success: true, data };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
