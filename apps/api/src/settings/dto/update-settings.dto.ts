import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const allowedDays = [1, 7, 30, 90, 365] as const;

const updateSettingsSchema = z.object({
  'retention.archiveAfterDays': z
    .union([
      z.null(),
      z
        .number()
        .int()
        .refine((v) => (allowedDays as readonly number[]).includes(v), {
          message: 'Must be one of: 1, 7, 30, 90, 365',
        }),
    ])
    .optional(),
  'retention.deleteAfterArchiveDays': z
    .union([
      z.null(),
      z
        .number()
        .int()
        .refine((v) => (allowedDays as readonly number[]).includes(v), {
          message: 'Must be one of: 1, 7, 30, 90, 365',
        }),
    ])
    .optional(),
});

export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
