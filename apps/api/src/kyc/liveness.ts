// ─────────────────────────────────────────────────────────────────────────────
// Liveness adapter — active liveness via challenge-frame analysis.
// Mock mode: passes when challengesPassed includes >= 2 of {HEAD_TURN_LEFT,
// HEAD_TURN_RIGHT, BLINK, SMILE}. Spoof detection scaffolded — provider
// integration (FaceX / HyperVerge / IDfy) plugs in here.
// ─────────────────────────────────────────────────────────────────────────────
import { env } from '../lib/env.js';
import type { LivenessResult } from '@smartshaadi/types';

export interface LivenessArgs {
  videoR2Key:        string;
  challengesPassed:  string[];
}

const REQUIRED_CHALLENGES = 2;

export async function checkLiveness(args: LivenessArgs): Promise<LivenessResult> {
  if (env.USE_MOCK_SERVICES) {
    const passed = args.challengesPassed.length >= REQUIRED_CHALLENGES;
    const baseScore = Math.min(100, args.challengesPassed.length * 28 + 16);
    // Mock spoof flag if no challenges submitted at all
    const spoofIndicators = args.challengesPassed.length === 0 ? ['NO_CHALLENGE_RESPONSE'] : [];
    return {
      passed,
      score:            passed ? baseScore : Math.max(20, baseScore - 30),
      challengesPassed: args.challengesPassed,
      spoofIndicators,
      analyzedAt:       new Date().toISOString(),
    };
  }

  // TODO: pull video from R2, run frame-by-frame liveness model.
  //   Detect: screen replay (moiré pattern), photo holdup (depth=0),
  //   mask (texture homogeneity), deepfake (frame-coherence anomaly).
  //   Compose into `score` and binary `passed`.
  throw new Error('Real liveness provider not yet configured');
}
