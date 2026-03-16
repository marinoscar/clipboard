import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow an admin user', () => {
    const ctx = makeContext({ id: 'user-1', isAdmin: true, isActive: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException for a non-admin user', () => {
    const ctx = makeContext({ id: 'user-2', isAdmin: false, isActive: true });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is undefined', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is null', () => {
    const ctx = makeContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when isAdmin is missing', () => {
    const ctx = makeContext({ id: 'user-3' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should include "Admin access required" in the error message', () => {
    const ctx = makeContext({ id: 'user-4', isAdmin: false });
    expect(() => guard.canActivate(ctx)).toThrow('Admin access required');
  });
});
