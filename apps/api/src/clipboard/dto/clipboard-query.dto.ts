import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ClipboardQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  type: z.enum(['text', 'image', 'file', 'media']).optional(),
  status: z.enum(['active', 'archived', 'deleted']).default('active'),
  search: z.string().optional(),
  isFavorite: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .pipe(z.boolean().optional())
    .optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'fileName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class ClipboardQueryDto extends createZodDto(ClipboardQuerySchema) {}
