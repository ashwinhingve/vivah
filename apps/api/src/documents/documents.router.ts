/**
 * Smart Shaadi — Documents Router
 *
 * UNMOUNTED — Phase 2 will mount this at /api/v1/documents.
 * For Phase 5 Sprint C, verified via unit tests only.
 *
 * Routes:
 * POST   /documents              → createContract    (auth)
 * GET    /documents              → listContracts     (auth)
 * GET    /documents/:id          → getContract       (auth)
 * POST   /documents/:id/send     → sendForSignature  (auth)
 * POST   /documents/:id/sign     → completeSignature (auth, mock only)
 * GET    /documents/:id/pdf      → downloadPdf       (auth)
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  createContract,
  listContracts,
  getContract,
  sendForSignature,
  completeSignature,
  generateContractSummaryPdf,
  DocumentsError,
} from './documents.service.js';

export const documentsRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID_STATE: 422,
  INVALID_TEMPLATE: 400,
  VALIDATION_ERROR: 400,
  NOT_CONFIGURED: 501,
};

function handleDocumentsError(res: Response, e: unknown): void {
  if (e instanceof DocumentsError) {
    const status = STATUS_BY_CODE[e.code] ?? 400;
    err(res, e.code, e.message, status);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── Create Contract ──────────────────────────────────────────────────────────

const CreateContractSchema = z.object({
  templateId: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  data: z.object({
    party1: z.object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      gstinOrPan: z.string().optional(),
    }),
    party2: z.object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      gstinOrPan: z.string().optional(),
    }),
    effectiveDate: z.string().date(),
    expiryDate: z.string().date().optional(),
    amount: z.number().positive().optional(),
    terms: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    specialTerms: z.record(z.string()).optional(),
  }),
});

documentsRouter.post('/', authenticate, async (req, res) => {
  const parsed = CreateContractSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const contract = await createContract(profileId, parsed.data);
    ok(res, { contract }, 201);
  } catch (e) {
    handleDocumentsError(res, e);
  }
});

// ── List Contracts ──────────────────────────────────────────────────────────

documentsRouter.get('/', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const contracts = await listContracts(profileId);
    ok(res, { contracts });
  } catch (e) {
    handleDocumentsError(res, e);
  }
});

// ── Get Single Contract ──────────────────────────────────────────────────────

documentsRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const id = req.params.id;
    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Contract id is required', 400);
      return;
    }
    const contract = await getContract(profileId, id);
    if (!contract) {
      err(res, 'NOT_FOUND', 'Contract not found', 404);
      return;
    }

    ok(res, { contract });
  } catch (e) {
    handleDocumentsError(res, e);
  }
});

// ── Send for Signature ───────────────────────────────────────────────────────

const SendContractSchema = z.object({
  provider: z.enum(['DIGILOCKER', 'SIGNZY']),
});

documentsRouter.post('/:id/send', authenticate, async (req, res) => {
  const parsed = SendContractSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const id = req.params.id;
    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Contract id is required', 400);
      return;
    }
    const result = await sendForSignature(profileId, id, parsed.data.provider);
    ok(res, result, 200);
  } catch (e) {
    handleDocumentsError(res, e);
  }
});

// ── Complete Signature (Mock Callback) ───────────────────────────────────────

documentsRouter.post('/:id/sign', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const id = req.params.id;
    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Contract id is required', 400);
      return;
    }
    const result = await completeSignature(profileId, id);
    ok(res, result, 200);
  } catch (e) {
    handleDocumentsError(res, e);
  }
});

// ── Download PDF ─────────────────────────────────────────────────────────────

documentsRouter.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const id = req.params.id;
    if (!id) {
      err(res, 'VALIDATION_ERROR', 'Contract id is required', 400);
      return;
    }
    const contract = await getContract(profileId, id);
    if (!contract) {
      err(res, 'NOT_FOUND', 'Contract not found', 404);
      return;
    }

    // Render a real branded summary PDF from stored metadata (Rs.-safe generator).
    // Full original-agreement re-rendering needs ContractData persistence (future
    // migration); the contract row alone drives this status/audit summary.
    const pdfBuffer = await generateContractSummaryPdf(contract);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${contract.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (e) {
    handleDocumentsError(res, e);
  }
});
