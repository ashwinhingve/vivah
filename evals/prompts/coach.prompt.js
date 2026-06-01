// promptfoo prompt builder — Conversation Coach.
// Reads the REAL versioned system prompt (prompts/conversation-coach-v1.md) so
// the eval regresses against the live prompt, not a copy. Mirrors how
// apps/ai-service/src/services/coach_service.py assembles the request:
//   system = filled template, user = last few labelled conversation turns.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(
  join(HERE, '..', '..', 'prompts', 'conversation-coach-v1.md'),
  'utf-8',
);

export default async function ({ vars }) {
  const system = TEMPLATE
    .replace('{state_context}', vars.state_context ?? 'STARTING')
    .replace('{shared_interests}', vars.shared_interests ?? 'none detected');

  const turns = (vars.conversation ?? [])
    .map((m) => `[Profile ${m.sender}] ${m.text}`)
    .join('\n');

  const user =
    `Conversation so far:\n${turns}\n\n` +
    `Generate 3 suggestions for Profile A to send next. Output only the XML block.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
