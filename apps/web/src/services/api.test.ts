import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, ApiError } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setAccessToken(null);
  });

  describe('request methods', () => {
    it('should make GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: 1 } }),
      });

      const result = await api.get('/test');
      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: 1 } }),
      });

      await api.post('/test', { name: 'test' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ name: 'test' }));
    });

    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await api.delete('/test/1');
      expect(result).toBeUndefined();
    });
  });

  describe('authentication', () => {
    it('should include Authorization header when token is set', async () => {
      api.setAccessToken('my-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await api.get('/test');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer my-token');
    });

    it('should not include Authorization header with skipAuth', async () => {
      api.setAccessToken('my-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await api.get('/test', { skipAuth: true });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('should include credentials for cookies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await api.get('/test');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not found', code: 'NOT_FOUND' }),
      });

      await expect(api.get('/test')).rejects.toThrow(ApiError);
      await expect(api.get('/test')).rejects.toThrow(); // re-fetch for assertion
    });

    it('should attempt token refresh on 401', async () => {
      api.setAccessToken('expired-token');

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { accessToken: 'new-token' } }),
      });

      // Retry call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { result: 'success' } }),
      });

      const result = await api.get('/test');
      expect(result).toEqual({ result: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw Unauthorized if refresh fails', async () => {
      api.setAccessToken('expired-token');

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      await expect(api.get('/test')).rejects.toThrow(ApiError);
    });
  });

  describe('data unwrapping', () => {
    it('should unwrap { data: ... } response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { name: 'test' } }),
      });

      const result = await api.get('/test');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return raw data if no data wrapper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ name: 'test' }),
      });

      const result = await api.get('/test');
      expect(result).toEqual({ name: 'test' });
    });
  });
});
