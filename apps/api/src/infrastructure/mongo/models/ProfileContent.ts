import { Schema, model, models } from 'mongoose';

/**
 * ProfileContent — MongoDB collection for rich profile data.
 * Linked to PostgreSQL profiles table via userId (Better Auth nanoid text ID).
 *
 * This document stores everything that changes frequently, has variable structure
 * per community, or will eventually store AI embeddings. The PostgreSQL profiles
 * table stores the indexed, queryable metadata.
 */

const profileContentSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    personal: {
      fullName:      String,
      dob:           Date,
      gender:        String,         // MALE | FEMALE | OTHER
      height:        Number,         // cm
      weight:        Number,         // kg
      complexion:    String,
      maritalStatus: String,         // NEVER_MARRIED | DIVORCED | WIDOWED | SEPARATED
      motherTongue:  String,
      religion:      String,
      caste:         String,
      subCaste:      String,
      manglik:       Boolean,
      gotra:         String,
    },

    education: {
      degree:       String,
      college:      String,
      fieldOfStudy: String,
      year:         Number,
      additionalDegrees: [
        {
          degree:  String,
          college: String,
          year:    Number,
        },
      ],
    },

    profession: {
      occupation:    String,
      employer:      String,
      incomeRange:   String,    // e.g. "5-10 LPA"
      workLocation:  String,
      workingAbroad: Boolean,
      employerType:  String,    // PRIVATE | GOVERNMENT | BUSINESS | SELF_EMPLOYED | NOT_WORKING
      designation:   String,
      abroadCountry: String,
    },

    family: {
      fatherName:       String,
      fatherOccupation: String,
      motherName:       String,
      motherOccupation: String,
      siblings: [
        {
          name:       String,
          married:    Boolean,
          occupation: String,
        },
      ],
      familyType:   String,   // JOINT | NUCLEAR | EXTENDED
      familyValues: String,   // TRADITIONAL | MODERATE | LIBERAL
      familyStatus: String,   // MIDDLE_CLASS | UPPER_MIDDLE | AFFLUENT
      nativePlace:  String,
      familyAbout:  String,
    },

    location: {
      city:    String,
      state:   String,
      country: String,
      pincode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    lifestyle: {
      diet:            String,       // VEG | NON_VEG | JAIN | VEGAN | EGGETARIAN
      smoking:         String,       // NEVER | OCCASIONALLY | REGULARLY
      drinking:        String,       // NEVER | OCCASIONALLY | REGULARLY
      hobbies:         [String],
      interests:       [String],
      hyperNicheTags:  [String],     // career-first | environmentalist | spiritual | etc.
      languagesSpoken: [String],
      ownHouse:        Boolean,
      ownCar:          Boolean,
      fitnessLevel:    String,       // ACTIVE | MODERATE | SEDENTARY
      sunSign:         String,
    },

    horoscope: {
      rashi:          String,        // Moon sign
      nakshatra:      String,        // Birth star
      dob:            Date,
      tob:            String,        // Time of birth HH:MM
      pob:            String,        // Place of birth
      manglik:        Boolean,
      gunaScore:      Number,        // Cached from last Guna Milan calculation
      chartImageKey:  String,        // R2 key for kundli chart image
    },

    partnerPreferences: {
      ageRange:         { min: Number, max: Number },
      heightRange:      { min: Number, max: Number },
      incomeRange:      String,
      education:        [String],
      religion:         [String],
      caste:            [String],
      location:         [String],    // preferred states/cities
      manglik:          String,      // ANY | ONLY_MANGLIK | NON_MANGLIK
      diet:             [String],
      openToInterfaith: Boolean,
      openToInterCaste: Boolean,
      maritalStatus:    [String],    // NEVER_MARRIED | DIVORCED | WIDOWED | SEPARATED
      partnerDescription: String,
    },

    // Safety Mode — contact visibility
    safetyMode: {
      contactHidden: { type: Boolean, default: true },
      unlockedWith:  [String],       // profile IDs that can see contact
    },

    aboutMe:              String,    // Free text bio
    partnerDescription:   String,    // Free text ideal partner description

    // AI — populated by ai-service (Phase 3)
    aiEmbedding:          [Number],  // 1536-dim sentence-transformer vector
    embeddingUpdatedAt:   Date,

    communityZone: String,
    lgbtqProfile:  Boolean,          // flagged only if user self-identifies
  },
  {
    collection: 'profiles_content',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

// Prevent model re-registration in hot-reload environments
export const ProfileContent = (
  (models['ProfileContent'] as unknown) ??
  model('ProfileContent', profileContentSchema)
) as unknown;
