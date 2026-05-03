/**
 * Smart Shaadi — PostgreSQL Schema (Drizzle ORM)
 * packages/db/schema/index.ts
 *
 * This is the complete Phase 1 schema.
 * Phase 2+ additions are in separate files: schema/phase2.ts etc.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, date, integer, decimal, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';

// ── ENUMS ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'INDIVIDUAL',
  'FAMILY_MEMBER',
  'VENDOR',
  'EVENT_COORDINATOR',
  'ADMIN',
  'SUPPORT',
]);

export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
  'DELETED',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'MANUAL_REVIEW',
  'EXPIRED',
  'LOCKED',
  'INFO_REQUESTED',
]);

// ── KYC enums (extended set for world-class identity layer) ──────────────────

export const kycLevelEnum = pgEnum('kyc_level', [
  'NONE',      // no verification
  'BASIC',     // Aadhaar only
  'STANDARD',  // + photo + liveness + face match
  'PREMIUM',   // + PAN + bank
  'ELITE',     // + address + employment
]);

export const kycEventTypeEnum = pgEnum('kyc_event_type', [
  'INITIATED',
  'AADHAAR_VERIFIED',
  'AADHAAR_FAILED',
  'PHOTO_ANALYZED',
  'LIVENESS_CHECKED',
  'FACE_MATCH_CHECKED',
  'PAN_VERIFIED',
  'PAN_FAILED',
  'BANK_VERIFIED',
  'BANK_FAILED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_VERIFIED',
  'DOCUMENT_REJECTED',
  'SANCTIONS_CHECKED',
  'SANCTIONS_HIT',
  'CRIMINAL_CHECKED',
  'ADDRESS_VERIFIED',
  'EMPLOYMENT_VERIFIED',
  'EDUCATION_VERIFIED',
  'RISK_SCORED',
  'AUTO_VERIFIED',
  'AUTO_REJECTED',
  'MANUAL_APPROVED',
  'MANUAL_REJECTED',
  'INFO_REQUESTED',
  'INFO_PROVIDED',
  'APPEAL_FILED',
  'APPEAL_UPHELD',
  'APPEAL_DENIED',
  'REVERIFICATION_REQUESTED',
  'EXPIRED',
  'LOCKED',
  'UNLOCKED',
  'LEVEL_UPGRADED',
]);

export const kycDocumentTypeEnum = pgEnum('kyc_document_type', [
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'VOTER_ID',
  'DRIVING_LICENSE',
  'EMPLOYMENT_LETTER',
  'EDUCATION_CERTIFICATE',
  'BANK_STATEMENT',
  'UTILITY_BILL',
  'SELFIE',
  'LIVENESS_VIDEO',
  'OTHER',
]);

export const kycDocumentStatusEnum = pgEnum('kyc_document_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
]);

export const kycAppealStatusEnum = pgEnum('kyc_appeal_status', [
  'PENDING',
  'UNDER_REVIEW',
  'UPHELD',
  'DENIED',
  'WITHDRAWN',
]);

export const premiumTierEnum = pgEnum('premium_tier', [
  'FREE',
  'STANDARD',
  'PREMIUM',
]);

// otpPurposeEnum removed — OTP is now handled by Better Auth's verification table

export const matchStatusEnum = pgEnum('match_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'BLOCKED',
  'EXPIRED',
]);

export const matchRequestPriorityEnum = pgEnum('match_request_priority', [
  'NORMAL',
  'SUPER_LIKE',
]);

export const reportCategoryEnum = pgEnum('report_category', [
  'HARASSMENT',
  'FAKE_PROFILE',
  'INAPPROPRIATE_CONTENT',
  'SCAM',
  'UNDERAGE',
  'SPAM',
  'OTHER',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
]);

export const vendorCategoryEnum = pgEnum('vendor_category', [
  'PHOTOGRAPHY',
  'VIDEOGRAPHY',
  'CATERING',
  'DECORATION',
  'VENUE',
  'MAKEUP',
  'JEWELLERY',
  'CLOTHING',
  'MUSIC',
  'LIGHTING',
  'SECURITY',
  'TRANSPORT',
  'PRIEST',
  'SOUND',
  'EVENT_HOSTING',
  'RENTAL',
  'OTHER',
]);

export const ceremonyTypeEnum = pgEnum('ceremony_type', [
  'WEDDING',
  'HALDI',
  'MEHNDI',
  'SANGEET',
  'ENGAGEMENT',
  'RECEPTION',
  'CORPORATE',
  'FESTIVAL',
  'COMMUNITY',
  'GOVERNMENT',
  'SCHOOL',
  'OTHER',
]);

export const ceremonyStatusEnum = pgEnum('ceremony_status', [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
]);

export const inquiryStatusEnum = pgEnum('inquiry_status', [
  'NEW',
  'REPLIED',
  'CONVERTED',
  'CLOSED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'UPI',
  'CARD',
  'NETBANKING',
  'WALLET',
  'EMI',
  'CASH',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'REFUND_PENDING',
]);

export const escrowStatusEnum = pgEnum('escrow_status', [
  'HELD',
  'RELEASED',
  'DISPUTED',
  'REFUNDED',
  'RELEASE_PENDING',
  'REFUND_PENDING',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_MATCH',
  'MATCH_ACCEPTED',
  'MATCH_DECLINED',
  'NEW_MESSAGE',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'ESCROW_RELEASED',
  'RSVP_RECEIVED',
  'TASK_DUE',
  'SYSTEM',
  'REFUND_REQUESTED',
  'REFUND_PROCESSED',
  'PAYOUT_INITIATED',
  'PAYOUT_FAILED',
  'INVOICE_AVAILABLE',
  'WALLET_CREDITED',
  'WALLET_DEBITED',
  'PAYMENT_LINK_RECEIVED',
  'PROMO_APPLIED',
  'NEW_BOOKING_REQUEST',
  'DISPUTE_RAISED_VENDOR',
  'DISPUTE_NEEDS_REVIEW',
  'DISPUTE_RESOLVED',
  'BUDGET_ALERT',
  'CEREMONY_REMINDER',
  'DAY_OF_CHECKIN',
  'INCIDENT_RAISED',
  'COORDINATOR_ASSIGNED',
]);

export const weddingStatusEnum = pgEnum('wedding_status', [
  'PLANNING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

export const rsvpStatusEnum = pgEnum('rsvp_status', [
  'PENDING',
  'YES',
  'NO',
  'MAYBE',
]);

export const mealPrefEnum = pgEnum('meal_preference', [
  'VEG',
  'NON_VEG',
  'JAIN',
  'VEGAN',
  'EGGETARIAN',
  'NO_PREFERENCE',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'USER_REGISTERED',
  'USER_VERIFIED',
  'USER_SUSPENDED',
  'KYC_SUBMITTED',
  'KYC_VERIFIED',
  'KYC_REJECTED',
  'MATCH_ACCEPTED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'REFUND_ISSUED',
  'ESCROW_HELD',
  'ESCROW_RELEASED',
  'ESCROW_DISPUTED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED_RELEASE',
  'DISPUTE_RESOLVED_REFUND',
  'DISPUTE_RESOLVED_SPLIT',
  'CONTRACT_SIGNED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'VENDOR_APPROVED',
  'PROFILE_BLOCKED',
  'PROFILE_REPORTED',
  'INVOICE_GENERATED',
  'INVOICE_CANCELLED',
  'WALLET_CREDIT',
  'WALLET_DEBIT',
  'PROMO_REDEEMED',
  'PAYOUT_INITIATED',
  'PAYOUT_COMPLETED',
  'PAYOUT_FAILED',
  'REFUND_REQUESTED',
  'REFUND_APPROVED',
  'REFUND_REJECTED',
  'PAYMENT_LINK_CREATED',
  'PAYMENT_LINK_PAID',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_DUPLICATE',
]);

export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'OTHER']);

export const maritalStatusEnum = pgEnum('marital_status', [
  'NEVER_MARRIED',
  'DIVORCED',
  'WIDOWED',
  'SEPARATED',
]);

export const dietEnum = pgEnum('diet', [
  'VEG',
  'NON_VEG',
  'JAIN',
  'VEGAN',
  'EGGETARIAN',
]);

export const smokingDrinkingEnum = pgEnum('smoking_drinking', [
  'NEVER',
  'OCCASIONALLY',
  'REGULARLY',
]);

export const familyTypeEnum = pgEnum('family_type', [
  'JOINT',
  'NUCLEAR',
  'EXTENDED',
]);

export const familyValuesEnum = pgEnum('family_values', [
  'TRADITIONAL',
  'MODERATE',
  'LIBERAL',
]);

export const familyStatusEnum = pgEnum('family_status', [
  'MIDDLE_CLASS',
  'UPPER_MIDDLE',
  'AFFLUENT',
]);

export const rashiEnum = pgEnum('rashi', [
  'MESH','VRISHABHA','MITHUN','KARK','SINGH','KANYA',
  'TULA','VRISHCHIK','DHANU','MAKAR','KUMBH','MEEN',
]);

export const nakshatraEnum = pgEnum('nakshatra', [
  'ASHWINI','BHARANI','KRITTIKA','ROHINI','MRIGASHIRA','ARDRA',
  'PUNARVASU','PUSHYA','ASHLESHA','MAGHA','PURVA_PHALGUNI','UTTARA_PHALGUNI',
  'HASTA','CHITRA','SWATI','VISHAKHA','ANURADHA','JYESHTHA',
  'MULA','PURVA_ASHADHA','UTTARA_ASHADHA','SHRAVANA','DHANISHTA',
  'SHATABHISHA','PURVA_BHADRAPADA','UTTARA_BHADRAPADA','REVATI',
]);

export const manglikStatusEnum = pgEnum('manglik_status', ['YES','NO','PARTIAL']);

// ── TABLES ───────────────────────────────────────────────────────────────────

// ── Auth — managed by Better Auth (see schema/auth.ts) ───────────────────────
// user, session, account, verification tables are in auth.ts.
// Re-export `user` here so other tables can reference it.
export { user, session, account, verification, twoFactor, authEvents } from './auth';

// ── Profiles ──────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               text('user_id').unique().notNull().references(() => user.id),
  mongoProfileId:       varchar('mongo_profile_id', { length: 24 }),
  verificationStatus:   verificationStatusEnum('verification_status').default('PENDING').notNull(),
  premiumTier:          premiumTierEnum('premium_tier').default('FREE').notNull(),
  profileCompleteness:  integer('profile_completeness').default(0), // 0-100
  isActive:             boolean('is_active').default(true).notNull(),
  lastActiveAt:         timestamp('last_active_at'),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  updatedAt:            timestamp('updated_at').defaultNow().notNull(),
  familyInclinationScore:   integer('family_inclination_score'),   // 0–100, null until user fills
  functionAttendanceScore:  integer('function_attendance_score'),  // 0–100, null until user fills
  stayQuotient:             varchar('stay_quotient', { length: 20 }), // INDEPENDENT | WITH_PARENTS | WITH_INLAWS | FLEXIBLE
  audioIntroKey:            varchar('audio_intro_key', { length: 500 }),
  videoIntroKey:            varchar('video_intro_key', { length: 500 }),
  latitude:                 decimal('latitude',  { precision: 9, scale: 6 }),
  longitude:                decimal('longitude', { precision: 9, scale: 6 }),
}, (t) => ({
  userIdx: index('profiles_user_idx').on(t.userId),
  statusIdx: index('profiles_status_idx').on(t.verificationStatus),
  latLngIdx: index('profiles_lat_lng_idx').on(t.latitude, t.longitude),
}));

export const profilePhotos = pgTable('profile_photos', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  r2Key:        varchar('r2_key', { length: 500 }).notNull(),
  isPrimary:    boolean('is_primary').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  uploadedAt:   timestamp('uploaded_at').defaultNow().notNull(),
  fileSize:     integer('file_size'),
  mimeType:     varchar('mime_type', { length: 50 }),
}, (t) => ({
  profileIdx: index('photos_profile_idx').on(t.profileId),
  orderIdx:   index('photos_order_idx').on(t.profileId, t.displayOrder),
}));

export const communityZones = pgTable('community_zones', {
  id:            uuid('id').primaryKey().defaultRandom(),
  profileId:     uuid('profile_id').unique().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  community:     varchar('community', { length: 100 }),      // e.g., 'Rajput', 'Brahmin', 'Jain'
  subCommunity:  varchar('sub_community', { length: 100 }),
  caste:         varchar('caste', { length: 80 }),           // optional caste / sub-caste, free-text
  gotra:         varchar('gotra', { length: 80 }),           // optional gotra (sapinda exclusion)
  gotraExclusionEnabled: boolean('gotra_exclusion_enabled').default(true).notNull(),
  motherTongue:  varchar('mother_tongue', { length: 50 }),   // primary mother tongue
  preferredLang: varchar('preferred_lang', { length: 10 }).default('hi'), // preferred UI/comm language
  lgbtqProfile:  boolean('lgbtq_profile').default(false),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});

export const profileSections = pgTable('profile_sections', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').unique().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  personal:    boolean('personal').notNull().default(false),
  family:      boolean('family').notNull().default(false),
  career:      boolean('career').notNull().default(false),
  lifestyle:   boolean('lifestyle').notNull().default(false),
  horoscope:   boolean('horoscope').notNull().default(false),
  photos:      boolean('photos').notNull().default(false),
  preferences: boolean('preferences').notNull().default(false),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const safetyModeUnlocks = pgTable('safety_mode_unlocks', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  unlockedFor: uuid('unlocked_for').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pairIdx: uniqueIndex('safety_unlock_pair_idx').on(t.profileId, t.unlockedFor),
}));

// ── KYC ─────────────────────────────────────────────────────────────────────

export const kycVerifications = pgTable('kyc_verifications', {
  id:               uuid('id').primaryKey().defaultRandom(),
  profileId:        uuid('profile_id').unique().notNull()
                      .references(() => profiles.id, { onDelete: 'cascade' }),

  // Aadhaar (DigiLocker)
  aadhaarVerified:  boolean('aadhaar_verified').default(false).notNull(),
  aadhaarRefId:     varchar('aadhaar_ref_id', { length: 100 }),   // DigiLocker ref, never Aadhaar number
  aadhaarVerifiedAt: timestamp('aadhaar_verified_at'),

  // Photo + Liveness + Face Match
  photoAnalysis:    jsonb('photo_analysis'),                        // PhotoAnalysis JSON
  selfieR2Key:      varchar('selfie_r2_key', { length: 500 }),
  livenessScore:    integer('liveness_score'),                      // 0-100
  livenessVideoR2Key: varchar('liveness_video_r2_key', { length: 500 }),
  livenessCheckedAt: timestamp('liveness_checked_at'),
  faceMatchScore:   integer('face_match_score'),                    // 0-100, selfie vs Aadhaar photo
  faceMatchCheckedAt: timestamp('face_match_checked_at'),

  // PAN
  panVerified:      boolean('pan_verified').default(false).notNull(),
  panRefId:         varchar('pan_ref_id', { length: 100 }),         // provider ref, never raw PAN
  panLast4:         varchar('pan_last4', { length: 4 }),            // masked last 4 chars only
  panVerifiedAt:    timestamp('pan_verified_at'),

  // Bank (penny-drop)
  bankVerified:     boolean('bank_verified').default(false).notNull(),
  bankRefId:        varchar('bank_ref_id', { length: 100 }),
  bankAccountLast4: varchar('bank_account_last4', { length: 4 }),
  bankIfsc:         varchar('bank_ifsc', { length: 11 }),
  bankVerifiedAt:   timestamp('bank_verified_at'),

  // Address
  addressVerified:  boolean('address_verified').default(false).notNull(),
  addressVerificationMethod: varchar('address_verification_method', { length: 30 }), // AADHAAR | UTILITY_BILL | BANK_STATEMENT
  addressVerifiedAt: timestamp('address_verified_at'),

  // Employment
  employmentVerified: boolean('employment_verified').default(false).notNull(),
  employmentMethod: varchar('employment_method', { length: 30 }),   // OFFER_LETTER | UAN | LINKEDIN
  employmentVerifiedAt: timestamp('employment_verified_at'),

  // Education
  educationVerified: boolean('education_verified').default(false).notNull(),
  educationVerifiedAt: timestamp('education_verified_at'),

  // Sanctions / Criminal
  sanctionsCheckedAt: timestamp('sanctions_checked_at'),
  sanctionsHit:     boolean('sanctions_hit').default(false).notNull(),
  sanctionsLists:   jsonb('sanctions_lists'),                       // {OFAC,UN,INTERPOL,…}
  criminalCheckRef: varchar('criminal_check_ref', { length: 100 }),
  criminalCheckedAt: timestamp('criminal_checked_at'),
  criminalCleared:  boolean('criminal_cleared').default(false).notNull(),

  // Risk + Level
  riskScore:        integer('risk_score'),                          // 0-100
  riskFactors:      jsonb('risk_factors'),                          // [{code,impact,detail}]
  verificationLevel: kycLevelEnum('verification_level').default('NONE').notNull(),

  // Soft duplicate detection
  duplicateFlag:    boolean('duplicate_flag').default(false).notNull(),
  duplicateReason:  text('duplicate_reason'),

  // Lifecycle
  expiresAt:        timestamp('expires_at'),                        // annual re-verification
  reverificationRequestedAt: timestamp('reverification_requested_at'),
  attemptCount:     integer('attempt_count').default(0).notNull(),
  lastAttemptAt:    timestamp('last_attempt_at'),
  lockedUntil:      timestamp('locked_until'),

  // Admin
  adminNote:        text('admin_note'),
  reviewedBy:       text('reviewed_by').references(() => user.id),
  reviewedAt:       timestamp('reviewed_at'),

  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  levelIdx:    index('kyc_level_idx').on(t.verificationLevel),
  expiresIdx:  index('kyc_expires_idx').on(t.expiresAt),
  riskIdx:     index('kyc_risk_idx').on(t.riskScore),
}));

export const kycAuditLog = pgTable('kyc_audit_log', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  eventType:   kycEventTypeEnum('event_type').notNull(),
  actorId:     text('actor_id').references(() => user.id),         // null = system
  actorRole:   varchar('actor_role', { length: 20 }),               // 'USER' | 'ADMIN' | 'SYSTEM'
  fromStatus:  verificationStatusEnum('from_status'),
  toStatus:    verificationStatusEnum('to_status'),
  fromLevel:   kycLevelEnum('from_level'),
  toLevel:     kycLevelEnum('to_level'),
  ipAddress:   varchar('ip_address', { length: 45 }),
  userAgent:   text('user_agent'),
  metadata:    jsonb('metadata'),                                   // {provider, refId, score, reason, …}
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx:   index('kyc_audit_profile_idx').on(t.profileId, t.createdAt),
  eventIdx:     index('kyc_audit_event_idx').on(t.eventType, t.createdAt),
}));

export const kycDocuments = pgTable('kyc_documents', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  documentType: kycDocumentTypeEnum('document_type').notNull(),
  status:       kycDocumentStatusEnum('status').default('PENDING').notNull(),
  r2Key:        varchar('r2_key', { length: 500 }).notNull(),
  documentLast4: varchar('document_last4', { length: 8 }),          // last 4 of doc number — never the full number
  expiresAt:    timestamp('expires_at'),                            // for passports/DLs
  uploadedAt:   timestamp('uploaded_at').defaultNow().notNull(),
  verifiedAt:   timestamp('verified_at'),
  verifiedBy:   text('verified_by').references(() => user.id),
  rejectionReason: text('rejection_reason'),
  metadata:     jsonb('metadata'),                                  // OCR result, provider response
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx:   index('kyc_doc_profile_idx').on(t.profileId),
  typeIdx:      index('kyc_doc_type_idx').on(t.documentType),
  uniquePerType: uniqueIndex('kyc_doc_unique_active').on(t.profileId, t.documentType),
}));

export const kycAppeals = pgTable('kyc_appeals', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  rejectionContext: text('rejection_context'),                      // snapshot of admin note at time of rejection
  userMessage:  text('user_message').notNull(),
  evidenceR2Keys: jsonb('evidence_r2_keys'),                        // string[] of additional supporting docs
  status:       kycAppealStatusEnum('status').default('PENDING').notNull(),
  resolverId:   text('resolver_id').references(() => user.id),
  resolverNote: text('resolver_note'),
  resolvedAt:   timestamp('resolved_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx:   index('kyc_appeal_profile_idx').on(t.profileId),
  statusIdx:    index('kyc_appeal_status_idx').on(t.status),
}));

// ── Matchmaking ───────────────────────────────────────────────────────────────

export const matchRequests = pgTable('match_requests', {
  id:                uuid('id').primaryKey().defaultRandom(),
  senderId:          uuid('sender_id').notNull().references(() => profiles.id),
  receiverId:        uuid('receiver_id').notNull().references(() => profiles.id),
  status:            matchStatusEnum('status').default('PENDING').notNull(),
  priority:          matchRequestPriorityEnum('priority').default('NORMAL').notNull(),
  message:           text('message'),
  acceptanceMessage: text('acceptance_message'),
  declineReason:     varchar('decline_reason', { length: 64 }),
  seenAt:            timestamp('seen_at'),
  respondedAt:       timestamp('responded_at'),
  expiresAt:         timestamp('expires_at'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  senderIdx:    index('match_sender_idx').on(t.senderId),
  receiverIdx:  index('match_receiver_idx').on(t.receiverId),
  statusIdx:    index('match_status_idx').on(t.status),
  expiresIdx:   index('match_expires_idx').on(t.expiresAt),
  uniquePair:   uniqueIndex('match_unique_pair').on(t.senderId, t.receiverId),
}));

export const matchScores = pgTable('match_scores', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileA:       uuid('profile_a').notNull().references(() => profiles.id),
  profileB:       uuid('profile_b').notNull().references(() => profiles.id),
  totalScore:     integer('total_score').notNull(),    // 0-100
  breakdown:      jsonb('breakdown'),                  // per-dimension scores
  gunaMilanScore: integer('guna_milan_score'),         // 0-36
  computedAt:     timestamp('computed_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  pairIdx: uniqueIndex('score_pair_idx').on(t.profileA, t.profileB),
}));

export const blockedUsers = pgTable('blocked_users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  blockerId:  uuid('blocker_id').notNull().references(() => profiles.id),
  blockedId:  uuid('blocked_id').notNull().references(() => profiles.id),
  reason:     text('reason'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueBlock:  uniqueIndex('unique_block').on(t.blockerId, t.blockedId),
  blockerIdx:   index('block_blocker_idx').on(t.blockerId),
  blockedIdx:   index('block_blocked_idx').on(t.blockedId),
}));

export const matchRequestReports = pgTable('match_request_reports', {
  id:           uuid('id').primaryKey().defaultRandom(),
  reporterId:   uuid('reporter_id').notNull().references(() => profiles.id),
  reportedId:   uuid('reported_id').notNull().references(() => profiles.id),
  requestId:    uuid('request_id').references(() => matchRequests.id),
  category:     reportCategoryEnum('category').notNull(),
  details:      text('details'),
  status:       reportStatusEnum('status').default('OPEN').notNull(),
  resolverId:   text('resolver_id'),
  resolverNote: text('resolver_note'),
  resolvedAt:   timestamp('resolved_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  reporterIdx:  index('report_reporter_idx').on(t.reporterId),
  reportedIdx:  index('report_reported_idx').on(t.reportedId),
  statusIdx:    index('report_status_idx').on(t.status),
}));

// ── Vendors ───────────────────────────────────────────────────────────────────

export const vendors = pgTable('vendors', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         text('user_id').unique().notNull().references(() => user.id),
  mongoPortfolioId: varchar('mongo_portfolio_id', { length: 24 }),
  businessName:   varchar('business_name', { length: 255 }).notNull(),
  category:       vendorCategoryEnum('category').notNull(),
  city:           varchar('city', { length: 100 }).notNull(),
  state:          varchar('state', { length: 100 }).notNull(),
  verified:       boolean('verified').default(false).notNull(),
  rating:         decimal('rating', { precision: 3, scale: 2 }).default('0'),
  totalReviews:   integer('total_reviews').default(0).notNull(),
  isActive:       boolean('is_active').default(true).notNull(),
  // Extended profile fields
  tagline:        varchar('tagline', { length: 255 }),
  description:    text('description'),
  coverImageKey:  varchar('cover_image_key', { length: 500 }),
  phone:          varchar('phone', { length: 20 }),
  email:          varchar('email', { length: 255 }),
  website:        varchar('website', { length: 500 }),
  instagram:      varchar('instagram', { length: 255 }),
  yearsActive:    integer('years_active'),
  responseTimeHours: integer('response_time_hours').default(24),
  priceMin:       decimal('price_min', { precision: 12, scale: 2 }),
  priceMax:       decimal('price_max', { precision: 12, scale: 2 }),
  viewCount:      integer('view_count').default(0).notNull(),
  favoriteCount:  integer('favorite_count').default(0).notNull(),
  commissionPct:  decimal('commission_pct', { precision: 5, scale: 2 }).default('3.00').notNull(),
  bankVerificationStatus: varchar('bank_verification_status', { length: 16 }).default('PENDING').notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  cityIdx:       index('vendor_city_idx').on(t.city),
  categoryIdx:   index('vendor_category_idx').on(t.category),
  ratingIdx:     index('vendor_rating_idx').on(t.rating),
  popularityIdx: index('vendor_popularity_idx').on(t.totalReviews),
  verifiedIdx:   index('vendor_verified_active_idx').on(t.verified, t.isActive),
}));

export const vendorServices = pgTable('vendor_services', {
  id:           uuid('id').primaryKey().defaultRandom(),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 255 }).notNull(),
  description:  text('description'),
  priceFrom:    decimal('price_from', { precision: 12, scale: 2 }),
  priceTo:      decimal('price_to', { precision: 12, scale: 2 }),
  priceUnit:    varchar('price_unit', { length: 50 }),   // PER_EVENT | PER_HOUR | PER_PERSON
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const vendorEventTypes = pgTable('vendor_event_types', {
  id:         uuid('id').primaryKey().defaultRandom(),
  vendorId:   uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  eventType:  ceremonyTypeEnum('event_type').notNull(),
  available:  boolean('available').default(true).notNull(),
}, (t) => ({
  uniqueVendorEvent: uniqueIndex('unique_vendor_event').on(t.vendorId, t.eventType),
}));

// ── Bookings ──────────────────────────────────────────────────────────────────

export const bookings = pgTable('bookings', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     text('customer_id').notNull().references(() => user.id),
  vendorId:       uuid('vendor_id').notNull().references(() => vendors.id),
  serviceId:      uuid('service_id').references(() => vendorServices.id),
  weddingId:      uuid('wedding_id').references((): any => weddings.id, { onDelete: 'set null' }),
  ceremonyId:     uuid('ceremony_id').references((): any => ceremonies.id, { onDelete: 'set null' }),
  eventDate:      date('event_date').notNull(),
  ceremonyType:   ceremonyTypeEnum('ceremony_type').notNull().default('WEDDING'),
  status:         bookingStatusEnum('status').default('PENDING').notNull(),
  totalAmount:    decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  notes:          text('notes'),
  // Package + extras
  packageName:    varchar('package_name', { length: 255 }),
  packagePrice:   decimal('package_price', { precision: 12, scale: 2 }),
  guestCount:     integer('guest_count'),
  eventLocation:  varchar('event_location', { length: 500 }),
  // Reschedule request workflow
  proposedDate:        date('proposed_date'),
  proposedBy:          text('proposed_by').references(() => user.id),
  proposedReason:      text('proposed_reason'),
  proposedAt:          timestamp('proposed_at'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx:  index('booking_customer_idx').on(t.customerId),
  vendorIdx:    index('booking_vendor_idx').on(t.vendorId),
  dateIdx:      index('booking_date_idx').on(t.eventDate),
  statusIdx:    index('booking_status_idx').on(t.status),
  weddingIdx:   index('booking_wedding_idx').on(t.weddingId),
  ceremonyIdx:  index('booking_ceremony_idx').on(t.ceremonyId),
}));

// ── Booking add-ons / line items ──────────────────────────────────────────────

export const bookingAddons = pgTable('booking_addons', {
  id:         uuid('id').primaryKey().defaultRandom(),
  bookingId:  uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 255 }).notNull(),
  quantity:   integer('quantity').default(1).notNull(),
  unitPrice:  decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  notes:      text('notes'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  bookingIdx: index('addon_booking_idx').on(t.bookingId),
}));

// ── Payments ──────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  bookingId:            uuid('booking_id').notNull().references(() => bookings.id),
  amount:               decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:             varchar('currency', { length: 3 }).default('INR').notNull(),
  method:               paymentMethodEnum('method'),
  status:               paymentStatusEnum('status').default('PENDING').notNull(),
  razorpayOrderId:      varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId:    varchar('razorpay_payment_id', { length: 255 }),
  razorpaySignature:    varchar('razorpay_signature', { length: 500 }),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  settledAt:            timestamp('settled_at'),
}, (t) => ({
  bookingIdx: index('payment_booking_idx').on(t.bookingId),
  statusIdx:  index('payment_status_idx').on(t.status),
}));

export const escrowAccounts = pgTable('escrow_accounts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  bookingId:        uuid('booking_id').unique().notNull().references(() => bookings.id),
  totalHeld:        decimal('total_held', { precision: 12, scale: 2 }).notNull(),
  released:         decimal('released', { precision: 12, scale: 2 }).default('0').notNull(),
  status:           escrowStatusEnum('status').default('HELD').notNull(),
  releaseDueAt:     timestamp('release_due_at'),     // 48h after event completion
  releasedAt:       timestamp('released_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx:     index('escrow_status_idx').on(t.status),
  releaseDueIdx: index('escrow_release_due_idx').on(t.releaseDueAt, t.status),
}));

// ── Vendor Reviews ────────────────────────────────────────────────────────────

export const vendorReviews = pgTable('vendor_reviews', {
  id:               uuid('id').primaryKey().defaultRandom(),
  vendorId:         uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  bookingId:        uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  reviewerId:       text('reviewer_id').notNull().references(() => user.id),
  rating:           integer('rating').notNull(),
  title:            varchar('title', { length: 200 }),
  comment:          text('comment'),
  vendorReply:      text('vendor_reply'),
  vendorRepliedAt:  timestamp('vendor_replied_at'),
  isHidden:         boolean('is_hidden').default(false).notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:           index('review_vendor_idx').on(t.vendorId),
  reviewerIdx:         index('review_reviewer_idx').on(t.reviewerId),
  uniqueBookingReview: uniqueIndex('unique_booking_review').on(t.bookingId),
}));

// ── Vendor Favorites ──────────────────────────────────────────────────────────

export const vendorFavorites = pgTable('vendor_favorites', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    text('user_id').notNull().references(() => user.id),
  vendorId:  uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueFav: uniqueIndex('unique_user_vendor_fav').on(t.userId, t.vendorId),
  userIdx:   index('vendor_fav_user_idx').on(t.userId),
}));

// ── Vendor Inquiries (no commitment, before booking) ─────────────────────────

export const vendorInquiries = pgTable('vendor_inquiries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  customerId:   text('customer_id').notNull().references(() => user.id),
  ceremonyType: ceremonyTypeEnum('ceremony_type'),
  eventDate:    date('event_date'),
  guestCount:   integer('guest_count'),
  budgetMin:    decimal('budget_min', { precision: 12, scale: 2 }),
  budgetMax:    decimal('budget_max', { precision: 12, scale: 2 }),
  message:      text('message').notNull(),
  vendorReply:  text('vendor_reply'),
  repliedAt:    timestamp('replied_at'),
  status:       inquiryStatusEnum('status').default('NEW').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:    index('inquiry_vendor_idx').on(t.vendorId),
  customerIdx:  index('inquiry_customer_idx').on(t.customerId),
  statusIdx:    index('inquiry_status_idx').on(t.status),
}));

// ── Vendor Blocked Dates ──────────────────────────────────────────────────────

export const vendorBlockedDates = pgTable('vendor_blocked_dates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  vendorId:  uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  date:      date('date').notNull(),
  reason:    varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueDate: uniqueIndex('unique_vendor_blocked_date').on(t.vendorId, t.date),
  vendorIdx:  index('blocked_vendor_idx').on(t.vendorId),
}));

// ── Audit Log (IMMUTABLE — never update or delete) ────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  eventType:    auditEventTypeEnum('event_type').notNull(),
  entityType:   varchar('entity_type', { length: 50 }).notNull(),
  entityId:     uuid('entity_id').notNull(),
  actorId:      text('actor_id').references(() => user.id),
  payload:      jsonb('payload'),
  contentHash:  varchar('content_hash', { length: 64 }).notNull(),
  prevHash:     varchar('prev_hash', { length: 64 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  // NO updatedAt — this table is append-only
}, (t) => ({
  entityIdx:  index('audit_entity_idx').on(t.entityType, t.entityId),
  actorIdx:   index('audit_actor_idx').on(t.actorId),
  createdIdx: index('audit_created_idx').on(t.createdAt),
}));

// ── Weddings ──────────────────────────────────────────────────────────────────

export const weddings = pgTable('weddings', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  profileId:          uuid('profile_id').notNull().references(() => profiles.id),
  partnerProfileId:   uuid('partner_profile_id').references(() => profiles.id),
  mongoWeddingPlanId: varchar('mongo_wedding_plan_id', { length: 24 }),
  title:              varchar('title', { length: 255 }),
  weddingDate:        date('wedding_date'),
  venueName:          varchar('venue_name', { length: 255 }),
  venueCity:          varchar('venue_city', { length: 100 }),
  venueAddress:       text('venue_address'),
  budgetTotal:        decimal('budget_total', { precision: 12, scale: 2 }),
  guestCount:         integer('guest_count'),
  brideName:          varchar('bride_name', { length: 255 }),
  groomName:          varchar('groom_name', { length: 255 }),
  hashtag:            varchar('hashtag', { length: 80 }),
  primaryColor:       varchar('primary_color', { length: 20 }),
  status:             weddingStatusEnum('status').default('PLANNING').notNull(),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx: index('weddings_profile_idx').on(t.profileId),
  statusIdx:  index('weddings_status_idx').on(t.status),
}));

export const weddingMembers = pgTable('wedding_members', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  userId:       text('user_id').notNull().references(() => user.id),
  role:         varchar('role', { length: 50 }).default('VIEWER').notNull(),  // VIEWER | EDITOR | OWNER
  invitedAt:    timestamp('invited_at').defaultNow().notNull(),
  acceptedAt:   timestamp('accepted_at'),
}, (t) => ({
  uniqueMember: uniqueIndex('unique_wedding_member').on(t.weddingId, t.userId),
  userIdx:      index('wedding_member_user_idx').on(t.userId),
}));

export const weddingTasks = pgTable('wedding_tasks', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  parentTaskId: uuid('parent_task_id'),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  dueDate:      date('due_date'),
  status:       varchar('status', { length: 20 }).default('TODO').notNull(), // TODO | IN_PROGRESS | DONE | BLOCKED
  priority:     varchar('priority', { length: 10 }).default('MEDIUM').notNull(), // LOW | MEDIUM | HIGH | URGENT
  assignedTo:   text('assigned_to').references(() => user.id),
  category:     varchar('category', { length: 50 }),  // Venue | Catering | etc.
  tags:         text('tags').array().default([]),
  estimatedHours: decimal('estimated_hours', { precision: 6, scale: 2 }),
  completedAt:  timestamp('completed_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('task_wedding_idx').on(t.weddingId),
  statusIdx:  index('task_status_idx').on(t.status),
  parentIdx:  index('task_parent_idx').on(t.parentTaskId),
}));

// ── Guests ────────────────────────────────────────────────────────────────────

export const guestLists = pgTable('guest_lists', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').unique().notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  createdBy:  text('created_by').notNull().references(() => user.id),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});

export const guests = pgTable('guests', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  guestListId:        uuid('guest_list_id').notNull().references(() => guestLists.id, { onDelete: 'cascade' }),
  name:               varchar('name', { length: 255 }).notNull(),
  phone:              varchar('phone', { length: 15 }),
  email:              varchar('email', { length: 255 }),
  relationship:       varchar('relationship', { length: 100 }),
  side:               varchar('side', { length: 10 }),         // BRIDE | GROOM | BOTH
  rsvpStatus:         rsvpStatusEnum('rsvp_status').default('PENDING').notNull(),
  mealPreference:     mealPrefEnum('meal_preference').default('NO_PREFERENCE').notNull(),
  roomNumber:         varchar('room_number', { length: 20 }),
  plusOnes:           integer('plus_ones').default(0).notNull(),
  plusOneNames:       jsonb('plus_one_names'),                 // string[]
  ageGroup:           varchar('age_group', { length: 10 }).default('ADULT').notNull(),  // ADULT | CHILD | INFANT
  isVip:              boolean('is_vip').default(false).notNull(),
  dietaryNotes:       text('dietary_notes'),
  accessibilityNotes: text('accessibility_notes'),
  invitedToCeremonies: text('invited_to_ceremonies').array().default([]),  // ceremonyId[] (legacy — see guestCeremonyInvites junction)
  arrivedAt:          timestamp('arrived_at'),
  checkedInBy:        text('checked_in_by').references(() => user.id),
  notes:              text('notes'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  listIdx:    index('guest_list_idx').on(t.guestListId),
  rsvpIdx:    index('guest_rsvp_idx').on(t.guestListId, t.rsvpStatus),
  arrivedIdx: index('guest_arrived_idx').on(t.guestListId, t.arrivedAt),
}));

export const invitations = pgTable('invitations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  guestId:      uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  type:         varchar('type', { length: 20 }).default('INVITATION').notNull(),  // SAVE_THE_DATE | INVITATION | RSVP_REMINDER | THANK_YOU
  sentAt:       timestamp('sent_at').defaultNow().notNull(),
  channel:      varchar('channel', { length: 20 }).notNull(),  // EMAIL | SMS | WHATSAPP
  openedAt:     timestamp('opened_at'),
  rsvpAt:       timestamp('rsvp_at'),
  messageId:    varchar('message_id', { length: 255 }),  // provider message ID
  errorMessage: text('error_message'),
}, (t) => ({
  guestIdx: index('inv_guest_idx').on(t.guestId),
}));

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type:       notificationTypeEnum('type').notNull(),
  title:      varchar('title', { length: 255 }).notNull(),
  body:       text('body').notNull(),
  data:       jsonb('data'),
  read:       boolean('read').default(false).notNull(),
  sentVia:    text('sent_via').array(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx:  index('notif_user_idx').on(t.userId),
  readIdx:  index('notif_read_idx').on(t.userId, t.read),
}));

export const notificationPreferences = pgTable('notification_preferences', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     text('user_id').unique().notNull().references(() => user.id, { onDelete: 'cascade' }),
  push:       boolean('push').default(true).notNull(),
  sms:        boolean('sms').default(true).notNull(),
  email:      boolean('email').default(true).notNull(),
  inApp:      boolean('in_app').default(true).notNull(),
  marketing:  boolean('marketing').default(false).notNull(),
  // Per-event toggles (jsonb keyed by NotificationType — opt-out list).
  // Empty/missing = subscribed to all events at the channel level above.
  mutedTypes: jsonb('muted_types').default([]).notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});

export const deviceTokens = pgTable('device_tokens', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token:      text('token').notNull(),
  platform:   varchar('platform', { length: 16 }).notNull(),       // ios | android | web
  appVersion: varchar('app_version', { length: 32 }),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex('device_tokens_token_idx').on(t.token),
  userIdx:  index('device_tokens_user_idx').on(t.userId),
}));


// ── E-Commerce ────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum('order_status', [
  'PLACED',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const products = pgTable('products', {
  id:               uuid('id').primaryKey().defaultRandom(),
  vendorId:         uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:             varchar('name', { length: 255 }).notNull(),
  description:      text('description'),
  category:         varchar('category', { length: 100 }).notNull(),
  price:            decimal('price', { precision: 12, scale: 2 }).notNull(),
  comparePrice:     decimal('compare_price', { precision: 12, scale: 2 }),
  stockQty:         integer('stock_qty').default(0).notNull(),
  sku:              varchar('sku', { length: 100 }),
  r2ImageKeys:      text('r2_image_keys').array(),
  isActive:         boolean('is_active').default(true).notNull(),
  isFeatured:       boolean('is_featured').default(false).notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:    index('product_vendor_idx').on(t.vendorId),
  categoryIdx:  index('product_category_idx').on(t.category),
  activeIdx:    index('product_active_idx').on(t.isActive),
}));

export const orders = pgTable('orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  customerId:           text('customer_id').notNull().references(() => user.id),
  status:               orderStatusEnum('status').default('PLACED').notNull(),
  subtotal:             decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  shippingFee:          decimal('shipping_fee', { precision: 12, scale: 2 }).default('0').notNull(),
  total:                decimal('total', { precision: 12, scale: 2 }).notNull(),
  shippingAddress:      jsonb('shipping_address').notNull(),
  razorpayOrderId:      varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId:    varchar('razorpay_payment_id', { length: 255 }),
  notes:                text('notes'),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  updatedAt:            timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx:  index('order_customer_idx').on(t.customerId),
  statusIdx:    index('order_status_idx').on(t.status),
}));

export const orderItems = pgTable('order_items', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  orderId:            uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId:          uuid('product_id').notNull().references(() => products.id),
  vendorId:           uuid('vendor_id').notNull().references(() => vendors.id),
  quantity:           integer('quantity').notNull(),
  unitPrice:          decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal:           decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  fulfilmentStatus:   varchar('fulfilment_status', { length: 20 }).default('PENDING').notNull(),
  trackingNumber:     varchar('tracking_number', { length: 255 }),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orderIdx:   index('order_item_order_idx').on(t.orderId),
  vendorIdx:  index('order_item_vendor_idx').on(t.vendorId),
}));

// ── Ceremonies ───────────────────────────────────────────────────────────────

export const ceremonies = pgTable('ceremonies', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  type:         ceremonyTypeEnum('type').notNull(),
  status:       ceremonyStatusEnum('status').default('SCHEDULED').notNull(),
  date:         date('date'),
  venue:        varchar('venue', { length: 255 }),
  venueAddress: text('venue_address'),
  startTime:    varchar('start_time', { length: 10 }),
  endTime:      varchar('end_time', { length: 10 }),
  dressCode:    varchar('dress_code', { length: 100 }),
  expectedGuests: integer('expected_guests'),
  isPublic:     boolean('is_public').default(false).notNull(),
  notes:        text('notes'),
  startedAt:    timestamp('started_at'),
  completedAt:  timestamp('completed_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('ceremonies_wedding_idx').on(t.weddingId),
  dateIdx:    index('ceremonies_date_idx').on(t.weddingId, t.date),
  statusIdx:  index('ceremonies_status_idx').on(t.weddingId, t.status),
}));

// ── Rentals ───────────────────────────────────────────────────────────────────

export const rentalCategoryEnum = pgEnum('rental_category', [
  'DECOR', 'COSTUME', 'AV_EQUIPMENT', 'FURNITURE', 'LIGHTING', 'TABLEWARE', 'OTHER',
]);

export const rentalItems = pgTable('rental_items', {
  id:           uuid('id').primaryKey().defaultRandom(),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 255 }).notNull(),
  description:  text('description'),
  category:     rentalCategoryEnum('category').notNull(),
  pricePerDay:  decimal('price_per_day', { precision: 12, scale: 2 }).notNull(),
  deposit:      decimal('deposit', { precision: 12, scale: 2 }).default('0').notNull(),
  stockQty:     integer('stock_qty').default(1).notNull(),
  r2ImageKeys:  text('r2_image_keys').array().default([]),
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:   index('rental_items_vendor_idx').on(t.vendorId),
  categoryIdx: index('rental_items_category_idx').on(t.category),
}));

export const rentalBookingStatusEnum = pgEnum('rental_booking_status', [
  'PENDING', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED', 'OVERDUE', 'DISPUTED',
]);

export const rentalBookings = pgTable('rental_bookings', {
  id:           uuid('id').primaryKey().defaultRandom(),
  rentalItemId: uuid('rental_item_id').notNull().references(() => rentalItems.id),
  customerId:   text('customer_id').notNull().references(() => user.id),
  fromDate:     date('from_date').notNull(),
  toDate:       date('to_date').notNull(),
  quantity:     integer('quantity').default(1).notNull(),
  totalAmount:  decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  depositPaid:  decimal('deposit_paid', { precision: 12, scale: 2 }).default('0').notNull(),
  status:       rentalBookingStatusEnum('status').default('PENDING').notNull(),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  itemIdx:     index('rental_bookings_item_idx').on(t.rentalItemId),
  customerIdx: index('rental_bookings_customer_idx').on(t.customerId),
}));

// ── RELATIONS ─────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
  profile:       one(profiles,       { fields: [user.id], references: [profiles.userId] }),
  vendor:        one(vendors,        { fields: [user.id], references: [vendors.userId] }),
  notifications: many(notifications),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user:             one(user,         { fields: [profiles.userId], references: [user.id] }),
  photos:           many(profilePhotos),
  communityZone:    one(communityZones, { fields: [profiles.id], references: [communityZones.profileId] }),
  kycVerification:  one(kycVerifications, { fields: [profiles.id], references: [kycVerifications.profileId] }),
  sections:         one(profileSections, { fields: [profiles.id], references: [profileSections.profileId] }),
  sentRequests:     many(matchRequests, { relationName: 'sender' }),
  receivedRequests: many(matchRequests, { relationName: 'receiver' }),
  weddings:         many(weddings),
}));

export const kycVerificationsRelations = relations(kycVerifications, ({ one, many }) => ({
  profile:  one(profiles,  { fields: [kycVerifications.profileId],  references: [profiles.id] }),
  reviewer: one(user,      { fields: [kycVerifications.reviewedBy], references: [user.id] }),
  documents: many(kycDocuments),
  appeals:   many(kycAppeals),
  auditLog:  many(kycAuditLog),
}));

export const kycAuditLogRelations = relations(kycAuditLog, ({ one }) => ({
  profile: one(profiles, { fields: [kycAuditLog.profileId], references: [profiles.id] }),
  actor:   one(user,     { fields: [kycAuditLog.actorId],   references: [user.id] }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  profile:  one(profiles, { fields: [kycDocuments.profileId],  references: [profiles.id] }),
  verifier: one(user,     { fields: [kycDocuments.verifiedBy], references: [user.id] }),
}));

export const kycAppealsRelations = relations(kycAppeals, ({ one }) => ({
  profile:  one(profiles, { fields: [kycAppeals.profileId], references: [profiles.id] }),
  resolver: one(user,     { fields: [kycAppeals.resolverId], references: [user.id] }),
}));

export const profileSectionsRelations = relations(profileSections, ({ one }) => ({
  profile: one(profiles, { fields: [profileSections.profileId], references: [profiles.id] }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user:         one(user,          { fields: [vendors.userId], references: [user.id] }),
  services:     many(vendorServices),
  eventTypes:   many(vendorEventTypes),
  bookings:     many(bookings),
  reviews:      many(vendorReviews),
  inquiries:    many(vendorInquiries),
  blockedDates: many(vendorBlockedDates),
  favorites:    many(vendorFavorites),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer:   one(user,     { fields: [bookings.customerId], references: [user.id] }),
  vendor:     one(vendors,  { fields: [bookings.vendorId],   references: [vendors.id] }),
  service:    one(vendorServices, { fields: [bookings.serviceId], references: [vendorServices.id] }),
  payment:    one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  escrow:     one(escrowAccounts, { fields: [bookings.id], references: [escrowAccounts.bookingId] }),
  addons:     many(bookingAddons),
  review:     one(vendorReviews, { fields: [bookings.id], references: [vendorReviews.bookingId] }),
}));

export const vendorReviewsRelations = relations(vendorReviews, ({ one }) => ({
  vendor:   one(vendors, { fields: [vendorReviews.vendorId],   references: [vendors.id] }),
  booking:  one(bookings, { fields: [vendorReviews.bookingId], references: [bookings.id] }),
  reviewer: one(user,    { fields: [vendorReviews.reviewerId], references: [user.id] }),
}));

export const vendorInquiriesRelations = relations(vendorInquiries, ({ one }) => ({
  vendor:   one(vendors, { fields: [vendorInquiries.vendorId],   references: [vendors.id] }),
  customer: one(user,    { fields: [vendorInquiries.customerId], references: [user.id] }),
}));

export const vendorFavoritesRelations = relations(vendorFavorites, ({ one }) => ({
  user:   one(user,    { fields: [vendorFavorites.userId],   references: [user.id] }),
  vendor: one(vendors, { fields: [vendorFavorites.vendorId], references: [vendors.id] }),
}));

export const vendorBlockedDatesRelations = relations(vendorBlockedDates, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorBlockedDates.vendorId], references: [vendors.id] }),
}));

export const bookingAddonsRelations = relations(bookingAddons, ({ one }) => ({
  booking: one(bookings, { fields: [bookingAddons.bookingId], references: [bookings.id] }),
}));

export const weddingsRelations = relations(weddings, ({ one, many }) => ({
  profile:    one(profiles, { fields: [weddings.profileId], references: [profiles.id] }),
  members:    many(weddingMembers),
  tasks:      many(weddingTasks),
  guestList:  one(guestLists, { fields: [weddings.id], references: [guestLists.weddingId] }),
  ceremonies: many(ceremonies),
}));

export const ceremoniesRelations = relations(ceremonies, ({ one }) => ({
  wedding: one(weddings, { fields: [ceremonies.weddingId], references: [weddings.id] }),
}));

export const rentalItemsRelations = relations(rentalItems, ({ one, many }) => ({
  vendor:   one(vendors,       { fields: [rentalItems.vendorId], references: [vendors.id] }),
  bookings: many(rentalBookings),
}));

export const rentalBookingsRelations = relations(rentalBookings, ({ one }) => ({
  item:     one(rentalItems, { fields: [rentalBookings.rentalItemId], references: [rentalItems.id] }),
  customer: one(user,        { fields: [rentalBookings.customerId],   references: [user.id] }),
}));

// ── Shortlists (Phase 3) ──────────────────────────────────────────────────────
export { shortlists } from './shortlists';

// ── Profile Views ("Who viewed me") ──────────────────────────────────────────
export { profileViews } from './profileViews';

// ── Profile Boosts (24h paid visibility) ─────────────────────────────────────
export { profileBoosts, boostStatusEnum } from './boosts';

// ── Finance (refunds, invoices, wallet, promo, payouts, webhooks, payment links, methods) ──
export {
  refundStatusEnum, refundReasonEnum, invoiceStatusEnum, payoutStatusEnum,
  walletTxnTypeEnum, walletTxnReasonEnum, promoTypeEnum, promoScopeEnum,
  paymentLinkStatusEnum, webhookEventStatusEnum, paymentInstrumentEnum,
  planTierEnum, planIntervalEnum, subscriptionStatusEnum, reconciliationStatusEnum,
  webhookEvents, refunds, invoices, invoiceSequences, payouts,
  wallets, walletTransactions, promoCodes, promoRedemptions,
  paymentLinks, paymentMethods,
  plans, subscriptions, subscriptionCharges, paymentSplits,
  reconciliationDiscrepancies, disputeResolutions, chatReports,
} from './finance';

// ── Profile of the Day (daily spotlight) ─────────────────────────────────────
export { profileOfDay } from './profileOfDay';

// ── Wedding Planning Extras (expenses, timeline, seating, docs, etc.) ───────
export {
  // enums
  weddingExpenseStatusEnum, weddingDocumentTypeEnum, moodBoardCategoryEnum,
  tableShapeEnum, weddingMemberRoleEnum, vendorAssignmentStatusEnum,
  vendorAssignmentRoleEnum, invitationTypeEnum, guestAgeGroupEnum,
  weddingReminderTypeEnum, giftRegistryStatusEnum,
  incidentSeverityEnum, coordinatorScopeEnum,
  // tables
  weddingExpenses, weddingTimelineEvents, weddingSeatingTables,
  weddingSeatingAssignments, weddingDocuments, weddingMoodBoardItems,
  weddingActivityLog, weddingMemberInvites, weddingVendorAssignments,
  weddingTaskComments, weddingTaskAttachments, weddingWebsites,
  giftRegistryItems, weddingReminders, rsvpTokens,
  weddingCoordinatorAssignments, guestCeremonyInvites, weddingIncidents,
  rsvpCustomQuestions, rsvpCustomAnswers, guestAddresses,
  rsvpDeadlines, invitationBatches, rsvpQuestionTypeEnum,
} from './weddingExtras';

export {
  familyMembers, familyVerifications,
  familyRelationshipEnum, familyVerificationBadgeEnum,
} from './familyExtras';
