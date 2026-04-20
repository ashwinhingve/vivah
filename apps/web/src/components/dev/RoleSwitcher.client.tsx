'use client';

import { useState } from 'react';

const ROLES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'FAMILY_MEMBER', label: 'Family' },
  { value: 'EVENT_COORDINATOR', label: 'Coordinator' },
];

export function RoleSwitcher() {
  const [loading, setLoading] = useState(false);

  async function handleSwitch(role: string) {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/dev/switch-role`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as unknown;
        console.error('Role switch failed:', res.status, body);
        setLoading(false);
        return;
      }
      window.location.replace('/dashboard?t=' + Date.now());
    } catch (err) {
      console.error('Role switch error:', err);
      setLoading(false);
    }
  }

  return (
    <select
      onChange={(e) => { if (e.target.value) void handleSwitch(e.target.value); }}
      disabled={loading}
      className="text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded px-1.5 py-1 cursor-pointer disabled:opacity-50"
      defaultValue=""
    >
      <option value="" disabled>Switch Role</option>
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  );
}
