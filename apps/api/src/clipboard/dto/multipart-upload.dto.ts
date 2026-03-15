import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Init upload ────────────────────────────────────────────────────────────────

const InitUploadSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
});

export class InitUploadDto extends createZodDto(InitUploadSchema) {}

// ── Complete upload ────────────────────────────────────────────────────────────

const PartSchema = z.object({
  partNumber: z.number().int().positive(),
  eTag: z.string(),
});

const CompleteUploadSchema = z.object({
  parts: z.array(PartSchema).min(1),
});

export class CompleteUploadDto extends createZodDto(CompleteUploadSchema) {}

// ── Record part ────────────────────────────────────────────────────────────────

const RecordPartSchema = z.object({
  partNumber: z.number().int().positive(),
  eTag: z.string(),
  size: z.number().int().nonnegative(),
});

export class RecordPartDto extends createZodDto(RecordPartSchema) {}

// ── Part URL query ─────────────────────────────────────────────────────────────

const PartUrlQuerySchema = z.object({
  partNumber: z.coerce.number().int().positive(),
});

export class PartUrlQueryDto extends createZodDto(PartUrlQuerySchema) {}
