/**
 * knowledgeIndexer pure-function tests — chunking and hashing. The DB/embedding
 * pipeline is exercised end-to-end by the reindex CLI against a live stack.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/env.js', () => ({
  env: { USE_MOCK_SERVICES: true, AI_SERVICE_URL: 'http://localhost:8000', AI_SERVICE_INTERNAL_KEY: 'k' },
  shouldUseMockMongo: true,
}));
vi.mock('../lib/db.js', () => ({ db: {} }));

import { chunkBody, hashContent } from '../services/knowledgeIndexer.js';

describe('chunkBody', () => {
  it('keeps a short body as a single chunk', () => {
    expect(chunkBody('Hello world.\nSecond line.')).toEqual(['Hello world.\nSecond line.']);
  });

  it('splits on paragraph boundaries near the target size', () => {
    const para = 'x'.repeat(800);
    const chunks = chunkBody([para, para, para].join('\n\n'), 1800);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${para}\n${para}`);
    expect(chunks[1]).toBe(para);
  });

  it('hard-splits a single paragraph longer than the target', () => {
    const chunks = chunkBody('y'.repeat(4000), 1800);
    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe('y'.repeat(4000));
  });

  it('drops empty/whitespace-only paragraphs', () => {
    expect(chunkBody('a\n\n   \n\nb')).toEqual(['a\nb']);
  });
});

describe('hashContent', () => {
  it('is deterministic and content-sensitive', () => {
    expect(hashContent('same')).toBe(hashContent('same'));
    expect(hashContent('same')).not.toBe(hashContent('different'));
    expect(hashContent('x')).toMatch(/^[a-f0-9]{64}$/);
  });
});
