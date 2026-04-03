import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddUserSchema = z.object({
  email: z.string().email().max(255),
});

export class AddUserDto extends createZodDto(AddUserSchema) {}
