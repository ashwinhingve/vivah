import { Linking, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AppHeader } from '../../components/AppHeader';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Eyebrow } from '../../components/Ornament';

/**
 * Help & FAQ — a static informational screen (no API). Content mirrors the web
 * help page (apps/web .../help) so the two surfaces answer the same questions
 * the same way. Support goes to a mailto: rather than an in-app ticket form —
 * there is no support-ticket endpoint, and a mailto opens the user's own mail
 * app with the address prefilled, which is honest about where the message goes.
 */

const SUPPORT_EMAIL = 'support@smartshaadi.co.in';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does profile verification work?',
    a: 'Every profile goes through phone OTP, KYC (when available), and admin review before appearing in match search.',
  },
  {
    q: 'How are matches calculated?',
    a: 'We use 8 Ashtakoot factors (Guna Milan), demographic alignment, lifestyle compatibility, and partner preferences. Both sides must meet each other’s criteria before a profile is surfaced.',
  },
  {
    q: 'Who can see my profile?',
    a: 'Only matches that mutually accept can see contact details. Photos stay private until both sides show interest.',
  },
  {
    q: 'How do I book a vendor?',
    a: 'Open a vendor, tap Request Booking, pick an available date and package, and submit. The vendor confirms, and you can track it under More → My Bookings.',
  },
  {
    q: 'How do I change my plan?',
    a: 'Go to Settings → Subscription → Upgrade, choose a plan, and complete payment on the secure Razorpay checkout. Your tier updates once payment is confirmed.',
  },
];

export default function HelpScreen() {
  const openSupportEmail = (): void => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Smart Shaadi — Support request')}`,
    );
  };

  return (
    <Screen scroll>
      <AppHeader title="Help & Support" showBack />

      <Animated.View entering={FadeInUp.duration(300)} className="mb-8">
        <Eyebrow text="Frequently Asked" className="mb-3" />
        <Card className="p-0 overflow-hidden">
          {FAQS.map((faq, index) => (
            <View
              key={faq.q}
              className={`px-4 py-3.5 ${index < FAQS.length - 1 ? 'border-b border-gold/15' : ''}`}
            >
              <Text className="font-semibold text-ink mb-1.5">{faq.q}</Text>
              <Text className="text-sm text-muted leading-5">{faq.a}</Text>
            </View>
          ))}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(60).duration(300)}>
        <Card elevated className="bg-gold/10 border-gold/40">
          <Text className="font-semibold text-ink mb-1">Still need help?</Text>
          <Text className="text-sm text-muted mb-4">
            Email our support team and we’ll get back to you.
          </Text>
          <Button
            title="Contact support"
            variant="primary"
            onPress={openSupportEmail}
            accessibilityHint="Opens your mail app to email Smart Shaadi support"
          />
          <Text className="text-xs text-muted text-center mt-3">
            {SUPPORT_EMAIL}
          </Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}
