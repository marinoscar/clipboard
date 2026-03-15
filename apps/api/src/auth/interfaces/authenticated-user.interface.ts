import { User } from '@prisma/client';

/**
 * User object attached to request after JWT validation
 */
export type AuthenticatedUser = User;

/**
 * Simplified user info for request context
 */
export interface RequestUser {
  id: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
}
