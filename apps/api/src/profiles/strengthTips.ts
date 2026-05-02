/**
 * Smart Shaadi — Profile Strength Tips
 * apps/api/src/profiles/strengthTips.ts
 *
 * Pure rule-based recommendations for boosting a profile's appeal. No LLM.
 * Each tip carries an empirical-style impact label ("+60% views") so the user
 * sees the payoff before clicking through to the relevant onboarding step.
 */

export interface ProfileStrengthInputs {
  photoCount: number;
  hasHoroscope: boolean;
  hasAudioIntro: boolean;
  hasVideoIntro: boolean;
  hasAboutMe: boolean;
  hasPreferences: boolean;
  hasLifestyle: boolean;
  hasFamily: boolean;
  hasCareer: boolean;
  isVerified: boolean;
  hasPrimaryPhoto: boolean;
}

export interface StrengthTip {
  id: string;
  tip: string;
  impactLabel: string;
  fieldPath: string;
  priority: number;
}

export function computeStrengthTips(input: ProfileStrengthInputs): StrengthTip[] {
  const tips: StrengthTip[] = [];

  if (!input.hasPrimaryPhoto) {
    tips.push({ id: 'primary-photo', tip: 'Add a primary photo', impactLabel: '+200% views', fieldPath: '/profile/photos', priority: 100 });
  }
  if (input.photoCount < 3) {
    tips.push({ id: 'add-photos', tip: `Add ${3 - input.photoCount} more photo${3 - input.photoCount === 1 ? '' : 's'}`, impactLabel: '+60% views', fieldPath: '/profile/photos', priority: 90 });
  }
  if (!input.isVerified) {
    tips.push({ id: 'verify', tip: 'Verify your profile (Aadhaar)', impactLabel: '+45% trust', fieldPath: '/profile/kyc', priority: 85 });
  }
  if (!input.hasHoroscope) {
    tips.push({ id: 'horoscope', tip: 'Add horoscope details for Guna match', impactLabel: '+40% matches', fieldPath: '/profile/horoscope', priority: 75 });
  }
  if (!input.hasAboutMe) {
    tips.push({ id: 'about', tip: 'Write a short About Me', impactLabel: '+30% replies', fieldPath: '/profile/lifestyle', priority: 70 });
  }
  if (!input.hasLifestyle) {
    tips.push({ id: 'lifestyle', tip: 'Complete your lifestyle section', impactLabel: '+30% engagement', fieldPath: '/profile/lifestyle', priority: 65 });
  }
  if (!input.hasFamily) {
    tips.push({ id: 'family', tip: 'Add family details', impactLabel: '+25% trust', fieldPath: '/profile/family', priority: 60 });
  }
  if (!input.hasCareer) {
    tips.push({ id: 'career', tip: 'Fill in your career', impactLabel: '+25% matches', fieldPath: '/profile/career', priority: 55 });
  }
  if (!input.hasAudioIntro) {
    tips.push({ id: 'audio', tip: 'Record a 30s voice intro', impactLabel: '+25% replies', fieldPath: '/profile/intro', priority: 45 });
  }
  if (!input.hasPreferences) {
    tips.push({ id: 'preferences', tip: 'Set partner preferences', impactLabel: '+15% precision', fieldPath: '/profile/preferences', priority: 40 });
  }
  if (!input.hasVideoIntro) {
    tips.push({ id: 'video', tip: 'Add a 30s video intro', impactLabel: '+20% interest', fieldPath: '/profile/intro', priority: 35 });
  }

  return tips.sort((a, b) => b.priority - a.priority);
}
