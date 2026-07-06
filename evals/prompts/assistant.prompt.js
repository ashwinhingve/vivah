// promptfoo prompt builder — Matrimony AI Assistant.
// The system prompt now lives in prompts/matrimony-assistant-v2.md and injects
// the RAG snapshot at the {{USER_CONTEXT}} marker — mirroring build_system_prompt()
// in apps/ai-service/src/services/assistant_service.py. The eval asserts the reply
// is grounded in the supplied context, stays on matrimony topic, and refuses
// harmful/off-topic requests.
//
// NOTE: the live assistant is agentic (tool-calling over the user's real data).
// This static eval exercises only the prompt + grounding behavior; tool-selection
// is covered separately in the ai-service test suite.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(
  join(HERE, '..', '..', 'prompts', 'matrimony-assistant-v2.md'),
  'utf-8',
);

function renderSnapshot(vars) {
  return [
    `- Profile completeness: ${vars.completeness ?? 0}% (tier: ${vars.tier ?? 'FREE'})`,
    `- Top matches: ${vars.matches ?? '(none yet)'}`,
    `- Pending match requests: ${vars.pending ?? 0}`,
    `- Unread messages: ${vars.unread ?? 0}`,
    `- Incomplete profile sections: ${vars.gaps ?? '(none)'}`,
    `- Last active: ${vars.last_active ?? '(unknown)'}`,
  ].join('\n');
}

export default async function ({ vars }) {
  const system = TEMPLATE.replace('{{USER_CONTEXT}}', renderSnapshot(vars));
  return [
    { role: 'system', content: system },
    { role: 'user', content: vars.message },
  ];
}
