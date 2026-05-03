import Link from 'next/link';
import { ArrowLeft, Briefcase, Plus } from 'lucide-react';
import { fetchVendorAssignments } from '@/lib/wedding-api';
import { fetchAuth } from '@/lib/server-fetch';
import type { Ceremony } from '@smartshaadi/types';
import { assignVendorAction, updateAssignmentAction, removeAssignmentAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

const ROLES = ['PHOTOGRAPHER','VIDEOGRAPHER','CATERER','DECORATOR','MUSICIAN','DJ','MAKEUP_ARTIST','MEHENDI_ARTIST','PRIEST','PLANNER','TRANSPORT','VENUE','OTHER'];
const STATUSES = ['SHORTLISTED','INQUIRED','BOOKED','CONFIRMED','CANCELLED'];

const STATUS_COLORS: Record<string, string> = {
  SHORTLISTED: 'bg-secondary text-foreground',
  INQUIRED:    'bg-teal/10 text-teal',
  BOOKED:      'bg-warning/15 text-warning',
  CONFIRMED:   'bg-success/15 text-success',
  CANCELLED:   'bg-destructive/15 text-destructive',
};

export default async function VendorAssignmentsPage({ params }: PageProps) {
  const { id } = await params;
  const [a, c] = await Promise.all([
    fetchVendorAssignments(id),
    fetchAuth<{ ceremonies: Ceremony[] }>(`/api/v1/weddings/${id}/ceremonies`),
  ]);
  const assignments = a?.assignments ?? [];
  const ceremonies = c?.ceremonies ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <Briefcase className="h-6 w-6 text-[#C5A47E]" />
          <h1 className="font-heading text-2xl text-[#7B2D42]">Vendors</h1>
        </div>

        {assignments.length === 0 ? (
          <div className="bg-surface border border-dashed border-[#C5A47E]/30 rounded-xl p-12 text-center mb-6">
            <p className="text-sm text-muted-foreground mb-4">No vendors shortlisted yet.</p>
            <Link href="/vendors" className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-lg bg-[#0E7C7B] text-white text-sm font-medium">
              Browse vendor marketplace
            </Link>
          </div>
        ) : (
          <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C5A47E]/10 bg-[#FEFAF6] text-left">
                  <th className="px-4 py-2 font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Ceremony</th>
                  <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id} className="border-b border-[#C5A47E]/10 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/vendors/${a.vendorId}`} className="text-[#7B2D42] hover:underline">{a.vendorName ?? a.vendorId}</Link>
                      {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.role.toLowerCase().replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {a.ceremonyId ? (ceremonies.find(c => c.id === a.ceremonyId)?.type ?? '—') : 'All'}
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateAssignmentAction.bind(null, id, a.id)} className="flex gap-1 items-center">
                        <select name="status" defaultValue={a.status} className={`text-xs rounded border-0 px-2 py-0.5 ${STATUS_COLORS[a.status] ?? ''}`}>
                          {STATUSES.map(s => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                        </select>
                        <button type="submit" className="text-xs text-[#0E7C7B] hover:underline">Save</button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <form action={removeAssignmentAction.bind(null, id, a.id)}>
                        <button type="submit" className="text-xs text-destructive hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5">
          <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-[#7B2D42] list-none">
            <Plus className="h-4 w-4" /> Add vendor manually
          </summary>
          <p className="text-xs text-muted-foreground mt-3 mb-3">
            Tip: browse the vendor marketplace and copy a vendor ID, or use this form to assign a role to an already-shortlisted vendor.
          </p>
          <form action={assignVendorAction.bind(null, id)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor ID *</label>
              <input name="vendorId" required placeholder="UUID" className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
              <select name="role" required className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r.toLowerCase().replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ceremony</label>
              <select name="ceremonyId" className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
                <option value="">All ceremonies</option>
                {ceremonies.map(c => <option key={c.id} value={c.id}>{c.type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select name="status" className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{s.toLowerCase()}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <input name="notes" className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="md:col-span-2 min-h-[44px] rounded-lg bg-[#7B2D42] text-white text-sm font-semibold">Assign vendor</button>
          </form>
        </details>
      </div>
    </div>
  );
}
