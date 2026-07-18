/**
 * Smart Shaadi — Marketing Content Tests (Unit 6.4)
 *
 * Test suite for content generation, approval, and upsert functions.
 * Uses real database with proper fixture setup/teardown.
 *
 * Mutation check: Remove the fallback branch in workerGenerateContent
 * and verify the fallback test fails (then restore).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { marketingCampaigns, campaignContent, user } from '@smartshaadi/db';
import type { GeneratedCampaignContent } from '@smartshaadi/types';
import * as contentModule from '../content';
import * as templatesModule from '../templates';
import * as aiModule from '../../lib/ai';

// Mock modules
vi.mock('../../lib/ai');
vi.mock('../../infrastructure/redis/queues', () => ({
  marketingContentGenerateQueue: {
    add: vi.fn(),
  },
}));

describe('Marketing Content Service', () => {
  let campaignId: string;
  let adminUserId: string;
  const TEST_USER_ID = 'test-marketing-admin-' + Date.now();

  beforeEach(async () => {
    // Create a test user (prerequisite for FK constraints)
    // Delete first to ensure clean state
    await db.delete(user).where(eq(user.id, TEST_USER_ID));

    // Now insert the fresh user (phone needs to be unique per test)
    const timestamp = Date.now();
    await db.insert(user).values({
      id: TEST_USER_ID,
      name: 'Test Admin',
      email: `admin-${timestamp}@test.local`,
      phoneNumber: `+9199${timestamp.toString().slice(-8)}`,
      emailVerified: false,
      phoneNumberVerified: false,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a test campaign
    const now = new Date();
    const campaign = await db
      .insert(marketingCampaigns)
      .values({
        name: 'Test Campaign',
        description: 'A test campaign for content generation',
        triggerType: 'EVENT' as const,
        segmentKey: 'new_incomplete_48h',
        channelSet: ['email', 'sms'] as const,
        status: 'DRAFT' as const,
        templateKey: 'welcome_series',
        eventHookKey: 'user_registered' as const,
        frequencyCapPerWeek: 2,
        conversionGoal: 'PROFILE_COMPLETED' as const,
        attributionWindowDays: 14,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    campaignId = campaign[0]?.id || '';
    adminUserId = TEST_USER_ID;
  });

  afterEach(async () => {
    // Clean up test data (order matters: content before campaigns)
    await db.delete(campaignContent).where(eq(campaignContent.campaignId, campaignId));
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, campaignId));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  describe('requestGeneration', () => {
    it('should enqueue a generation job successfully', async () => {
      const result = await contentModule.requestGeneration(campaignId, 'Optional brief');
      expect(result.queued).toBe(true);
      expect(result.jobId).toContain('mkt-content-');
    });

    it('should throw 404 if campaign not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(contentModule.requestGeneration(fakeId)).rejects.toThrow('not found');
    });
  });

  describe('approveContent', () => {
    let contentId: string;

    beforeEach(async () => {
      // Create a DRAFT content row
      const now = new Date();
      const content = await db
        .insert(campaignContent)
        .values({
          campaignId,
          templateKey: 'welcome_series',
          language: 'en',
          status: 'DRAFT' as const,
          subjectLine: 'Test Subject',
          bodyShort: 'Test body',
          generatedByLlm: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      contentId = content[0]?.id || '';
    });

    afterEach(async () => {
      // Clean up content row created in beforeEach
      if (contentId) {
        await db.delete(campaignContent).where(eq(campaignContent.id, contentId));
      }
    });

    it('should approve a DRAFT content row to APPROVED', async () => {
      const approved = await contentModule.approveContent(contentId, adminUserId);
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedByUserId).toBe(adminUserId);
      expect(approved.approvedAt).toBeTruthy();
    });

    it('should throw conflict error if content is not DRAFT', async () => {
      // Already approve it
      await contentModule.approveContent(contentId, adminUserId);

      // Try to approve again
      await expect(contentModule.approveContent(contentId, adminUserId)).rejects.toThrow(
        'not in DRAFT status',
      );
    });

    it('should throw 404 if content not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(contentModule.approveContent(fakeId, adminUserId)).rejects.toThrow('not found');
    });
  });

  describe('upsertManualContent', () => {
    it('should insert a new manual content row', async () => {
      const content = await contentModule.upsertManualContent(campaignId, 'en', {
        subjectLine: 'Manual Subject',
        bodyShort: 'Manual body',
        bodyLong: 'Long version',
        ctaText: 'Click Here',
      });

      expect(content.campaignId).toBe(campaignId);
      expect(content.language).toBe('en');
      expect(content.status).toBe('DRAFT');
      expect(content.generatedByLlm).toBe(false);
      expect(content.subjectLine).toBe('Manual Subject');
    });

    it('should update existing content row', async () => {
      const now = new Date();
      const initial = await db
        .insert(campaignContent)
        .values({
          campaignId,
          templateKey: 'welcome_series',
          language: 'en',
          status: 'DRAFT',
          subjectLine: 'Old Subject',
          bodyShort: 'Old body',
          generatedByLlm: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const updated = await contentModule.upsertManualContent(campaignId, 'en', {
        subjectLine: 'New Subject',
        bodyShort: 'New body',
      });

      expect(updated.id).toBe(initial[0]?.id);
      expect(updated.subjectLine).toBe('New Subject');
      expect(updated.bodyShort).toBe('New body');
    });
  });

  describe('listContent', () => {
    it('should list all content rows for a campaign', async () => {
      const now = new Date();
      await db
        .insert(campaignContent)
        .values([
          {
            campaignId,
            templateKey: 'welcome_series',
            language: 'en',
            status: 'DRAFT',
            bodyShort: 'EN body',
            generatedByLlm: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            campaignId,
            templateKey: 'welcome_series',
            language: 'hi',
            status: 'APPROVED',
            bodyShort: 'HI body',
            generatedByLlm: true,
            createdAt: now,
            updatedAt: now,
          },
        ]);

      const rows = await contentModule.listContent(campaignId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.language)).toContain('en');
      expect(rows.map((r) => r.language)).toContain('hi');
    });
  });

  describe('workerGenerateContent', () => {
    it('should generate en+hi DRAFT content via LLM', async () => {
      const mockGenerated: GeneratedCampaignContent = {
        en: {
          subjectLine: 'Welcome!',
          bodyShort: 'Join us',
          bodyLong: 'Welcome to Smart Shaadi',
          ctaText: 'Start Now',
        },
        hi: {
          subjectLine: 'स्वागत है!',
          bodyShort: 'हमसे जुड़ें',
          bodyLong: 'स्मार्ट शादी में स्वागत',
          ctaText: 'अभी शुरू करें',
        },
        modelVersion: 'claude-sonnet-4-6',
      };

      vi.mocked(aiModule.callAiService).mockResolvedValueOnce(mockGenerated);

      const result = await contentModule.workerGenerateContent(campaignId);

      expect(result.source).toBe('llm');
      expect(result.enId).toBeTruthy();
      expect(result.hiId).toBeTruthy();

      // Verify rows were created with LLM metadata
      const [enRow] = await db
        .select()
        .from(campaignContent)
        .where(eq(campaignContent.id, result.enId))
        .limit(1);
      expect(enRow?.generatedByLlm).toBe(true);
      expect(enRow?.modelVersion).toBe('claude-sonnet-4-6');
    });

    it('should fall back to templates when LLM fails', async () => {
      vi.mocked(aiModule.callAiService).mockRejectedValueOnce(
        new Error('LLM service unavailable'),
      );

      const result = await contentModule.workerGenerateContent(campaignId);

      expect(result.source).toBe('fallback');
      expect(result.enId).toBeTruthy();
      expect(result.hiId).toBeTruthy();

      // Verify rows use fallback template with fallback flag
      const [enRow] = await db
        .select()
        .from(campaignContent)
        .where(eq(campaignContent.id, result.enId))
        .limit(1);
      expect(enRow?.generatedByLlm).toBe(false);
      expect(enRow?.modelVersion).toBe('fallback-v1');
      expect(enRow?.bodyShort).toBeTruthy(); // from fallback template
    });

    it('should throw if campaign not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(contentModule.workerGenerateContent(fakeId)).rejects.toThrow('not found');
    });
  });

  describe('Fallback Templates', () => {
    it('should have all required template keys', () => {
      const keys = Object.keys(templatesModule.FALLBACK_TEMPLATES);
      expect(keys).toContain('welcome_series');
      expect(keys).toContain('winback_inactive');
      expect(keys).toContain('seasonal_muhurat');
      expect(keys).toContain('vendor_onboarding');
      expect(keys).toContain('vendor_reactivation');
      expect(keys).toContain('fallback');
    });

    it('each template should have valid en+hi copy', () => {
      Object.entries(templatesModule.FALLBACK_TEMPLATES).forEach(([_key, template]) => {
        expect(template.en).toBeDefined();
        expect(template.hi).toBeDefined();

        // Validate required fields
        expect(template.en.subjectLine).toBeTruthy();
        expect(template.en.bodyShort).toBeTruthy();
        expect(template.en.bodyLong).toBeTruthy();
        expect(template.en.ctaText).toBeTruthy();

        expect(template.hi.subjectLine).toBeTruthy();
        expect(template.hi.bodyShort).toBeTruthy();
        expect(template.hi.bodyLong).toBeTruthy();
        expect(template.hi.ctaText).toBeTruthy();

        // Validate Hindi is real Devanagari (contains non-ASCII)
        const hiText = `${template.hi.subjectLine}${template.hi.bodyShort}`;
        const hasDevanagari = /[ऀ-ॿ]/.test(hiText);
        expect(hasDevanagari).toBe(true);
      });
    });
  });
});
