import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const BatchOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['archive', 'restore', 'delete']),
});

export class BatchOperationDto extends createZodDto(BatchOperationSchema) {}
