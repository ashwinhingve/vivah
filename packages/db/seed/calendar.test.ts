/**
 * calendar.test.ts — unit tests for the pure calendar seed logic (calendar-data.ts).
 *
 * No DB, no esbuild: imports only the type-erased pure module, so it runs under
 * either `tsx` (CI) or a plain `tsc → node` compile (local DrvFs, where esbuild
 * is flaky). The dataset path is overridable via CALENDAR_DATASET_JSON so the
 * compiled JS can be run from a temp dir.
 *
 * Mirrors the Python determinism/convention tests in apps/ai-service/tests/test_calendar.py.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyConventions, buildRows } from './calendar-data.js';
import type { CalendarDataset, Conventions } from './calendar-data.js';

const datasetPath =
  process.env['CALENDAR_DATASET_JSON'] ?? resolve(__dirname, 'data/calendar-2026-2027.json');
const data = JSON.parse(readFileSync(datasetPath, 'utf-8')) as CalendarDataset;

const conv = (over: Partial<Conventions>): Conventions => ({ ...data.conventions, ...over });
const countKind = (rows: { kind: string }[], k: string): number =>
  rows.filter((r) => r.kind === k).length;

let passed = 0;
const test = (name: string, fn: () => void): void => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// ── Defaults reproduce today's live set exactly + the 4 new SCHOOL windows ─────
test('defaults: row counts by kind', () => {
  const rows = buildRows(data);
  assert.equal(countKind(rows, 'MUHURAT'), 152);
  assert.equal(countKind(rows, 'FESTIVAL'), 56); // 32 national + 24 regional
  assert.equal(countKind(rows, 'GOVT'), 6);
  assert.equal(countKind(rows, 'SCHOOL'), 4);
  assert.equal(rows.length, 218);
});

test('defaults: nothing promoted from disputed', () => {
  assert.equal(applyConventions(data).length, 0);
});

// ── Convention flips promote exactly the gated dates ──────────────────────────
test('devshayani=drik-25jul promotes the 4 July muhurats', () => {
  const promoted = applyConventions(data, conv({ devshayani: 'drik-25jul' }));
  assert.equal(promoted.length, 4);
  assert.ok(promoted.every((r) => r.kind === 'MUHURAT'));
  const dates = new Set(promoted.map((r) => r.eventDate));
  for (const d of ['2026-07-01', '2026-07-06', '2026-07-11', '2026-07-12']) {
    assert.ok(dates.has(d), `missing ${d}`);
  }
  // buildRows reflects the flip: 152 -> 156 muhurats, total 218 -> 222.
  const rows = buildRows(data, conv({ devshayani: 'drik-25jul' }));
  assert.equal(countKind(rows, 'MUHURAT'), 156);
  assert.equal(rows.length, 222);
});

test('january_post_sankranti=include promotes the 4 Jan muhurats', () => {
  const promoted = applyConventions(data, conv({ january_post_sankranti: 'include' }));
  assert.equal(promoted.length, 4);
  assert.ok(promoted.every((r) => r.kind === 'MUHURAT'));
});

test('vishu_day=apr-15 promotes Vishu on the chosen date', () => {
  const promoted = applyConventions(data, conv({ vishu_day: 'apr-15' }));
  const vishu = promoted.filter((r) => r.name === 'Vishu');
  assert.equal(vishu.length, 1);
  assert.equal(vishu[0]?.eventDate, '2026-04-15');
  assert.equal(vishu[0]?.region, 'Kerala');
  assert.equal(vishu[0]?.kind, 'FESTIVAL');
});

test('onam_reckoning=sep-01 promotes Onam on the chosen date', () => {
  const promoted = applyConventions(data, conv({ onam_reckoning: 'sep-01' }));
  const onam = promoted.filter((r) => r.name.startsWith('Onam'));
  assert.equal(onam.length, 1);
  assert.equal(onam[0]?.eventDate, '2026-09-01');
});

test('unset regional values stay held out', () => {
  const promoted = applyConventions(data, conv({ vishu_day: 'unset', onam_reckoning: 'unset' }));
  assert.equal(promoted.filter((r) => r.name === 'Vishu' || r.name.startsWith('Onam')).length, 0);
});

// ── SCHOOL windows present + sourced ──────────────────────────────────────────
test('SCHOOL windows have endDate and expected names', () => {
  const school = buildRows(data).filter((r) => r.kind === 'SCHOOL');
  assert.equal(school.length, 4);
  for (const s of school) {
    assert.ok(s.endDate, `${s.name} missing endDate`);
    assert.ok((s.endDate ?? '') >= s.eventDate);
  }
  const cbse2026 = school.find((s) => s.name.startsWith('CBSE') && s.eventDate.startsWith('2026'));
  assert.equal(cbse2026?.eventDate, '2026-02-17');
  assert.equal(cbse2026?.endDate, '2026-04-10');
  assert.equal(cbse2026?.region, null); // national board
});

// ── Determinism ───────────────────────────────────────────────────────────────
test('determinism: same conventions → identical rows', () => {
  const a = JSON.stringify(buildRows(data, conv({ devshayani: 'drik-25jul' })));
  const b = JSON.stringify(buildRows(data, conv({ devshayani: 'drik-25jul' })));
  assert.equal(a, b);
});

console.log(`\ncalendar-data: ${passed} tests passed`);
