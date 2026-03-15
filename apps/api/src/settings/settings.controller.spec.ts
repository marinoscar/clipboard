import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../common/guards/admin.guard';

const mockSettings = {
  'retention.archiveAfterDays': 30,
  'retention.deleteAfterArchiveDays': 7,
};

describe('SettingsController', () => {
  let controller: SettingsController;
  let settingsService: any;

  beforeEach(async () => {
    settingsService = {
      getAll: jest.fn().mockResolvedValue(mockSettings),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: settingsService },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  // ---------------------------------------------------------------------------
  // GET /settings/system
  // ---------------------------------------------------------------------------
  describe('getSystemSettings', () => {
    it('should delegate to settingsService.getAll()', async () => {
      const result = await controller.getSystemSettings();

      expect(result).toEqual(mockSettings);
      expect(settingsService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /settings/system
  // ---------------------------------------------------------------------------
  describe('updateSystemSettings', () => {
    it('should call set for each provided key and return updated settings', async () => {
      settingsService.getAll.mockResolvedValue({
        'retention.archiveAfterDays': 90,
        'retention.deleteAfterArchiveDays': null,
      });

      const dto = { 'retention.archiveAfterDays': 90 } as any;
      const result = await controller.updateSystemSettings(dto);

      expect(settingsService.set).toHaveBeenCalledWith(
        'retention.archiveAfterDays',
        90,
      );
      expect(result['retention.archiveAfterDays']).toBe(90);
    });

    it('should call set for null value (disabling retention)', async () => {
      settingsService.getAll.mockResolvedValue({
        'retention.archiveAfterDays': null,
        'retention.deleteAfterArchiveDays': null,
      });

      const dto = { 'retention.archiveAfterDays': null } as any;
      await controller.updateSystemSettings(dto);

      expect(settingsService.set).toHaveBeenCalledWith(
        'retention.archiveAfterDays',
        null,
      );
    });

    it('should update multiple keys in one request', async () => {
      settingsService.getAll.mockResolvedValue(mockSettings);

      const dto = {
        'retention.archiveAfterDays': 30,
        'retention.deleteAfterArchiveDays': 7,
      } as any;

      await controller.updateSystemSettings(dto);

      expect(settingsService.set).toHaveBeenCalledTimes(2);
    });

    it('should not call set for undefined values', async () => {
      settingsService.getAll.mockResolvedValue(mockSettings);

      // Only one key is present (undefined values skipped)
      const dto = { 'retention.archiveAfterDays': 30 } as any;
      await controller.updateSystemSettings(dto);

      expect(settingsService.set).toHaveBeenCalledTimes(1);
    });
  });
});
