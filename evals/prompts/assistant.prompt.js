// promptfoo prompt builder — Matrimony AI Assistant.
// The assistant has no /prompts/*.md file; its system prompt lives inline in
// apps/ai-service/src/services/assistant_service.py as `_SYSTEM_TEMPLATE`.
// To avoid drift we EXTRACT that literal from the Python source and fill the
// RAG snapshot, mirroring build_system_prompt(). The eval asserts the reply is
// grounded in the supplied context, stays on matrimony topic, and refuses
// harmful/off-topic requests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  join(HERE, '..', '..', 'apps', 'ai-service', 'src', 'services', 'assistant_service.py'),
  'utf-8',
);

// Pull the triple-quoted _SYSTEM_TEMPLATE = """ ... """ block.
const m = SRC.match(/_SYSTEM_TEMPLATE\s*=\s*"""([\s\S]*?)"""/);
if (!m) throw new Error('Could not extract _SYSTEM_TEMPLATE from assistant_service.py');
const TEMPLATE = m[1];

export default async function ({ vars }) {
  const system = TEMPLATE
    .replace('{completeness}', vars.completeness ?? 0)
    .replace('{tier}', vars.tier ?? 'FREE')
    .replace('{matches}', vars.matches ?? '(none yet)')
    .replace('{pending}', vars.pending ?? 0)
    .replace('{unread}', vars.unread ?? 0)
    .replace('{gaps}', vars.gaps ?? '(none)')
    .replace('{last_active}', vars.last_active ?? '(unknown)');

  return [
    { role: 'system', content: system },
    { role: 'user', content: vars.message },
  ];
}
