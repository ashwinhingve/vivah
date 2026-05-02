// ─────────────────────────────────────────────────────────────────────────────
// Bank verification — Razorpay/Cashfree penny-drop. Provider deposits ₹1, pulls
// account holder name from response, fuzzy-matches against profile. Refunds
// instantly. We persist only refId + IFSC + last 4 of account.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env.js';
import type { BankVerificationResult } from '@smartshaadi/types';

export interface BankVerifyArgs {
  accountNumber:     string;
  ifsc:              string;
  accountHolderName: string;
}

export async function verifyBank(args: BankVerifyArgs): Promise<BankVerificationResult> {
  if (env.USE_MOCK_SERVICES) {
    // Mock: any non-empty account passes UNLESS account starts with 0000
    const blocked = args.accountNumber.startsWith('0000');
    return {
      verified:     !blocked,
      refId:        blocked ? '' : `MOCK-PENNY-${randomUUID()}`,
      accountLast4: args.accountNumber.slice(-4),
      ifsc:         args.ifsc.toUpperCase(),
    };
  }

  // TODO: Razorpay penny-drop:
  //   POST https://api.razorpay.com/v1/fund_accounts/validations
  //   { account_number, ifsc, contact_name }
  //   - poll status until 'completed' or timeout 30s
  //   - on success, fuzzy-match returned `account_holder_name` vs `accountHolderName`
  //   - reject if name match score < 80
  throw new Error('Real bank provider not yet configured');
}
