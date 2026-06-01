// promptfoo prompt builder — FII narrative.
// Reads the REAL prompt (prompts/fii-narrative-v1.md). FII narrative is a
// non-judgmental observation of family-inclination alignment; it must emit the
// strict <narrative>/<discussion_starter> XML and avoid the forbidden words.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(
  join(HERE, '..', '..', 'prompts', 'fii-narrative-v1.md'),
  'utf-8',
);

export default async function ({ vars }) {
  const user =
    `Input:\n` +
    `- Profile A: ${vars.label_a} (score ${vars.score_a}), ` +
    `Profile B: ${vars.label_b} (score ${vars.score_b})\n` +
    `- Delta: ${Math.abs(Number(vars.score_a) - Number(vars.score_b))}\n\n` +
    `Write the narrative + discussion_starter XML.`;

  return [
    { role: 'system', content: TEMPLATE },
    { role: 'user', content: user },
  ];
}
