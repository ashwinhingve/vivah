'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateProductSchema } from '@smartshaadi/schemas';
import type { CreateProductInput } from '@smartshaadi/schemas';

const CATEGORIES = [
  'Gifts',
  'Trousseau',
  'Ethnic Wear',
  'Pooja',
  'Decor',
  'Stationery',
  'Other',
] as const;

interface ProductFormProps {
  defaultValues?: Partial<CreateProductInput>;
  productId?: string;
  mode: 'create' | 'edit';
}

type FieldErrors = Partial<Record<keyof CreateProductInput, string>>;

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function ProductForm({ defaultValues, productId, mode }: ProductFormProps) {
  const router = useRouter();

  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [category, setCategory] = useState(defaultValues?.category ?? '');
  const [price, setPrice] = useState(defaultValues?.price?.toString() ?? '');
  const [comparePrice, setComparePrice] = useState(
    defaultValues?.comparePrice?.toString() ?? '',
  );
  const [stockQty, setStockQty] = useState(defaultValues?.stockQty?.toString() ?? '0');
  const [sku, setSku] = useState(defaultValues?.sku ?? '');
  const [isFeatured, setIsFeatured] = useState(defaultValues?.isFeatured ?? false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const raw = {
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim(),
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
      stockQty: parseInt(stockQty, 10),
      sku: sku.trim() || undefined,
      isFeatured,
    };

    const result = CreateProductSchema.safeParse(raw);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CreateProductInput;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === 'create'
          ? `${API_URL}/api/v1/store/products`
          : `${API_URL}/api/v1/store/products/${productId}`;

      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result.data),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setServerError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (mode === 'create') {
        router.push('/vendor-dashboard/store');
      } else {
        router.refresh();
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#C5A47E]/30 bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0E7C7B] focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]/40 transition-colors';
  const labelCls = 'block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1';
  const errorCls = 'mt-1 text-xs text-red-600';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="pf-name" className={labelCls}>
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          id="pf-name"
          type="text"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Silk Saree — Bridal Red"
          maxLength={255}
        />
        {fieldErrors.name && <p className={errorCls}>{fieldErrors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="pf-desc" className={labelCls}>
          Description
        </label>
        <textarea
          id="pf-desc"
          className={`${inputCls} resize-none`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your product (optional)"
          maxLength={2000}
        />
        {fieldErrors.description && <p className={errorCls}>{fieldErrors.description}</p>}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="pf-category" className={labelCls}>
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="pf-category"
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {fieldErrors.category && <p className={errorCls}>{fieldErrors.category}</p>}
      </div>

      {/* Price row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-price" className={labelCls}>
            Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            id="pf-price"
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
          {fieldErrors.price && <p className={errorCls}>{fieldErrors.price}</p>}
        </div>
        <div>
          <label htmlFor="pf-compare-price" className={labelCls}>
            Compare Price (₹)
          </label>
          <input
            id="pf-compare-price"
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value)}
            placeholder="Original price (optional)"
          />
          {fieldErrors.comparePrice && <p className={errorCls}>{fieldErrors.comparePrice}</p>}
        </div>
      </div>

      {/* Stock & SKU */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-stock" className={labelCls}>
            Stock Qty <span className="text-red-500">*</span>
          </label>
          <input
            id="pf-stock"
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            placeholder="0"
          />
          {fieldErrors.stockQty && <p className={errorCls}>{fieldErrors.stockQty}</p>}
        </div>
        <div>
          <label htmlFor="pf-sku" className={labelCls}>
            SKU
          </label>
          <input
            id="pf-sku"
            type="text"
            className={inputCls}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. SILK-RED-001 (optional)"
            maxLength={100}
          />
          {fieldErrors.sku && <p className={errorCls}>{fieldErrors.sku}</p>}
        </div>
      </div>

      {/* Featured toggle */}
      <div className="flex items-center gap-3">
        <input
          id="pf-featured"
          type="checkbox"
          className="h-4 w-4 rounded border-[#C5A47E]/40 text-[#0E7C7B] focus:ring-[#0E7C7B]/40"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        <label htmlFor="pf-featured" className="text-sm text-[#0F172A] font-medium cursor-pointer">
          Feature this product on the store homepage
        </label>
      </div>

      {/* Image upload — stub */}
      <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-[#FEFAF6] px-4 py-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto mb-2 h-8 w-8 text-[#C5A47E]/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-medium text-[#64748B]">Image upload</p>
        <p className="text-xs text-[#94A3B8] mt-0.5">Coming soon — R2 pre-signed upload</p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0E7C7B]/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? mode === 'create'
            ? 'Creating…'
            : 'Saving…'
          : mode === 'create'
          ? 'Create Product'
          : 'Save Changes'}
      </button>
    </form>
  );
}
