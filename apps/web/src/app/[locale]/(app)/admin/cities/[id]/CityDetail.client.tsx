'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CityDensityReport, CityStatus } from '@smartshaadi/types';

// Cross-origin api base (ADR-002): cookies only travel with credentials:'include'.
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STATUS_COLORS: Record<CityStatus, string> = {
  ACTIVE: 'bg-success/10',
  EXPANSION: 'bg-gold/10',
  PLANNED: 'bg-muted/10',
};

const STATUS_LABELS: Record<CityStatus, string> = {
  ACTIVE: 'Active',
  EXPANSION: 'Expansion',
  PLANNED: 'Planned',
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-primary">{value}</p>
    </Card>
  );
}

export function CityDetail({ density }: { density: CityDensityReport }) {
  const t = useTranslations('adminCities.cityDetail');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    status: density.city.status,
    targetVendorsPerCategory: density.city.targetVendorsPerCategory,
    displayOrder: density.city.displayOrder,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/cities/${density.city.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(t('editForm.error'));
      }

      setIsEditing(false);
      // Refresh the page to show updated data.
      router.refresh();
    } catch (e) {
      alert(t('editForm.error'));
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label={t('stats.bookings')} value={String(density.bookingsLast90d)} />
        <StatTile label={t('stats.revenue')} value={`₹${density.revenueLast90d}`} />
        <StatTile label={t('stats.coverage')} value={`${density.coveragePct}%`} />
      </div>

      {/* Density Table */}
      <Card padding="md" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gold/20">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-primary">
                {t('densityTable.category')}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-primary">
                {t('densityTable.approved')}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-primary">
                {t('densityTable.total')}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-primary">
                {t('densityTable.target')}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-primary">
                {t('densityTable.gap')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {density.categories.map((cat) => (
              <tr
                key={cat.category}
                className={cat.gap > 0 ? 'bg-destructive/5' : 'hover:bg-background/30'}
              >
                <td className="px-4 py-3 font-medium text-primary">{cat.category}</td>
                <td className="px-4 py-3 text-center text-primary">{cat.approved}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{cat.total}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{cat.target}</td>
                <td className="px-4 py-3 text-center">
                  {cat.gap > 0 ? (
                    <span className="font-semibold text-destructive">
                      {t('densityTable.needMore', { count: cat.gap })}
                    </span>
                  ) : (
                    <span className="font-semibold text-success">{t('densityTable.atTarget')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit Form */}
      <Card padding="md">
        <h3 className="mb-4 text-lg font-semibold text-primary">{t('editForm.heading')}</h3>

        {!isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('editForm.status')}</span>
              <Badge className={STATUS_COLORS[density.city.status]}>
                {STATUS_LABELS[density.city.status]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('editForm.targetVendors')}</span>
              <span className="font-medium text-primary">{density.city.targetVendorsPerCategory}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('editForm.displayOrder')}</span>
              <span className="font-medium text-primary">{density.city.displayOrder}</span>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted">{t('editForm.status')}</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as CityStatus })
                }
                className="mt-1 w-full rounded-lg border border-gold/20 bg-background px-3 py-2 text-sm focus:border-teal focus:outline-none"
              >
                <option value="PLANNED">{t('editForm.statusPlanned')}</option>
                <option value="EXPANSION">{t('editForm.statusExpansion')}</option>
                <option value="ACTIVE">{t('editForm.statusActive')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted">
                {t('editForm.targetVendors')}
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.targetVendorsPerCategory}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetVendorsPerCategory: parseInt(e.target.value, 10),
                  })
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted">{t('editForm.displayOrder')}</label>
              <Input
                type="number"
                min="0"
                max="9999"
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    displayOrder: parseInt(e.target.value, 10),
                  })
                }
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? t('editForm.saving') : t('editForm.save')}
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                variant="outline"
                size="sm"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
