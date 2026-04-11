import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: vi.fn(),
  DetectFacesCommand: vi.fn(),
  Attribute: { ALL: 'ALL' },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { S3Client } from '@aws-sdk/client-s3';
import { analyzePhoto } from '../rekognition.js';

const mockSend = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockSend }));
  (RekognitionClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockSend }));
});

// Real-path tests: temporarily disable mock mode so the AWS code path executes.
describe('analyzePhoto (real path — USE_MOCK_SERVICES=false)', () => {
  beforeEach(() => { process.env['USE_MOCK_SERVICES'] = 'false'; });
  afterEach(() => { process.env['USE_MOCK_SERVICES'] = 'true'; });

  it('returns isRealPerson=true for one high-confidence face', async () => {
    mockSend
      .mockResolvedValueOnce({ // R2 GetObject
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      })
      .mockResolvedValueOnce({ // Rekognition DetectFaces
        FaceDetails: [{ Confidence: 99.5, Sunglasses: { Value: false, Confidence: 95 } }],
      });

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.isRealPerson).toBe(true);
    expect(result.confidenceScore).toBe(99.5);
    expect(result.hasSunglasses).toBe(false);
    expect(result.multipleFaces).toBe(false);
    expect(result.analyzedAt).toMatch(/^\d{4}-/);
  });

  it('returns isRealPerson=false when no face detected', async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      })
      .mockResolvedValueOnce({ FaceDetails: [] });

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.isRealPerson).toBe(false);
    expect(result.confidenceScore).toBe(0);
  });

  it('flags multipleFaces when more than one face detected', async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      })
      .mockResolvedValueOnce({
        FaceDetails: [
          { Confidence: 98, Sunglasses: { Value: false, Confidence: 90 } },
          { Confidence: 95, Sunglasses: { Value: false, Confidence: 90 } },
        ],
      });

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.multipleFaces).toBe(true);
    expect(result.isRealPerson).toBe(true);
  });

  it('flags hasSunglasses when Rekognition confidence > 80', async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      })
      .mockResolvedValueOnce({
        FaceDetails: [{ Confidence: 97, Sunglasses: { Value: true, Confidence: 92 } }],
      });

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.hasSunglasses).toBe(true);
  });

  it('throws if R2 body is missing', async () => {
    mockSend.mockResolvedValueOnce({ Body: null });

    await expect(analyzePhoto('profiles/test/photo.jpg'))
      .rejects.toThrow('Empty body for R2 key');
  });
});

// USE_MOCK_SERVICES=true is set in vitest.setup.ts — env is resolved at module
// load time, so the mock path is active for every test in this file.
describe('analyzePhoto (mock mode — USE_MOCK_SERVICES=true)', () => {
  it('returns mock data without calling S3 or Rekognition', async () => {
    const result = await analyzePhoto('any/key.jpg');
    expect(result.isRealPerson).toBe(true);
    expect(result.confidenceScore).toBe(99);
    expect(result.hasSunglasses).toBe(false);
    expect(result.multipleFaces).toBe(false);
    expect(result.analyzedAt).toMatch(/^\d{4}-/);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
