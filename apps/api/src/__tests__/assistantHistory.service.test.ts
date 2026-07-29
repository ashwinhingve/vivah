/**
 * assistantHistory service unit tests — title/preview derivation, ownership
 * filters, and the rule-11 mock-mode guard, with the Mongoose model mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFind, mockFindOne, mockDeleteOne, envState } = vi.hoisted(() => ({
  mockFind:      vi.fn(),
  mockFindOne:   vi.fn(),
  mockDeleteOne: vi.fn(),
  envState:      { shouldUseMockMongo: false },
}));

vi.mock('../lib/env.js', () => ({
  env: { MONGODB_DB: 'smartshaadiDB' },
  get shouldUseMockMongo() {
    return envState.shouldUseMockMongo;
  },
}));

vi.mock('../infrastructure/mongo/models/AssistantConversation.js', () => ({
  getAssistantConversationModel: () => ({
    find: mockFind,
    findOne: mockFindOne,
    deleteOne: mockDeleteOne,
  }),
}));

import {
  listAssistantConversations,
  getAssistantConversation,
  deleteAssistantConversation,
} from '../services/assistantHistory.js';

const DOC = {
  conversation_id: 'c-1',
  user_id: 'u-1',
  profile_id: 'p-1',
  messages: [
    { role: 'user', content: 'How much does the Premium plan cost per month right now, and what does it include exactly?', ts: new Date('2026-07-29T09:00:00Z') },
    { role: 'assistant', content: 'Premium is ₹999/month…', ts: new Date('2026-07-29T09:00:05Z') },
  ],
  created_at: new Date('2026-07-29T09:00:00Z'),
  updated_at: new Date('2026-07-29T09:00:05Z'),
};

function leanChain(result: unknown) {
  return {
    sort: () => ({ limit: () => ({ lean: () => Promise.resolve(result) }) }),
    lean: () => Promise.resolve(result),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  envState.shouldUseMockMongo = false;
});

describe('listAssistantConversations', () => {
  it('derives a truncated title from the first user message', async () => {
    mockFind.mockReturnValueOnce(leanChain([DOC]));

    const list = await listAssistantConversations('u-1');

    expect(mockFind).toHaveBeenCalledWith({ user_id: 'u-1' });
    expect(list).toHaveLength(1);
    expect(list[0]!.title.length).toBeLessThanOrEqual(61); // 60 + ellipsis
    expect(list[0]!.title.endsWith('…')).toBe(true);
    expect(list[0]!.preview).toContain('Premium is');
    expect(list[0]!.message_count).toBe(2);
  });

  it('returns [] in mock mode without touching the model (rule 11)', async () => {
    envState.shouldUseMockMongo = true;
    const list = await listAssistantConversations('u-1');
    expect(list).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe('getAssistantConversation', () => {
  it('filters by BOTH conversation_id and user_id (ownership)', async () => {
    mockFindOne.mockReturnValueOnce(leanChain(DOC));

    const detail = await getAssistantConversation('u-1', 'c-1');

    expect(mockFindOne).toHaveBeenCalledWith({ conversation_id: 'c-1', user_id: 'u-1' });
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages[0]?.role).toBe('user');
  });

  it('returns null when the doc belongs to someone else', async () => {
    mockFindOne.mockReturnValueOnce(leanChain(null));
    const detail = await getAssistantConversation('intruder', 'c-1');
    expect(detail).toBeNull();
  });
});

describe('deleteAssistantConversation', () => {
  it('deletes with the ownership filter and reports success', async () => {
    mockDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const deleted = await deleteAssistantConversation('u-1', 'c-1');
    expect(mockDeleteOne).toHaveBeenCalledWith({ conversation_id: 'c-1', user_id: 'u-1' });
    expect(deleted).toBe(true);
  });

  it('reports false when nothing matched', async () => {
    mockDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    expect(await deleteAssistantConversation('u-1', 'missing')).toBe(false);
  });
});
