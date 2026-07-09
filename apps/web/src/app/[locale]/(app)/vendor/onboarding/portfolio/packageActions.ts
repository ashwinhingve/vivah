'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export interface PackageInput {
  name: string;
  price: number;
  priceUnit: string;
  inclusions?: string[];
}

type Result = { ok: true } | { ok: false; error: string };

function validate(input: PackageInput): string | null {
  if (!input.name.trim()) return 'Package name is required.';
  if (!Number.isFinite(input.price) || input.price < 0) return 'Enter a valid price.';
  return null;
}

export async function addPackageAction(vendorId: string, input: PackageInput): Promise<Result> {
  const v = validate(input);
  if (v) return { ok: false, error: v };
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/packages`, { method: 'POST', body: input });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not add the package.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}

export async function updatePackageAction(vendorId: string, idx: number, input: PackageInput): Promise<Result> {
  const v = validate(input);
  if (v) return { ok: false, error: v };
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/packages/${idx}`, { method: 'PUT', body: input });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not update the package.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}

export async function removePackageAction(vendorId: string, idx: number): Promise<Result> {
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/packages/${idx}`, { method: 'DELETE' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not remove the package.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}
