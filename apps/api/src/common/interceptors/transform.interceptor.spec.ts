import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockExecutionContext = {} as ExecutionContext;

  it('should wrap response data in { data, meta } structure', (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ name: 'test' }),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          data: { name: 'test' },
          meta: { timestamp: expect.any(String) },
        });
        done();
      });
  });

  it('should not re-wrap already wrapped data', (done) => {
    const alreadyWrapped = { data: { name: 'test' }, meta: { custom: true } };
    const mockCallHandler: CallHandler = {
      handle: () => of(alreadyWrapped),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual(alreadyWrapped);
        done();
      });
  });

  it('should wrap null data', (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          data: null,
          meta: { timestamp: expect.any(String) },
        });
        done();
      });
  });
});
