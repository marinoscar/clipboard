import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTextItemSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(1_000_000),
});

export class CreateTextItemDto extends createZodDto(CreateTextItemSchema) {}
