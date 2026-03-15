import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { ClipboardService } from './clipboard.service';
import { CreateTextItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ClipboardQueryDto } from './dto/clipboard-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('clipboard')
@ApiBearerAuth('JWT-auth')
@Controller('clipboard')
export class ClipboardController {
  private readonly logger = new Logger(ClipboardController.name);

  constructor(private readonly clipboardService: ClipboardService) {}

  /**
   * POST /clipboard — Create a text clipboard item
   */
  @Post()
  @ApiOperation({ summary: 'Create a text clipboard item' })
  @ApiResponse({ status: 201, description: 'Item created' })
  async createTextItem(
    @Body() dto: CreateTextItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.createTextItem(user.id, dto.content);
  }

  /**
   * POST /clipboard/upload — Upload a file
   */
  @Post('upload')
  @ApiOperation({ summary: 'Upload a file as a clipboard item (max 100MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  async uploadFile(
    @Req() req: FastifyRequest,
    @CurrentUser() user: RequestUser,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const buffer = await file.toBuffer();
    this.logger.debug(
      `File upload: ${file.filename}, ${file.mimetype}, ${buffer.length} bytes`,
    );

    return this.clipboardService.createFileItem(user.id, {
      buffer,
      filename: file.filename,
      mimetype: file.mimetype,
    });
  }

  /**
   * GET /clipboard — List clipboard items (paginated)
   */
  @Get()
  @ApiOperation({ summary: 'List clipboard items (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of items' })
  async listItems(
    @Query() query: ClipboardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.listItems(user.id, query);
  }

  /**
   * GET /clipboard/:id — Get a single clipboard item
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a clipboard item by ID' })
  @ApiResponse({ status: 200, description: 'Clipboard item' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getItem(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.getItem(user.id, id);
  }

  /**
   * PATCH /clipboard/:id — Update a clipboard item
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a clipboard item' })
  @ApiResponse({ status: 200, description: 'Updated item' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.updateItem(user.id, id, dto);
  }

  /**
   * DELETE /clipboard/:id — Soft-delete a clipboard item
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a clipboard item' })
  @ApiResponse({ status: 200, description: 'Item deleted' })
  async deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.deleteItem(user.id, id);
  }

  /**
   * GET /clipboard/:id/download — Get a signed S3 download URL
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Get a signed download URL for a file item' })
  @ApiResponse({ status: 200, description: 'Signed URL' })
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clipboardService.getDownloadUrl(user.id, id);
  }
}
