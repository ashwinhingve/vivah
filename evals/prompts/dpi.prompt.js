// promptfoo prompt builder — DPI narrative.
// Reads the REAL prompt (prompts/dpi-narrative-v1.md). The DPI narrative is
// shown ONLY to the requesting user; it must never name/address the other
// party, never use forbidden words, and never leak a probability. Those are
// asserted in promptfooconfig.yaml against the output of this prompt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(
  join(HERE, '..', '..', 'prompts', 'dpi-narrative-v1.md'),
  'utf-8',
);

export default async function ({ vars }) {
  const user =
    `Input context:\n` +
    `- Match level: ${vars.level}\n` +
    `- Profile A: ${vars.profile_a}\n` +
    `- Profile B: ${vars.profile_b}\n` +
    `- Top factors: ${vars.top_factors}\n` +
    `- Shared strengths: ${vars.shared_strengths}\n\n` +
    `Produce the narrative + suggestion XML for the requesting user only.`;

  return [
    { role: 'system', content: TEMPLATE },
    { role: 'user', content: user },
  ];
}
