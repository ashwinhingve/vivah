import { Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { useThemeColors } from '../../hooks/useThemeColors';

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
  const router = useRouter();
  const { colors } = useThemeColors();

  const openSupportEmail = (): void => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Smart Shaadi — Support request')}`,
    );
  };

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        className="mb-4"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text className="text-sm" style={{ color: colors.teal }}>
          ← Back
        </Text>
      </Pressable>

      <Text className="font-heading text-2xl text-primary mb-6">
        Help &amp; Support
      </Text>

      <Text className="font-semibold text-ink text-lg mb-4">
        Frequently asked
      </Text>

      {FAQS.map((faq, index) => (
        <View
          key={index}
          className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
        >
          <Text className="font-semibold text-ink mb-2">{faq.q}</Text>
          <Text className="text-sm text-muted leading-5">{faq.a}</Text>
        </View>
      ))}

      <View className="bg-gold/10 border border-gold/40 rounded-xl p-4 mt-4 mb-4">
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
      </View>
    </Screen>
  );
}
