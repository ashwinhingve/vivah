import Link from 'next/link';
import { ArrowLeft, UserPlus, Users, Mail } from 'lucide-react';
import { fetchMembers, fetchInvites } from '@/lib/wedding-api';
import { inviteMemberAction, updateRoleAction, removeMemberAction } from './actions';
import { ActivityFeed } from '@/components/wedding/ActivityFeed';

interface PageProps { params: Promise<{ id: string }> }

export default async function MembersPage({ params }: PageProps) {
  const { id } = await params;
  const [m, i] = await Promise.all([fetchMembers(id), fetchInvites(id)]);
  const members = m?.members ?? [];
  const invites = i?.invites ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="font-heading text-2xl text-[#7B2D42] mb-2">Collaborators</h1>
        <p className="text-sm text-muted-foreground mb-6">Invite family + planners to collaborate on this wedding.</p>

        {/* Members list */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm mb-6">
          <div className="px-5 py-3 border-b border-[#C5A47E]/10 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#C5A47E]" />
            <h2 className="font-semibold text-[#0A1F4D]">Active members ({members.length})</h2>
          </div>
          <ul className="divide-y divide-[#C5A47E]/10">
            {members.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">No collaborators yet.</li>
            )}
            {members.map(m => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.name ?? m.email ?? m.userId}</p>
                  {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <form action={updateRoleAction.bind(null, id, m.id)} className="flex gap-1 items-center">
                    <select name="role" defaultValue={m.role} className="text-xs rounded border border-[#C5A47E]/30 px-2 py-1">
                      <option value="OWNER">Owner</option>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button type="submit" className="text-xs text-[#0E7C7B] hover:underline">Save</button>
                  </form>
                  {m.role !== 'OWNER' && (
                    <form action={removeMemberAction.bind(null, id, m.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">Remove</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm mb-6">
            <div className="px-5 py-3 border-b border-[#C5A47E]/10 flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#C5A47E]" />
              <h2 className="font-semibold text-[#0A1F4D]">Pending invites ({invites.filter(i => !i.acceptedAt).length})</h2>
            </div>
            <ul className="divide-y divide-[#C5A47E]/10">
              {invites.filter(i => !i.acceptedAt).map(i => (
                <li key={i.id} className="px-5 py-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium">{i.email}</p>
                    <p className="text-xs text-muted-foreground">{i.role.toLowerCase()} · expires {new Date(i.expiresAt).toLocaleDateString('en-IN')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invite form */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-[#0A1F4D] mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite by email
          </h2>
          <form action={inviteMemberAction.bind(null, id)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input name="email" type="email" required placeholder="email@example.com"
              className="sm:col-span-2 min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
            <select name="role" className="min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
              <option value="VIEWER">Viewer (read-only)</option>
              <option value="EDITOR">Editor (can edit)</option>
            </select>
            <button type="submit" className="sm:col-span-3 min-h-[44px] rounded-lg bg-[#7B2D42] text-white text-sm font-semibold">
              Send invite
            </button>
          </form>
        </div>

        {/* Recent activity */}
        <div className="mt-6">
          <ActivityFeed weddingId={id} limit={20} />
        </div>
      </div>
    </div>
  );
}
