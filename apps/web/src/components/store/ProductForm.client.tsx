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
  const [r2Keys, setR2Keys] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadingCount(n => n + files.length);
    try {
      for (const file of Array.from(files)) {
        const presign = await fetch(`${API_URL}/api/v1/storage/upload-url`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            folder:   'products',
          }),
        });
        const presignJson = (await presign.json()) as {
          success: boolean;
          data?:   { uploadUrl: string; r2Key: string };
        };
        if (!presignJson.success || !presignJson.data) {
          throw new Error('Could not get upload URL');
        }
        const put = await fetch(presignJson.data.uploadUrl, {
          method:  'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body:    file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        setR2Keys(prev => [...prev, presignJson.data!.r2Key]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCount(n => Math.max(0, n - files.length));
      e.target.value = '';
    }
  }

  function removeKey(key: string) {
    setR2Keys(prev => prev.filter(k => k !== key));
  }

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

      const json = (await res.json()) as {
        success: boolean;
        data?:   { id: string };
        error?:  string;
      };
      if (!json.success) {
        setServerError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      // Attach any uploaded images. For create mode, use the new product id
      // from the response; for edit mode, use the incoming productId prop.
      const targetId = mode === 'create' ? json.data?.id : productId;
      if (targetId && r2Keys.length > 0) {
        await fetch(`${API_URL}/api/v1/store/products/${targetId}/images`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ r2Keys }),
        }).catch(() => { /* non-critical — product saved, images can be retried */ });
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

      {/* Image upload — R2 pre-signed PUT */}
      <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-[#FEFAF6] px-4 py-5">
        <label className={labelCls}>Product Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          disabled={uploadingCount > 0}
          className="block w-full text-sm text-[#64748B] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0E7C7B]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#0E7C7B] hover:file:bg-[#0E7C7B]/15 disabled:opacity-50"
        />
        {uploadingCount > 0 && (
          <p className="mt-2 text-xs text-[#64748B]">Uploading {uploadingCount}…</p>
        )}
        {uploadError && (
          <p className="mt-2 text-xs text-red-600">{uploadError}</p>
        )}
        {r2Keys.length > 0 && (
          <ul className="mt-3 space-y-1">
            {r2Keys.map(k => (
              <li key={k} className="flex items-center justify-between rounded-md bg-white/60 px-2 py-1 text-xs text-[#0F172A]">
                <span className="truncate">{k.split('/').pop()}</span>
                <button
                  type="button"
                  onClick={() => removeKey(k)}
                  className="ml-3 text-[#7B2D42] hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-[#94A3B8]">
          Images upload directly to Cloudflare R2. First image becomes the product thumbnail.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || uploadingCount > 0}
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
