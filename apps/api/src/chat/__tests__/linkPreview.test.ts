import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

import { fetchLinkPreview, isSafeFetchHost } from '../linkPreview.js';

describe('isSafeFetchHost', () => {
  it('blocks loopback', () => {
    expect(isSafeFetchHost('localhost')).toBe(false);
    expect(isSafeFetchHost('127.0.0.1')).toBe(false);
    expect(isSafeFetchHost('127.10.20.30')).toBe(false);
  });

  it('blocks AWS / GCP cloud metadata endpoint', () => {
    expect(isSafeFetchHost('169.254.169.254')).toBe(false);
    expect(isSafeFetchHost('metadata.google.internal')).toBe(false);
  });

  it('blocks RFC 1918 private ranges', () => {
    expect(isSafeFetchHost('10.0.0.1')).toBe(false);
    expect(isSafeFetchHost('172.16.5.5')).toBe(false);
    expect(isSafeFetchHost('172.31.255.255')).toBe(false);
    expect(isSafeFetchHost('192.168.1.1')).toBe(false);
  });

  it('does NOT block 172.15 / 172.32 (outside RFC 1918 172.16–172.31)', () => {
    expect(isSafeFetchHost('172.15.0.1')).toBe(true);
    expect(isSafeFetchHost('172.32.0.1')).toBe(true);
  });

  it('allows public hosts', () => {
    expect(isSafeFetchHost('example.com')).toBe(true);
    expect(isSafeFetchHost('api.razorpay.com')).toBe(true);
    expect(isSafeFetchHost('1.1.1.1')).toBe(true);
  });
});

describe('fetchLinkPreview SSRF guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without fetching when host is loopback', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    const result = await fetchLinkPreview('http://127.0.0.1/admin');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null without fetching when host is cloud metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    const result = await fetchLinkPreview('http://169.254.169.254/latest/meta-data/');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null without fetching when protocol is not http(s)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    const result = await fetchLinkPreview('file:///etc/passwd');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
