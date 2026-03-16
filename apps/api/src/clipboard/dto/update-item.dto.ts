import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  isFavorite: z.boolean().optional(),
});

export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}
