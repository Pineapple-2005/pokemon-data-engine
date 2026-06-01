import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { Engine5Service, CommentaryResponse } from './engine5.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CommentDto {
  @IsString()
  @IsNotEmpty()
  match_id: string;
}

@Controller('engine5')
export class Engine5Controller {
  constructor(private readonly engine5Service: Engine5Service) {}

  /**
   * POST /api/engine5/comment
   * Requires JWT auth.
   */
  @UseGuards(JwtAuthGuard)
  @Post('comment')
  @HttpCode(HttpStatus.OK)
  async comment(
    @Body() dto: CommentDto,
  ): Promise<{ success: true; data: CommentaryResponse }> {
    try {
      const data = await this.engine5Service.generateCommentary(dto.match_id);
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
