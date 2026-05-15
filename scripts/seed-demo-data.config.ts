/**
 * Demo profile data for May 16 client demo.
 * Source: docs/demo/demo-data-plan.md
 */

export interface PartnerPrefRange {
  min: number;
  max: number;
}

export interface DemoProfile {
  key: 'aarav' | 'priya' | 'anjali';
  phone: string;
  personal: {
    fullName: string;
    dob: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    height: number;
    maritalStatus: 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';
    motherTongue: string;
    religion: string;
    caste: string;
    subCaste?: string;
    manglik: boolean;
    bio: string;
  };
  education: {
    degree: string;
    college: string;
    fieldOfStudy: string;
    year: number;
  };
  profession: {
    occupation: string;
    employer: string;
    incomeRange: string;
    workLocation: string;
    employerType: 'PRIVATE' | 'GOVERNMENT' | 'BUSINESS' | 'SELF_EMPLOYED' | 'NOT_WORKING';
    designation: string;
  };
  family: {
    fatherName: string;
    fatherOccupation: string;
    motherName: string;
    motherOccupation: string;
    siblings: { name: string; married: boolean; occupation: string }[];
    familyType: 'JOINT' | 'NUCLEAR' | 'EXTENDED';
    familyValues: 'TRADITIONAL' | 'MODERATE' | 'LIBERAL';
    nativePlace: string;
    parentsLivingSituation:
      | 'YES_COMMITTED'
      | 'OPEN'
      | 'NO_OBJECTION'
      | 'PREFER_SEPARATE';
    familyDecisionInvolvement:
      | 'HIGH_COLLABORATIVE'
      | 'CONSULTATIVE'
      | 'INFORMED_ONLY'
      | 'INDEPENDENT';
    culturalEventsAttendance:
      | 'ALWAYS'
      | 'IMPORTANT_ONLY'
      | 'OCCASIONALLY'
      | 'RARELY';
    religiousObservanceWithFamily:
      | 'VERY_ACTIVE_TOGETHER'
      | 'ACTIVE_INDIVIDUALLY'
      | 'OCCASIONAL'
      | 'PERSONAL_ONLY'
      | 'NOT_PRACTICING';
  };
  lifestyle: {
    diet: 'VEG' | 'NON_VEG' | 'JAIN' | 'VEGAN' | 'EGGETARIAN';
    smoking: 'NEVER' | 'OCCASIONALLY' | 'REGULARLY';
    drinking: 'NEVER' | 'OCCASIONALLY' | 'REGULARLY';
    hobbies: string[];
    interests: string[];
    languagesSpoken: string[];
    fitnessLevel: 'ACTIVE' | 'MODERATE' | 'SEDENTARY';
  };
  horoscope: {
    rashi: string;
    nakshatra: string;
    dob: string;
    tob: string;
    pob: string;
    manglik: 'YES' | 'NO' | 'PARTIAL';
  };
  preferences: {
    ageRange: PartnerPrefRange;
    heightRange: PartnerPrefRange;
    religion: string[];
    caste: string[];
    location: string[];
    diet: string[];
    manglik: 'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK';
    partnerDescription: string;
  };
  personality: {
    introvertExtrovert: number;
    traditionalModern: number;
    plannerSpontaneous: number;
    religiousSecular: number;
    ambitiousBalanced: number;
    familyIndependent: number;
  };
  photoSeeds: string[];
  stayQuotient: 'INDEPENDENT' | 'WITH_PARENTS' | 'WITH_INLAWS' | 'FLEXIBLE';
  familyInclinationScore: number;
}

export const AARAV: DemoProfile = {
  key: 'aarav',
  phone: '+919999999999',
  personal: {
    fullName: 'Aarav Sharma',
    dob: '1998-03-15',
    gender: 'MALE',
    height: 178,
    maritalStatus: 'NEVER_MARRIED',
    motherTongue: 'Marathi',
    religion: 'Hindu',
    caste: 'Brahmin',
    subCaste: 'Deshastha',
    manglik: false,
    bio: 'Software engineer based in Bhopal, originally from Indore. Family-oriented but career-focused. Enjoy weekend treks, cooking Marathi food, and reading historical fiction. Looking for a thoughtful partner who values both tradition and modern ambitions.',
  },
  education: {
    degree: 'B.Tech',
    college: 'IIT Indore',
    fieldOfStudy: 'Computer Science',
    year: 2020,
  },
  profession: {
    occupation: 'Senior Software Engineer',
    employer: 'Tata Consultancy Services',
    incomeRange: '15-20L',
    workLocation: 'Bhopal',
    employerType: 'PRIVATE',
    designation: 'Senior Software Engineer',
  },
  family: {
    fatherName: 'Rajesh Sharma',
    fatherOccupation: 'Government Engineer (Retired)',
    motherName: 'Sunita Sharma',
    motherOccupation: 'Homemaker',
    siblings: [{ name: 'Priti Sharma', married: true, occupation: 'Teacher' }],
    familyType: 'JOINT',
    familyValues: 'MODERATE',
    nativePlace: 'Indore, MP',
    parentsLivingSituation: 'YES_COMMITTED',
    familyDecisionInvolvement: 'HIGH_COLLABORATIVE',
    culturalEventsAttendance: 'ALWAYS',
    religiousObservanceWithFamily: 'ACTIVE_INDIVIDUALLY',
  },
  lifestyle: {
    diet: 'VEG',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    hobbies: ['Trekking', 'Cooking', 'Reading', 'Photography'],
    interests: ['Historical fiction', 'Marathi cuisine', 'Western Ghats trails'],
    languagesSpoken: ['Marathi', 'Hindi', 'English'],
    fitnessLevel: 'ACTIVE',
  },
  horoscope: {
    rashi: 'MEENA',
    nakshatra: 'UTTARABHADRAPADA',
    dob: '1998-03-15',
    tob: '07:42',
    pob: 'Indore, MP',
    manglik: 'NO',
  },
  preferences: {
    ageRange: { min: 24, max: 28 },
    heightRange: { min: 152, max: 170 },
    religion: ['Hindu'],
    caste: ['Brahmin', 'Maratha'],
    location: ['Pune', 'Bhopal', 'Mumbai', 'Indore'],
    diet: ['VEG'],
    manglik: 'NON_MANGLIK',
    partnerDescription:
      'Family-oriented, educated, ambitious yet grounded. Values traditional roots with modern outlook.',
  },
  personality: {
    introvertExtrovert: 4,
    traditionalModern: 4,
    plannerSpontaneous: 5,
    religiousSecular: 4,
    ambitiousBalanced: 5,
    familyIndependent: 6,
  },
  photoSeeds: ['aarav-portrait-1', 'aarav-trek-2', 'aarav-formal-3'],
  stayQuotient: 'WITH_PARENTS',
  familyInclinationScore: 85,
};

export const PRIYA: DemoProfile = {
  key: 'priya',
  phone: '+918120684036',
  personal: {
    fullName: 'Priya Joshi',
    dob: '1999-08-22',
    gender: 'FEMALE',
    height: 163,
    maritalStatus: 'NEVER_MARRIED',
    motherTongue: 'Marathi',
    religion: 'Hindu',
    caste: 'Brahmin',
    subCaste: 'Chitpavan',
    manglik: false,
    bio: 'Pune-based product manager with engineering background. Family-rooted in Maharashtrian traditions — Ganesh Chaturthi at Lalbaugcha Raja every year. Love classical music, badminton, and weekend hikes in Western Ghats. Looking for a partner who balances ambition with family values.',
  },
  education: {
    degree: 'M.Tech',
    college: 'IIT Bombay',
    fieldOfStudy: 'Computer Engineering',
    year: 2022,
  },
  profession: {
    occupation: 'Product Manager',
    employer: 'Persistent Systems',
    incomeRange: '15-20L',
    workLocation: 'Pune',
    employerType: 'PRIVATE',
    designation: 'Product Manager',
  },
  family: {
    fatherName: 'Anil Joshi',
    fatherOccupation: 'Banker (Private Sector)',
    motherName: 'Pooja Joshi',
    motherOccupation: 'Teacher',
    siblings: [{ name: 'Rohan Joshi', married: false, occupation: 'Engineer' }],
    familyType: 'JOINT',
    familyValues: 'MODERATE',
    nativePlace: 'Pune, MH',
    parentsLivingSituation: 'OPEN',
    familyDecisionInvolvement: 'HIGH_COLLABORATIVE',
    culturalEventsAttendance: 'ALWAYS',
    religiousObservanceWithFamily: 'ACTIVE_INDIVIDUALLY',
  },
  lifestyle: {
    diet: 'VEG',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    hobbies: ['Classical Music (Hindustani Vocal)', 'Badminton', 'Hiking'],
    interests: ['Sahyadri Ranges', 'Lalbaugcha Raja', 'Product strategy'],
    languagesSpoken: ['Marathi', 'Hindi', 'English'],
    fitnessLevel: 'ACTIVE',
  },
  horoscope: {
    rashi: 'SIMHA',
    nakshatra: 'PURVAPHALGUNI',
    dob: '1999-08-22',
    tob: '14:15',
    pob: 'Pune, MH',
    manglik: 'NO',
  },
  preferences: {
    ageRange: { min: 26, max: 32 },
    heightRange: { min: 170, max: 185 },
    religion: ['Hindu'],
    caste: ['Brahmin', 'Maratha'],
    location: ['Pune', 'Mumbai', 'Bhopal', 'Bangalore'],
    diet: ['VEG'],
    manglik: 'NON_MANGLIK',
    partnerDescription:
      'Family-oriented, professionally ambitious, respectful of Maharashtrian traditions. B.Tech/M.Tech/MBA preferred.',
  },
  personality: {
    introvertExtrovert: 4,
    traditionalModern: 4,
    plannerSpontaneous: 5,
    religiousSecular: 4,
    ambitiousBalanced: 5,
    familyIndependent: 6,
  },
  photoSeeds: ['priya-portrait-1', 'priya-music-2', 'priya-formal-3'],
  stayQuotient: 'WITH_PARENTS',
  familyInclinationScore: 82,
};

export const ANJALI: DemoProfile = {
  key: 'anjali',
  phone: '+919876543210',
  personal: {
    fullName: 'Anjali Mehta',
    dob: '2001-11-10',
    gender: 'FEMALE',
    height: 165,
    maritalStatus: 'NEVER_MARRIED',
    motherTongue: 'Gujarati',
    religion: 'Hindu',
    caste: 'Brahmin',
    subCaste: 'Gujarati Brahmin',
    manglik: false,
    bio: 'Mumbai girl, business school grad working in investment banking. Strong career focus — looking to make Partner by 32. Modern outlook but respect for traditions. Enjoy fine dining, travel (15 countries so far), and weekend retreats.',
  },
  education: {
    degree: 'MBA',
    college: 'NMIMS Mumbai',
    fieldOfStudy: 'Finance',
    year: 2024,
  },
  profession: {
    occupation: 'Investment Analyst',
    employer: 'HDFC Bank',
    incomeRange: '10-15L',
    workLocation: 'Mumbai',
    employerType: 'PRIVATE',
    designation: 'Investment Analyst',
  },
  family: {
    fatherName: 'Vikram Mehta',
    fatherOccupation: 'Diamond Merchant',
    motherName: 'Hemali Mehta',
    motherOccupation: 'Homemaker',
    siblings: [],
    familyType: 'NUCLEAR',
    familyValues: 'LIBERAL',
    nativePlace: 'Mumbai, MH',
    parentsLivingSituation: 'PREFER_SEPARATE',
    familyDecisionInvolvement: 'INFORMED_ONLY',
    culturalEventsAttendance: 'IMPORTANT_ONLY',
    religiousObservanceWithFamily: 'OCCASIONAL',
  },
  lifestyle: {
    diet: 'EGGETARIAN',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    hobbies: ['Travel', 'Fine Dining', 'Yoga', 'Equity Research'],
    interests: ['Wine', 'European cities', 'Markets'],
    languagesSpoken: ['Gujarati', 'Hindi', 'English'],
    fitnessLevel: 'MODERATE',
  },
  horoscope: {
    rashi: 'VRISCHIKA',
    nakshatra: 'ANURADHA',
    dob: '2001-11-10',
    tob: '09:30',
    pob: 'Mumbai, MH',
    manglik: 'NO',
  },
  preferences: {
    ageRange: { min: 26, max: 32 },
    heightRange: { min: 172, max: 188 },
    religion: ['Hindu'],
    caste: [],
    location: ['Mumbai', 'Bangalore', 'Delhi', 'Singapore'],
    diet: ['VEG', 'NON_VEG', 'EGGETARIAN'],
    manglik: 'ANY',
    partnerDescription:
      'Career-driven professional (CA/MBA/Banker preferred). Modern outlook. Open to long-distance.',
  },
  personality: {
    introvertExtrovert: 6,
    traditionalModern: 6,
    plannerSpontaneous: 5,
    religiousSecular: 6,
    ambitiousBalanced: 7,
    familyIndependent: 3,
  },
  photoSeeds: ['anjali-portrait-1', 'anjali-travel-2', 'anjali-formal-3'],
  stayQuotient: 'INDEPENDENT',
  familyInclinationScore: 45,
};

export const PROFILES: DemoProfile[] = [AARAV, PRIYA, ANJALI];

export const WEDDING_GUESTS = [
  {
    name: 'Rajesh Sharma',
    relationship: 'Father',
    side: 'GROOM' as const,
    mealPref: 'VEG' as const,
  },
  {
    name: 'Sunita Sharma',
    relationship: 'Mother',
    side: 'GROOM' as const,
    mealPref: 'VEG' as const,
  },
  {
    name: 'Rohan Joshi',
    relationship: 'Brother-in-law',
    side: 'BRIDE' as const,
    mealPref: 'VEG' as const,
  },
  {
    name: 'Pooja Joshi',
    relationship: "Bride's Mother",
    side: 'BRIDE' as const,
    mealPref: 'VEG' as const,
  },
  {
    name: 'Amit Patel',
    relationship: 'College Friend',
    side: 'GROOM' as const,
    mealPref: 'NON_VEG' as const,
    plusOnes: 1,
  },
];

export const CHAT_SCRIPT: { from: 'aarav' | 'priya'; content: string }[] = [
  {
    from: 'aarav',
    content:
      'Hi Priya, nice to meet you here. Your photography work caught my eye!',
  },
  {
    from: 'priya',
    content:
      'Thanks Aarav! Yours too. I saw you trek — which trails do you favor?',
  },
  {
    from: 'aarav',
    content: 'Mostly Pachmarhi and Mahabaleshwar in winters. You?',
  },
];
