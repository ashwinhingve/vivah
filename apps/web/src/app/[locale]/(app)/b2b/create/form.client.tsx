'use client';

/**
 * B2B Account Creation Form (Client Component)
 *
 * Handles GSTIN validation and form submission.
 * Phase 5 Sprint A: Form built but submission disabled (API unmounted).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface B2BAccountFormProps {
  locale: string;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function B2BAccountFormClient(_props: B2BAccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    legalName: '',
    gstin: '',
    hsnSac: '',
    billingAddress: '',
    contactEmail: '',
    contactPhone: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateGstin = (gstin: string): boolean => {
    return GSTIN_REGEX.test(gstin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate GSTIN format
    if (!validateGstin(formData.gstin)) {
      setError('Invalid GSTIN format. Expected: 15 characters (e.g., 27AABFT5055K1Z0)');
      return;
    }

    // Validate required fields
    if (!formData.legalName.trim()) {
      setError('Legal name is required');
      return;
    }

    setIsLoading(true);

    try {
      // Phase 2: Enable API call
      // const response = await mutateApi('/api/v1/b2b/accounts', {
      //   method: 'POST',
      //   body: formData,
      // });
      //
      // if (response.error) {
      //   setError(response.error.message);
      //   return;
      // }
      //
      // router.push(`/${locale}/b2b/${response.ok.account.id}`);

      // Phase 5 Sprint A: Mock success
      console.log('Form data (would send to API):', formData);
      setError('API endpoint not yet mounted. This feature launches in Phase 2.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div>
        <Label htmlFor="legalName" className="text-sm font-semibold text-primary">
          Legal Business Name *
        </Label>
        <Input
          id="legalName"
          name="legalName"
          type="text"
          placeholder="ABC Events Ltd"
          value={formData.legalName}
          onChange={handleChange}
          required
          className="mt-2"
        />
        <p className="mt-1 text-xs text-gold-muted">
          Full registered name of your business
        </p>
      </div>

      <div>
        <Label htmlFor="gstin" className="text-sm font-semibold text-primary">
          GSTIN (15 digits) *
        </Label>
        <Input
          id="gstin"
          name="gstin"
          type="text"
          placeholder="27AABFT5055K1Z0"
          value={formData.gstin}
          onChange={handleChange}
          required
          maxLength={15}
          className="mt-2 font-mono"
        />
        <p className="mt-1 text-xs text-gold-muted">
          Goods and Services Tax Identification Number (GSTIN)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="hsnSac" className="text-sm font-semibold text-primary">
            HSN/SAC Code
          </Label>
          <Input
            id="hsnSac"
            name="hsnSac"
            type="text"
            placeholder="999596"
            value={formData.hsnSac}
            onChange={handleChange}
            maxLength={20}
            className="mt-2"
          />
          <p className="mt-1 text-xs text-gold-muted">Optional default for invoices</p>
        </div>

        <div>
          <Label htmlFor="contactEmail" className="text-sm font-semibold text-primary">
            Contact Email
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            placeholder="contact@abc.com"
            value={formData.contactEmail}
            onChange={handleChange}
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="contactPhone" className="text-sm font-semibold text-primary">
          Contact Phone
        </Label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          placeholder="+919876543210"
          value={formData.contactPhone}
          onChange={handleChange}
          maxLength={20}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="billingAddress" className="text-sm font-semibold text-primary">
          Billing Address
        </Label>
        <textarea
          id="billingAddress"
          name="billingAddress"
          placeholder="123 Main Street, City, State, Postal Code"
          value={formData.billingAddress}
          onChange={handleChange}
          rows={4}
          className="mt-2 block w-full rounded-lg border border-gold bg-white px-3 py-2 text-sm text-ink placeholder:text-gold-muted"
        />
        <p className="mt-1 text-xs text-gold-muted">Full billing address for invoices</p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Creating...' : 'Create Account'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // router.back() or navigate to list
          }}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-gold-muted">
        * Required fields. Your business will be verified within 24 hours.
      </p>
    </form>
  );
}
