import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

const lookupMock = vi.fn();
vi.mock('node:dns/promises', () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { fetchLinkPreview, isSafeFetchHost, resolveAndValidateHost } from '../linkPreview.js';

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

// DNS-rebinding defence: hostname passes the regex blocklist but resolves
// to an internal IP — must be rejected before fetch().
describe('resolveAndValidateHost (DNS rebinding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when hostname resolves to RFC-1918 (10.x)', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    expect(await resolveAndValidateHost('attacker.example')).toBe(false);
  });

  it('rejects when hostname resolves to AWS metadata IP', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    expect(await resolveAndValidateHost('rebind.example')).toBe(false);
  });

  it('rejects when ANY of multiple A records is private', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '192.168.1.1', family: 4 },
    ]);
    expect(await resolveAndValidateHost('mixed.example')).toBe(false);
  });

  it('rejects literal 0.0.0.0 without DNS lookup', async () => {
    expect(await resolveAndValidateHost('0.0.0.0')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects literal 127.0.0.1 without DNS lookup', async () => {
    expect(await resolveAndValidateHost('127.0.0.1')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects IPv6 loopback ::1 without DNS lookup', async () => {
    expect(await resolveAndValidateHost('::1')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects IPv6 link-local fe80:: without DNS lookup', async () => {
    expect(await resolveAndValidateHost('fe80::1')).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects IPv4-mapped IPv6 of loopback', async () => {
    // ::ffff:127.0.0.1 — ipaddr.js classifies as ipv4Mapped, not unicast.
    expect(await resolveAndValidateHost('::ffff:127.0.0.1')).toBe(false);
  });

  it('allows hostname that resolves only to public IPs', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);
    expect(await resolveAndValidateHost('cloudflare-dns.example')).toBe(true);
  });

  it('rejects when DNS lookup throws (fail-closed)', async () => {
    lookupMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    expect(await resolveAndValidateHost('does-not-exist.example')).toBe(false);
  });

  it('rejects when DNS returns empty result set', async () => {
    lookupMock.mockResolvedValueOnce([]);
    expect(await resolveAndValidateHost('empty.example')).toBe(false);
  });
});

describe('fetchLinkPreview DNS-rebinding integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when public-looking hostname resolves to private IP', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    const result = await fetchLinkPreview('http://attacker.example/x');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proceeds to fetch when hostname resolves to public IP', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    const html = '<html><head><title>Hello</title></head></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    );
    const result = await fetchLinkPreview('http://example.com/page');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Hello');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
