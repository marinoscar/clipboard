import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreatePatSchema = z.object({
  name: z.string().min(1).max(100),
  expiration: z.enum(['1d', '30d', 'never']),
});

export class CreatePatDto extends createZodDto(CreatePatSchema) {}
