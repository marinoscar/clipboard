import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ClipboardShareService } from './clipboard-share.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequestUser } from '../auth/interfaces/authenticated-user.interface';

// ---------------------------------------------------------------------------
// Authenticated share management
// ---------------------------------------------------------------------------

@ApiTags('clipboard')
@ApiBearerAuth('JWT-auth')
@Controller('clipboard')
export class ClipboardShareController {
  private readonly logger = new Logger(ClipboardShareController.name);

  constructor(private readonly shareService: ClipboardShareService) {}

  /**
   * POST /clipboard/:id/share — Enable public sharing for an item
   */
  @Post(':id/share')
  @ApiOperation({ summary: 'Enable public sharing for a clipboard item' })
  @ApiParam({ name: 'id', description: 'Clipboard item ID' })
  @ApiResponse({ status: 201, description: 'Sharing enabled — returns shareToken and shareUrl' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the item owner' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async enableSharing(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.logger.debug(`User ${user.id} enabling sharing for item ${id}`);
    return this.shareService.enableSharing(user.id, id);
  }

  /**
   * DELETE /clipboard/:id/share — Disable public sharing for an item
   */
  @Delete(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable public sharing for a clipboard item' })
  @ApiParam({ name: 'id', description: 'Clipboard item ID' })
  @ApiResponse({ status: 204, description: 'Sharing disabled' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the item owner' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async disableSharing(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.logger.debug(`User ${user.id} disabling sharing for item ${id}`);
    await this.shareService.disableSharing(user.id, id);
  }
}

// ---------------------------------------------------------------------------
// Public share access (no auth required)
// ---------------------------------------------------------------------------

@ApiTags('share')
@Controller('share')
export class ShareController {
  private readonly logger = new Logger(ShareController.name);

  constructor(private readonly shareService: ClipboardShareService) {}

  /**
   * GET /share/:shareToken — Get a publicly shared item
   */
  @Public()
  @Get(':shareToken')
  @ApiOperation({ summary: 'Get a publicly shared clipboard item' })
  @ApiParam({ name: 'shareToken', description: 'Share token from the share URL' })
  @ApiResponse({ status: 200, description: 'Shared item details (safe subset)' })
  @ApiResponse({ status: 404, description: 'Not found or no longer public' })
  async getPublicItem(@Param('shareToken') shareToken: string) {
    this.logger.debug(`Public access for share token ${shareToken}`);
    return this.shareService.getPublicItem(shareToken);
  }

  /**
   * GET /share/:shareToken/download — Get a signed download URL for a shared file
   */
  @Public()
  @Get(':shareToken/download')
  @ApiOperation({ summary: 'Get a signed S3 download URL for a shared file item' })
  @ApiParam({ name: 'shareToken', description: 'Share token from the share URL' })
  @ApiResponse({ status: 200, description: 'Signed download URL' })
  @ApiResponse({ status: 404, description: 'Not found, no longer public, or not a file item' })
  async getPublicDownloadUrl(@Param('shareToken') shareToken: string) {
    this.logger.debug(`Public download URL request for share token ${shareToken}`);
    return this.shareService.getPublicDownloadUrl(shareToken);
  }
}
