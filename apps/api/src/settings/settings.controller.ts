import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminGuard)
@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings/system — Return all system settings (admin only)
   */
  @Get('system')
  @ApiOperation({ summary: 'Get all system settings (admin only)' })
  @ApiResponse({ status: 200, description: 'All system settings as key-value map' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin access required' })
  async getSystemSettings() {
    return this.settingsService.getAll();
  }

  /**
   * PATCH /settings/system — Update one or more system settings (admin only)
   */
  @Patch('system')
  @ApiOperation({ summary: 'Update system settings (admin only)' })
  @ApiResponse({ status: 200, description: 'Updated system settings' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin access required' })
  async updateSystemSettings(@Body() dto: UpdateSettingsDto) {
    const updates = dto as Record<string, unknown>;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await this.settingsService.set(key, value);
        this.logger.debug(`Admin updated setting: ${key}`);
      }
    }

    return this.settingsService.getAll();
  }
}
