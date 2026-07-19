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

// ── Defaults now include South Indian January muhurats ──────────────────────────
test('defaults: row counts by kind (January South Indian admitted)', () => {
  const rows = buildRows(data);
  assert.equal(countKind(rows, 'MUHURAT'), 156); // 152 + 4 Jan
  assert.equal(countKind(rows, 'FESTIVAL'), 56); // 32 national + 24 regional
  assert.equal(countKind(rows, 'GOVT'), 6);
  assert.equal(countKind(rows, 'SCHOOL'), 4);
  assert.equal(rows.length, 222); // 218 + 4 Jan
});

test('defaults: January muhurats promoted from disputed', () => {
  const promoted = applyConventions(data);
  assert.equal(promoted.length, 4); // 4 Jan muhurats
  assert.ok(promoted.every((r) => r.kind === 'MUHURAT'));
  const dates = new Set(promoted.map((r) => r.eventDate));
  for (const d of ['2026-01-14', '2026-01-23', '2026-01-25', '2026-01-28']) {
    assert.ok(dates.has(d), `missing ${d}`);
  }
  // Verify region tagging
  assert.ok(promoted.every((r) => r.region === 'South India'), 'all Jan muhurats should be tagged South India');
});

// ── Convention flips promote exactly the gated dates ──────────────────────────
test('devshayani=drik-25jul adds 4 July muhurats (January also promoted by default)', () => {
  // January is promoted by default convention; this flip adds July on top
  const promoted = applyConventions(data, conv({ devshayani: 'drik-25jul' }));
  assert.equal(promoted.length, 8); // 4 Jan (default) + 4 July (flip)
  assert.ok(promoted.every((r) => r.kind === 'MUHURAT'));
  const dates = new Set(promoted.map((r) => r.eventDate));
  for (const d of ['2026-07-01', '2026-07-06', '2026-07-11', '2026-07-12']) {
    assert.ok(dates.has(d), `missing ${d}`);
  }
  for (const d of ['2026-01-14', '2026-01-23', '2026-01-25', '2026-01-28']) {
    assert.ok(dates.has(d), `missing Jan date ${d}`);
  }
  // buildRows: 152 base + 4 Jan (default) + 4 July (flip) = 160 muhurats total
  const rows = buildRows(data, conv({ devshayani: 'drik-25jul' }));
  assert.equal(countKind(rows, 'MUHURAT'), 160); // 152 base + 4 Jan (default) + 4 July (flip)
  assert.equal(rows.length, 226); // 160 muhurats + 56 festival + 6 govt + 4 school
});

test('january_post_sankranti=omit excludes the 4 Jan muhurats', () => {
  // January is promoted by default; omitting it should result in no promoted rows
  // (July would still be held out by the amanta-6jul default)
  const promoted = applyConventions(data, conv({ january_post_sankranti: 'omit' }));
  assert.equal(promoted.length, 0, 'January flip to omit should suppress promotion');
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
