/**
 * Smart Shaadi — Marketing Content Templates (Unit 6.4)
 *
 * Fallback templates in en+hi for each campaign template key.
 * Used when LLM generation fails or is disabled.
 * Warm, premium tone; real Devanagari Hindi.
 *
 * Keys are arbitrary identifiers (e.g. 'welcome_series', 'winback_inactive', 'seasonal_muhurat').
 * Each has en+hi GeneratedCampaignCopy with subject/short/long/cta.
 */

import type { GeneratedCampaignCopy } from '@smartshaadi/types';

export const FALLBACK_TEMPLATES: Record<string, { en: GeneratedCampaignCopy; hi: GeneratedCampaignCopy }> = {
  /**
   * Welcome Series — for new users (event: user_registered or segment: new_incomplete_48h).
   * Focus: Reducing initial friction, building confidence to complete profile.
   */
  welcome_series: {
    en: {
      subjectLine: 'Welcome to Smart Shaadi — Your matrimonial journey starts here',
      bodyShort:
        'Join thousands of families finding genuine, values-aligned matches. Your profile is the key to meaningful connections.',
      bodyLong:
        'Welcome! Smart Shaadi is honored to help you find your perfect match. A complete, authentic profile dramatically increases your chances of connecting with like-minded families. Start by adding a few details about yourself — your interests, values, and what matters most in a partner.',
      ctaText: 'Complete My Profile',
    },
    hi: {
      subjectLine: 'स्मार्ट शादी में आपका स्वागत है — आपकी शादी की यात्रा शुरू हो गई',
      bodyShort:
        'हजारों परिवार सच्चे, मूल्य-आधारित रिश्ते ढूंढ रहे हैं। आपकी प्रोफाइल अर्थपूर्ण जुड़ाव की कुंजी है।',
      bodyLong:
        'स्वागत है! स्मार्ट शादी आपको अपनी परफेक्ट मैच खोजने में मदद करने के लिए सम्मानित है। एक पूर्ण, प्रामाणिक प्रोफाइल आपकी संभावनाओं को बहुत बढ़ा देती है। अपने बारे में कुछ विवरण जोड़ते हुए शुरुआत करें — आपकी रुचियां, मूल्य और आपके जीवन साथी में क्या मायने रखता है।',
      ctaText: 'मेरी प्रोफाइल पूरी करें',
    },
  },

  /**
   * Winback Inactive — for users inactive 14+ days (segment: inactive_14d).
   * Focus: Re-engagement, reminder of real matches waiting, low-pressure tone.
   */
  winback_inactive: {
    en: {
      subjectLine: 'We found someone who matches your interests, but they can\'t reach you',
      bodyShort:
        'A genuine profile has been waiting to connect with you. Come back and see who they are.',
      bodyLong:
        'We noticed you haven\'t visited us in a while. The good news: several families have viewed your profile and would love to connect. Your perfect match might be waiting. Come back and see the matches we found for you.',
      ctaText: 'See My Matches',
    },
    hi: {
      subjectLine: 'हमें आपके अनुकूल कोई व्यक्ति मिला, पर वह आपसे संपर्क नहीं कर सके',
      bodyShort: 'एक सच्ची प्रोफाइल आपसे जुड़ने के लिए प्रतीक्षा कर रही है। वापस आएं और देखें कि वह कौन है।',
      bodyLong:
        'हमने देखा कि आप कुछ समय से हमारे यहां नहीं आए हैं। अच्छी खबर यह है कि कई परिवारों ने आपकी प्रोफाइल देखी है और आपसे जुड़ना चाहते हैं। आपका परफेक्ट मैच प्रतीक्षा कर रहा हो सकता है। वापस आएं और देखें कि हमें आपके लिए कौन से मैच मिले हैं।',
      ctaText: 'मेरी मैचेस देखें',
    },
  },

  /**
   * Seasonal Muhurat — for auspicious calendar events (segment: any, trigger: SCHEDULED).
   * Focus: Cultural celebration, timing advantage, premium feel.
   */
  seasonal_muhurat: {
    en: {
      subjectLine: 'This month brings auspicious dates — plan your matrimonial journey',
      bodyShort:
        'According to the Hindu calendar, this month carries blessings for new unions. Start or accelerate your search now.',
      bodyLong:
        'In the tradition of Hindu matrimony, certain months and dates carry special auspiciousness. This month is particularly blessed for beginning your journey to marriage. Whether you\'re just starting or looking to accelerate your search, this is an ideal time to connect with families.',
      ctaText: 'Explore Matches Today',
    },
    hi: {
      subjectLine: 'इस महीने में शुभ तारीखें हैं — अपनी शादी की यात्रा की योजना बनाएं',
      bodyShort:
        'हिंदू कैलेंडर के अनुसार, इस महीने में नए संबंधों के लिए आशीर्वाद है। अभी अपनी खोज शुरू या तेज करें।',
      bodyLong:
        'हिंदू शादी की परंपरा में, कुछ महीने और तारीखें विशेष शुभता रखती हैं। यह महीना विवाह की यात्रा शुरू करने के लिए विशेष रूप से आशीर्वादित है। चाहे आप अभी शुरुआत कर रहे हों या अपनी खोज को तेज करना चाहते हों, यह परिवारों के साथ जुड़ने का आदर्श समय है।',
      ctaText: 'आज ही मैचेस देखें',
    },
  },

  /**
   * Vendor New — for vendors approved in last 7 days (segment: vendors_new_7d).
   * Focus: Celebration, growth mindset, booking opportunity.
   */
  vendor_onboarding: {
    en: {
      subjectLine: 'Welcome to Smart Shaadi! Your first bookings await',
      bodyShort:
        'Your service is now visible to families planning their weddings. Complete your portfolio to attract more bookings.',
      bodyLong:
        'Congratulations on being approved as a Smart Shaadi vendor! Families across India are now discovering your services. The more complete your portfolio — photos, packages, testimonials — the more bookings you\'ll receive. Start adding details today.',
      ctaText: 'Enhance My Portfolio',
    },
    hi: {
      subjectLine: 'स्मार्ट शादी में आपका स्वागत है! आपकी पहली बुकिंग प्रतीक्षा कर रही हैं',
      bodyShort:
        'आपकी सेवा अब शादी की योजना बनाने वाले परिवारों को दिखाई दे रही है। अधिक बुकिंग आकर्षित करने के लिए अपना पोर्टफोलियो पूरा करें।',
      bodyLong:
        'स्मार्ट शादी में एक विक्रेता के रूप में स्वीकृत होने पर बधाई! पूरे भारत के परिवार अब आपकी सेवाओं की खोज कर रहे हैं। आपका पोर्टफोलियो जितना पूरा होगा — फोटो, पैकेज, प्रशंसापत्र — उतनी ही अधिक बुकिंग आपको मिलेंगी। आज ही विवरण जोड़ना शुरू करें।',
      ctaText: 'अपना पोर्टफोलियो बेहतर बनाएं',
    },
  },

  /**
   * Vendor Re-engagement — for vendors idle 30+ days (segment: vendors_idle_30d).
   * Focus: Opportunity loss, reinvigoration, support.
   */
  vendor_reactivation: {
    en: {
      subjectLine: 'Weddings are happening — but families can\'t find you',
      bodyShort:
        'You haven\'t received bookings lately. Update your profile and get back in front of families planning weddings.',
      bodyLong:
        'We\'ve noticed it\'s been a while since your last interaction. Hundreds of families are actively searching for services like yours. Refresh your profile, update your portfolio with new photos, and reach out to pending inquiries — the wedding season is busy.',
      ctaText: 'Reactivate My Profile',
    },
    hi: {
      subjectLine: 'शादियां हो रही हैं — पर परिवार आपको खोज नहीं सकते',
      bodyShort:
        'आपको हाल ही में कोई बुकिंग नहीं मिली है। अपनी प्रोफाइल अपडेट करें और शादी की योजना बनाने वाले परिवारों के सामने वापस आएं।',
      bodyLong:
        'हमने देखा कि आपकी अंतिम बातचीत के बाद से काफी समय हो गया है। सैकड़ों परिवार सक्रिय रूप से आपके जैसी सेवाएं खोज रहे हैं। अपनी प्रोफाइल को ताज़ा करें, नई फोटो के साथ अपना पोर्टफोलियो अपडेट करें, और लंबित पूछताछों का जवाब दें — शादी का सीजन व्यस्त है।',
      ctaText: 'मेरी प्रोफाइल को फिर से सक्रिय करें',
    },
  },

  /**
   * Fallback — used when a campaign\'s templateKey doesn\'t match any specific template.
   * Generic, safe, universally applicable.
   */
  fallback: {
    en: {
      subjectLine: 'Connect with the right match on Smart Shaadi',
      bodyShort:
        'Smart Shaadi brings families together to find genuine, values-aligned partnerships. Discover your perfect match today.',
      bodyLong:
        'At Smart Shaadi, we believe that the best matches are built on shared values and compatibility. Whether you\'re just starting your matrimonial journey or looking to find someone special, we\'re here to help. Explore profiles, connect with families, and find your perfect match.',
      ctaText: 'Get Started',
    },
    hi: {
      subjectLine: 'स्मार्ट शादी पर सही मैच से जुड़ें',
      bodyShort:
        'स्मार्ट शादी परिवारों को एक साथ लाता है ताकि सच्चे, मूल्य-आधारित साझेदारी खोजें। आज ही अपनी परफेक्ट मैच खोजें।',
      bodyLong:
        'स्मार्ट शादी में, हम मानते हैं कि सर्वोत्तम मैचें साझा मूल्यों और अनुकूलता पर बनी होती हैं। चाहे आप अभी अपनी शादी की यात्रा शुरू कर रहे हों या किसी विशेष व्यक्ति को खोजना चाहते हों, हम यहां आपकी मदद करने के लिए हैं। प्रोफाइल देखें, परिवारों से जुड़ें, और अपनी परफेक्ट मैच खोजें।',
      ctaText: 'शुरुआत करें',
    },
  },
};
