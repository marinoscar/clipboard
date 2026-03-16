import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ClipboardUploadService } from './clipboard-upload.service';
import {
  InitUploadDto,
  CompleteUploadDto,
  RecordPartDto,
  PartUrlQueryDto,
} from './dto/multipart-upload.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('clipboard-upload')
@ApiBearerAuth('JWT-auth')
@Controller('clipboard/upload')
export class ClipboardUploadController {
  private readonly logger = new Logger(ClipboardUploadController.name);

  constructor(private readonly uploadService: ClipboardUploadService) {}

  /**
   * POST /clipboard/upload/init — Initiate a multipart upload
   */
  @Post('init')
  @ApiOperation({ summary: 'Initiate a multipart S3 upload' })
  @ApiResponse({
    status: 201,
    description: 'Upload initiated. Returns itemId, uploadId, totalParts, and partSize.',
  })
  async initUpload(
    @Body() dto: InitUploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.logger.debug(`initUpload: userId=${user.id} fileName=${dto.fileName}`);
    return this.uploadService.initUpload(user.id, dto);
  }

  /**
   * GET /clipboard/upload/:id/url — Get a presigned URL for one part
   */
  @Get(':id/url')
  @ApiOperation({ summary: 'Get a presigned URL for uploading a single part' })
  @ApiResponse({ status: 200, description: 'Presigned URL and part number' })
  @ApiResponse({ status: 400, description: 'Upload not in progress' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getPartUrl(
    @Param('id') id: string,
    @Query() query: PartUrlQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.getPartUrl(user.id, id, query.partNumber);
  }

  /**
   * POST /clipboard/upload/:id/part — Record that a part was uploaded
   */
  @Post(':id/part')
  @ApiOperation({ summary: 'Record a successfully uploaded part (ETag + size)' })
  @ApiResponse({ status: 201, description: 'Part recorded' })
  @ApiResponse({ status: 400, description: 'Upload not in progress' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async recordPart(
    @Param('id') id: string,
    @Body() dto: RecordPartDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.completePart(
      user.id,
      id,
      dto.partNumber,
      dto.eTag,
      dto.size,
    );
  }

  /**
   * POST /clipboard/upload/:id/complete — Finalise the multipart upload
   */
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete the multipart upload' })
  @ApiResponse({ status: 201, description: 'Upload complete, item now active' })
  @ApiResponse({ status: 400, description: 'Upload not in progress or invalid parts' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async completeUpload(
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.completeUpload(user.id, id, dto.parts);
  }

  /**
   * POST /clipboard/upload/:id/abort — Abort the multipart upload
   */
  @Post(':id/abort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abort and clean up a multipart upload' })
  @ApiResponse({ status: 200, description: 'Upload aborted' })
  @ApiResponse({ status: 400, description: 'Upload not in progress' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async abortUpload(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.abortUpload(user.id, id);
  }

  /**
   * GET /clipboard/upload/:id/status — Get upload progress
   */
  @Get(':id/status')
  @ApiOperation({ summary: 'Get the status and uploaded parts of an in-progress upload' })
  @ApiResponse({ status: 200, description: 'Upload status with uploaded parts list' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getStatus(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadService.getUploadStatus(user.id, id);
  }
}
