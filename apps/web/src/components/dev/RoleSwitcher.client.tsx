'use client';

import { useState } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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

  if (process.env['NODE_ENV'] !== 'development') return null;

  async function handleSwitch(role: string) {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/dev/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      window.location.href = '/dashboard';
    } catch {
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
