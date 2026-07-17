/**
 * Smart Shaadi — B2B Self-Serve Router
 *
 * UNMOUNTED — Phase 2 will mount this into the API.
 * For Phase 5 Sprint A, verified via unit tests only.
 *
 * Routes:
 * POST   /b2b/accounts              → createB2BAccount   (auth)
 * GET    /b2b/accounts              → listB2BAccounts    (auth)
 * GET    /b2b/accounts/:id          → getB2BAccount      (auth)
 * PATCH  /b2b/accounts/:id          → updateB2BAccount   (auth)
 *
 * POST   /b2b/contracts             → createContract     (auth)
 * GET    /b2b/contracts             → listContracts      (auth)
 * GET    /b2b/contracts/:id         → getContract        (auth)
 * POST   /b2b/contracts/:id/send    → sendContract       (auth)
 *
 * POST   /b2b/accounts/:id/invoices → generateInvoice    (auth)
 */

import { Router, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  CreateB2BAccountSchema,
  UpdateB2BAccountSchema,
  CreateContractSchema,
  SendContractSchema,
} from '@smartshaadi/schemas';
import {
  createB2BAccount,
  getB2BAccount,
  listB2BAccounts,
  updateB2BAccount,
  createContract,
  getContract,
  listContracts,
  sendContract,
  B2BError,
} from './service.js';

export const b2bRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID_STATE: 422,
  VALIDATION_ERROR: 400,
};

function handleB2BError(res: Response, e: unknown): void {
  if (e instanceof B2BError) {
    const status = STATUS_BY_CODE[e.code] ?? 400;
    err(res, e.code, e.message, status);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── B2B Accounts ─────────────────────────────────────────────────────────────

b2bRouter.post('/accounts', authenticate, async (req, res) => {
  const parsed = CreateB2BAccountSchema.safeParse(req.body);
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

    const account = await createB2BAccount(profileId, parsed.data);
    ok(res, { account }, 201);
  } catch (e) {
    handleB2BError(res, e);
  }
});

b2bRouter.get('/accounts', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const accounts = await listB2BAccounts(profileId);
    ok(res, { accounts });
  } catch (e) {
    handleB2BError(res, e);
  }
});

b2bRouter.get('/accounts/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    err(res, 'VALIDATION_ERROR', 'Account ID is required', 400);
    return;
  }

  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const account = await getB2BAccount(profileId, id);
    if (!account) {
      err(res, 'NOT_FOUND', 'B2B account not found', 404);
      return;
    }

    ok(res, { account });
  } catch (e) {
    handleB2BError(res, e);
  }
});

b2bRouter.patch('/accounts/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    err(res, 'VALIDATION_ERROR', 'Account ID is required', 400);
    return;
  }

  const parsed = UpdateB2BAccountSchema.safeParse(req.body);
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

    const account = await updateB2BAccount(profileId, id, parsed.data);
    ok(res, { account });
  } catch (e) {
    handleB2BError(res, e);
  }
});

// ── Contracts ────────────────────────────────────────────────────────────────

b2bRouter.post('/contracts', authenticate, async (req, res) => {
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
    handleB2BError(res, e);
  }
});

b2bRouter.get('/contracts', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const contracts = await listContracts(profileId);
    ok(res, { contracts });
  } catch (e) {
    handleB2BError(res, e);
  }
});

b2bRouter.get('/contracts/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    err(res, 'VALIDATION_ERROR', 'Contract ID is required', 400);
    return;
  }

  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    const contract = await getContract(profileId, id);
    if (!contract) {
      err(res, 'NOT_FOUND', 'Contract not found', 404);
      return;
    }

    ok(res, { contract });
  } catch (e) {
    handleB2BError(res, e);
  }
});

b2bRouter.post('/contracts/:id/send', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    err(res, 'VALIDATION_ERROR', 'Contract ID is required', 400);
    return;
  }

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

    const contract = await sendContract(profileId, id, parsed.data);
    ok(res, { contract });
  } catch (e) {
    handleB2BError(res, e);
  }
});
