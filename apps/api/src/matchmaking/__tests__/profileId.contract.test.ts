/**
 * ProfileId branding — compile-time contract.
 *
 * This file's value is in TYPE-CHECKING, not runtime: the `@ts-expect-error`
 * directives below FAIL the build if the `ProfileId` brand ever stops
 * rejecting a raw `string` (i.e. a Better Auth userId). It is the structural
 * guard behind CLAUDE.md Rule 12 — the userId→profileId bug is now a compile
 * error, and this test ensures it stays one.
 */
import { describe, it, expect } from 'vitest';
import { asProfileId } from '@smartshaadi/types';
import { sendRequest, blockUser } from '../requests/service.js';
import { addShortlist } from '../shortlists/service.js';

// Never executed — present only so `tsc` type-checks the bodies.
async function _profileIdTypeContract(): Promise<void> {
  const sender = asProfileId('11111111-1111-1111-1111-111111111111');
  const receiver = asProfileId('22222222-2222-2222-2222-222222222222');

  // A resolved ProfileId is accepted.
  await sendRequest(sender, receiver);
  await blockUser(sender, receiver);
  await addShortlist(sender, receiver);

  // A raw string (the shape of a Better Auth userId) must NOT compile.
  // @ts-expect-error raw string is not assignable to ProfileId
  await sendRequest('raw-user-id', receiver);
  // @ts-expect-error raw string is not assignable to ProfileId
  await blockUser(sender, 'raw-user-id');
  // @ts-expect-error raw string is not assignable to ProfileId
  await addShortlist('raw-user-id', receiver);
}
void _profileIdTypeContract;

describe('ProfileId branding contract', () => {
  it('asProfileId produces a value usable as a string', () => {
    expect(asProfileId('abc')).toBe('abc');
  });
});
