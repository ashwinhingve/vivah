'use client';

/**
 * B2B Account Creation Form (Client Component)
 *
 * Handles GSTIN validation and form submission.
 * Phase 5 Sprint A: Form built but submission disabled (API unmounted).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';

interface B2BAccountFormProps {
  locale: string;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function B2BAccountFormClient({ locale }: B2BAccountFormProps) {
  const t = useTranslations('b2b.create');
  const router = useRouter();
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
      setError(t('gstinErrorFormat'));
      return;
    }

    // Validate required fields
    if (!formData.legalName.trim()) {
      setError(t('legalNameRequired'));
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
      // router.push(`/b2b/${response.ok.account.id}`);

      // Phase 5 Sprint A: Mock success
      console.log('Form data (would send to API):', formData);
      setError(t('apiNotMounted'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('apiNotMounted'));
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
          {t('legalNameLabel')}
          <span className="text-destructive"> {t('requiredLabel')}</span>
        </Label>
        <Input
          id="legalName"
          name="legalName"
          type="text"
          placeholder={t('legalNamePlaceholder')}
          value={formData.legalName}
          onChange={handleChange}
          required
          className="mt-2"
        />
        <p className="mt-1 text-xs text-gold-muted">
          {t('legalNameHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="gstin" className="text-sm font-semibold text-primary">
          {t('gstinLabel')}
          <span className="text-destructive"> {t('requiredLabel')}</span>
        </Label>
        <Input
          id="gstin"
          name="gstin"
          type="text"
          placeholder={t('gstinPlaceholder')}
          value={formData.gstin}
          onChange={handleChange}
          required
          maxLength={15}
          className="mt-2 font-mono"
        />
        <p className="mt-1 text-xs text-gold-muted">
          {t('gstinHint')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="hsnSac" className="text-sm font-semibold text-primary">
            {t('hsnSacLabel')}
          </Label>
          <Input
            id="hsnSac"
            name="hsnSac"
            type="text"
            placeholder={t('hsnSacPlaceholder')}
            value={formData.hsnSac}
            onChange={handleChange}
            maxLength={20}
            className="mt-2"
          />
          <p className="mt-1 text-xs text-gold-muted">{t('hsnSacHint')}</p>
        </div>

        <div>
          <Label htmlFor="contactEmail" className="text-sm font-semibold text-primary">
            {t('contactEmailLabel')}
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            placeholder={t('contactEmailPlaceholder')}
            value={formData.contactEmail}
            onChange={handleChange}
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="contactPhone" className="text-sm font-semibold text-primary">
          {t('contactPhoneLabel')}
        </Label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          placeholder={t('contactPhonePlaceholder')}
          value={formData.contactPhone}
          onChange={handleChange}
          maxLength={20}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="billingAddress" className="text-sm font-semibold text-primary">
          {t('billingAddressLabel')}
        </Label>
        <textarea
          id="billingAddress"
          name="billingAddress"
          placeholder={t('billingAddressPlaceholder')}
          value={formData.billingAddress}
          onChange={handleChange}
          rows={4}
          className="mt-2 block w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"
        />
        <p className="mt-1 text-xs text-gold-muted">{t('billingAddressHint')}</p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading} className="flex-1" loading={isLoading}>
          {t('submitButton')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          {t('cancelButton')}
        </Button>
      </div>

      <p className="text-xs text-gold-muted">
        {t('requiredNote')}
      </p>
    </form>
  );
}
