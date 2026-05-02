/**
 * Smart Shaadi — Guests CSV Import / Export
 *
 * Pure functions: no DB, no I/O. Built-in string parsing (RFC-4180 quote-aware).
 */

import type { GuestRich } from '@smartshaadi/types';
import type { AddGuestInput } from '@smartshaadi/schemas';
import { AddGuestSchema } from '@smartshaadi/schemas';

const HEADER = [
  'name', 'phone', 'email', 'relationship', 'side', 'rsvpStatus',
  'mealPref', 'roomNumber', 'plusOnes', 'plusOneNames', 'ageGroup',
  'isVip', 'dietaryNotes', 'accessibilityNotes', 'invitedToCeremonies', 'notes',
] as const;

/** Escape one CSV cell — wrap in quotes when it contains , " or newline. */
function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = Array.isArray(value) ? value.join('|') : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportGuestsToCsv(rows: GuestRich[]): string {
  const lines: string[] = [HEADER.join(',')];
  for (const g of rows) {
    lines.push([
      csvCell(g.name),
      csvCell(g.phone),
      csvCell(g.email),
      csvCell(g.relationship),
      csvCell(g.side),
      csvCell(g.rsvpStatus),
      csvCell(g.mealPref),
      csvCell(g.roomNumber),
      csvCell(g.plusOnes),
      csvCell(g.plusOneNames),
      csvCell(g.ageGroup),
      csvCell(g.isVip),
      csvCell(g.dietaryNotes),
      csvCell(g.accessibilityNotes),
      csvCell(g.invitedToCeremonies),
      csvCell(g.notes),
    ].join(','));
  }
  return lines.join('\n');
}

/** Parse one CSV line into cells, honouring quoted strings + escaped quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"' && cur.length === 0) inQuote = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export interface ParsedCsvRow {
  rowIndex: number;          // 1-based, excluding header
  data?:    AddGuestInput;
  error?:   string;
}

export function parseGuestCsv(csvText: string): ParsedCsvRow[] {
  // Split lines but preserve quoted newlines? Keep it simple: assume newlines NOT inside quoted cells.
  // (UI-driven input — power users can switch to bulk JSON import for complex cases.)
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]!).map(c => c.trim());
  const headerIdx: Record<string, number> = {};
  for (let i = 0; i < headerCells.length; i++) headerIdx[headerCells[i]!] = i;

  if (headerIdx['name'] === undefined) {
    return [{ rowIndex: 0, error: 'CSV header must include `name`' }];
  }

  const out: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const get = (k: string) => {
      const idx = headerIdx[k];
      return idx === undefined ? undefined : cells[idx]?.trim();
    };
    const blank = (v: string | undefined) => (v == null || v === '') ? undefined : v;

    const plusOnesRaw = blank(get('plusOnes'));
    const plusOneNamesRaw = blank(get('plusOneNames'));
    const isVipRaw = blank(get('isVip'));
    const ceremoniesRaw = blank(get('invitedToCeremonies'));

    const candidate: Record<string, unknown> = {
      name:               blank(get('name')),
      phone:              blank(get('phone')),
      email:              blank(get('email')),
      relationship:       blank(get('relationship')),
      side:               blank(get('side')),
      mealPref:           blank(get('mealPref')),
      roomNumber:         blank(get('roomNumber')),
      plusOnes:           plusOnesRaw === undefined ? undefined : Number(plusOnesRaw),
      plusOneNames:       plusOneNamesRaw === undefined ? undefined : plusOneNamesRaw.split('|').map(s => s.trim()).filter(Boolean),
      ageGroup:           blank(get('ageGroup')),
      isVip:              isVipRaw === undefined ? undefined : ['true', '1', 'yes', 'TRUE', 'YES', 'Y'].includes(isVipRaw),
      dietaryNotes:       blank(get('dietaryNotes')),
      accessibilityNotes: blank(get('accessibilityNotes')),
      invitedToCeremonies: ceremoniesRaw === undefined ? undefined : ceremoniesRaw.split('|').map(s => s.trim()).filter(Boolean),
      notes:              blank(get('notes')),
    };

    // Strip undefined keys so optional fields don't trip zod
    for (const k of Object.keys(candidate)) {
      if (candidate[k] === undefined) delete candidate[k];
    }

    const parsed = AddGuestSchema.safeParse(candidate);
    if (parsed.success) {
      out.push({ rowIndex: i, data: parsed.data });
    } else {
      out.push({ rowIndex: i, error: parsed.error.issues[0]?.message ?? 'Invalid row' });
    }
  }
  return out;
}
