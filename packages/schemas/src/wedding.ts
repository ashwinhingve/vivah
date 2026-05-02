import { z } from 'zod';

export const CreateWeddingSchema = z.object({
  weddingDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venueName:    z.string().max(255).optional(),
  venueCity:    z.string().max(100).optional(),
  venueAddress: z.string().max(500).optional(),
  budgetTotal:  z.number().positive().optional(),
  title:        z.string().max(255).optional(),
  brideName:    z.string().max(255).optional(),
  groomName:    z.string().max(255).optional(),
  hashtag:      z.string().max(80).regex(/^#?[a-zA-Z0-9_]+$/, 'hashtag must be alphanumeric').optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const UpdateWeddingSchema = CreateWeddingSchema;

export const CreateTaskSchema = z.object({
  title:      z.string().min(1).max(255),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority:   z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  assignedTo: z.string().uuid().optional(),
  notes:      z.string().max(1000).optional(),
});

export const UpdateTaskSchema = z.object({
  title:      z.string().min(1).max(255).optional(),
  status:     z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority:   z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignedTo: z.string().uuid().optional(),
  notes:      z.string().max(1000).optional(),
});

export const UpdateBudgetSchema = z.object({
  categories: z.array(z.object({
    name:      z.string().min(1).max(100),
    allocated: z.number().min(0),
    spent:     z.number().min(0),
  })),
});

export const MealPrefEnum   = z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE']);
export const RsvpStatusEnum  = z.enum(['PENDING', 'YES', 'NO', 'MAYBE']);
export const GuestSideEnum   = z.enum(['BRIDE', 'GROOM', 'BOTH']);
export const GuestAgeEnum    = z.enum(['ADULT', 'CHILD', 'INFANT']);
export const InvChannelEnum  = z.enum(['EMAIL', 'SMS', 'WHATSAPP']);
export const InvTypeEnum     = z.enum(['SAVE_THE_DATE', 'INVITATION', 'RSVP_REMINDER', 'THANK_YOU']);

export const AddGuestSchema = z.object({
  name:                z.string().min(1).max(255),
  phone:               z.string().max(15).optional(),
  email:               z.string().email().optional(),
  relationship:        z.string().max(100).optional(),
  side:                GuestSideEnum.optional(),
  mealPref:            MealPrefEnum.optional(),
  roomNumber:          z.string().max(20).optional(),
  plusOnes:            z.number().int().min(0).max(8).optional(),
  plusOneNames:        z.array(z.string().max(255)).max(8).optional(),
  ageGroup:            GuestAgeEnum.optional(),
  isVip:               z.boolean().optional(),
  dietaryNotes:        z.string().max(500).optional(),
  accessibilityNotes:  z.string().max(500).optional(),
  invitedToCeremonies: z.array(z.string().uuid()).optional(),
  notes:               z.string().max(1000).optional(),
});

export const UpdateGuestSchema = AddGuestSchema.partial().extend({
  rsvpStatus: RsvpStatusEnum.optional(),
});

export const RsvpUpdateSchema = z.object({
  rsvpStatus: RsvpStatusEnum,
  mealPref:   MealPrefEnum.optional(),
});

export const SendInvitationsSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1),
  channel:  InvChannelEnum.default('EMAIL'),
  type:     InvTypeEnum.default('INVITATION'),
  message:  z.string().max(500).optional(),
});

export const BulkImportGuestsSchema = z.object({
  guests: z.array(AddGuestSchema).min(1).max(500),
});

export const CsvImportGuestsSchema = z.object({
  csv: z.string().min(1).max(2_000_000),  // ~2MB
});

export const CheckInGuestSchema = z.object({
  checkedIn: z.boolean().default(true),
});

export type CreateWeddingInput    = z.infer<typeof CreateWeddingSchema>;
export type UpdateWeddingInput    = z.infer<typeof UpdateWeddingSchema>;
export type CreateTaskInput       = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput       = z.infer<typeof UpdateTaskSchema>;
export type UpdateBudgetInput     = z.infer<typeof UpdateBudgetSchema>;
export type AddGuestInput         = z.infer<typeof AddGuestSchema>;
export type UpdateGuestInput      = z.infer<typeof UpdateGuestSchema>;
export type RsvpUpdateInput       = z.infer<typeof RsvpUpdateSchema>;
export type SendInvitationsInput  = z.infer<typeof SendInvitationsSchema>;
export type BulkImportGuestsInput = z.infer<typeof BulkImportGuestsSchema>;

export const CreateCeremonySchema = z.object({
  type:           z.enum(['HALDI', 'MEHNDI', 'SANGEET', 'WEDDING', 'RECEPTION', 'ENGAGEMENT', 'OTHER']),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venue:          z.string().max(255).optional(),
  venueAddress:   z.string().max(500).optional(),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime:        z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dressCode:      z.string().max(100).optional(),
  expectedGuests: z.number().int().min(0).max(10000).optional(),
  isPublic:       z.boolean().optional(),
  notes:          z.string().max(1000).optional(),
});

export const UpdateCeremonyStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const UpdateCeremonySchema = CreateCeremonySchema.partial();

export const SelectMuhuratSchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  muhurat: z.string().min(1).max(100),
  tithi:   z.string().max(100).optional(),
});

export type CreateCeremonyInput = z.infer<typeof CreateCeremonySchema>;
export type UpdateCeremonyInput = z.infer<typeof UpdateCeremonySchema>;
export type SelectMuhuratInput  = z.infer<typeof SelectMuhuratSchema>;

// ── Expenses ──────────────────────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  category:     z.string().min(1).max(100),
  label:        z.string().min(1).max(255),
  amount:       z.number().positive(),
  paid:         z.number().min(0).optional(),
  vendorId:     z.string().uuid().optional(),
  bookingId:    z.string().uuid().optional(),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:       z.enum(['DRAFT', 'DUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  receiptR2Key: z.string().max(500).optional(),
  notes:        z.string().max(1000).optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const RecordPaymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
  receiptR2Key: z.string().max(500).optional(),
  notes:  z.string().max(500).optional(),
});

export type CreateExpenseInput  = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput  = z.infer<typeof UpdateExpenseSchema>;
export type RecordPaymentInput  = z.infer<typeof RecordPaymentSchema>;

// ── Timeline ──────────────────────────────────────────────────────────────────

export const CreateTimelineEventSchema = z.object({
  ceremonyId:  z.string().uuid().optional(),
  title:       z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  startTime:   z.string().datetime(),
  endTime:     z.string().datetime().optional(),
  location:    z.string().max(255).optional(),
  assignedTo:  z.string().optional(),
  vendorId:    z.string().uuid().optional(),
  sortOrder:   z.number().int().optional(),
});

export const UpdateTimelineEventSchema = CreateTimelineEventSchema.partial();

export const ReorderTimelineSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })).min(1),
});

export type CreateTimelineEventInput = z.infer<typeof CreateTimelineEventSchema>;
export type UpdateTimelineEventInput = z.infer<typeof UpdateTimelineEventSchema>;
export type ReorderTimelineInput     = z.infer<typeof ReorderTimelineSchema>;

// ── Seating ───────────────────────────────────────────────────────────────────

export const CreateSeatingTableSchema = z.object({
  ceremonyId: z.string().uuid().optional(),
  name:       z.string().min(1).max(100),
  capacity:   z.number().int().min(1).max(50).default(8),
  shape:      z.enum(['ROUND', 'RECT', 'SQUARE', 'OVAL']).default('ROUND'),
  notes:      z.string().max(500).optional(),
  posX:       z.number().int().optional(),
  posY:       z.number().int().optional(),
});

export const UpdateSeatingTableSchema = CreateSeatingTableSchema.partial();

export const AssignSeatSchema = z.object({
  guestId:    z.string().uuid(),
  seatNumber: z.number().int().min(1).optional(),
});

export type CreateSeatingTableInput = z.infer<typeof CreateSeatingTableSchema>;
export type UpdateSeatingTableInput = z.infer<typeof UpdateSeatingTableSchema>;
export type AssignSeatInput         = z.infer<typeof AssignSeatSchema>;

// ── Documents ────────────────────────────────────────────────────────────────

export const AddDocumentSchema = z.object({
  type:     z.enum(['CONTRACT', 'RECEIPT', 'PERMIT', 'ID', 'INSURANCE', 'INVOICE', 'OTHER']),
  label:    z.string().min(1).max(255),
  r2Key:    z.string().min(1).max(500),
  fileSize: z.number().int().min(0).optional(),
  mimeType: z.string().max(100).optional(),
  vendorId: z.string().uuid().optional(),
  expenseId:z.string().uuid().optional(),
});

export type AddDocumentInput = z.infer<typeof AddDocumentSchema>;

// ── Mood Board ────────────────────────────────────────────────────────────────

export const AddMoodBoardItemSchema = z.object({
  r2Key:     z.string().min(1).max(500),
  caption:   z.string().max(500).optional(),
  category:  z.enum(['DECOR', 'ATTIRE', 'MAKEUP', 'VENUE', 'FLORAL', 'INVITATION', 'CAKE', 'OTHER']).default('OTHER'),
  tags:      z.array(z.string().max(40)).max(10).optional(),
  sortOrder: z.number().int().optional(),
});

export const UpdateMoodBoardItemSchema = AddMoodBoardItemSchema.partial();

export type AddMoodBoardItemInput     = z.infer<typeof AddMoodBoardItemSchema>;
export type UpdateMoodBoardItemInput  = z.infer<typeof UpdateMoodBoardItemSchema>;

// ── Member Invites ────────────────────────────────────────────────────────────

export const InviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role:  z.enum(['EDITOR', 'VIEWER']).default('VIEWER'),
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(20).max(64),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

export type InviteMemberInput      = z.infer<typeof InviteMemberSchema>;
export type AcceptInviteInput      = z.infer<typeof AcceptInviteSchema>;
export type UpdateMemberRoleInput  = z.infer<typeof UpdateMemberRoleSchema>;

// ── Vendor Assignments ────────────────────────────────────────────────────────

export const VendorAssignmentRoleEnum = z.enum([
  'PHOTOGRAPHER', 'VIDEOGRAPHER', 'CATERER', 'DECORATOR', 'MUSICIAN',
  'DJ', 'MAKEUP_ARTIST', 'MEHENDI_ARTIST', 'PRIEST', 'PLANNER',
  'TRANSPORT', 'VENUE', 'OTHER',
]);

export const AssignVendorSchema = z.object({
  vendorId:   z.string().uuid(),
  ceremonyId: z.string().uuid().optional(),
  bookingId:  z.string().uuid().optional(),
  role:       VendorAssignmentRoleEnum,
  status:     z.enum(['SHORTLISTED', 'INQUIRED', 'BOOKED', 'CONFIRMED', 'CANCELLED']).default('SHORTLISTED'),
  notes:      z.string().max(1000).optional(),
});

export const UpdateVendorAssignmentSchema = AssignVendorSchema.partial().omit({ vendorId: true });

export type AssignVendorInput            = z.infer<typeof AssignVendorSchema>;
export type UpdateVendorAssignmentInput  = z.infer<typeof UpdateVendorAssignmentSchema>;

// ── Wedding Website ───────────────────────────────────────────────────────────

export const UpsertWebsiteSchema = z.object({
  slug:         z.string().min(3).max(80).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, hyphens'),
  title:        z.string().min(1).max(255),
  story:        z.string().max(5000).optional(),
  heroImageKey: z.string().max(500).optional(),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent:  z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font:    z.string().max(80),
  }).optional(),
  sections: z.array(z.object({
    id:   z.string(),
    type: z.enum(['hero','story','gallery','event_schedule','venue_map','rsvp','registry','qa','custom']),
    data: z.record(z.unknown()),
  })).max(20).optional(),
  isPublic:        z.boolean().optional(),
  password:        z.string().min(4).max(64).optional(),
  rsvpEnabled:     z.boolean().optional(),
  registryEnabled: z.boolean().optional(),
});

export type UpsertWebsiteInput = z.infer<typeof UpsertWebsiteSchema>;

// ── Gift Registry ─────────────────────────────────────────────────────────────

export const CreateRegistryItemSchema = z.object({
  label:        z.string().min(1).max(255),
  description:  z.string().max(1000).optional(),
  price:        z.number().positive().optional(),
  imageR2Key:   z.string().max(500).optional(),
  externalUrl:  z.string().url().optional(),
  sortOrder:    z.number().int().optional(),
});

export const UpdateRegistryItemSchema = CreateRegistryItemSchema.partial();

export const ClaimRegistryItemSchema = z.object({
  claimerName: z.string().min(1).max(255),
});

export type CreateRegistryItemInput = z.infer<typeof CreateRegistryItemSchema>;
export type UpdateRegistryItemInput = z.infer<typeof UpdateRegistryItemSchema>;
export type ClaimRegistryItemInput  = z.infer<typeof ClaimRegistryItemSchema>;

// ── Task Comments + Attachments ───────────────────────────────────────────────

export const CreateTaskCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const AddTaskAttachmentSchema = z.object({
  r2Key:    z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().int().min(0).optional(),
});

export type CreateTaskCommentInput  = z.infer<typeof CreateTaskCommentSchema>;
export type AddTaskAttachmentInput  = z.infer<typeof AddTaskAttachmentSchema>;

// ── Public RSVP (token-based, anonymous) ─────────────────────────────────────

export const PublicRsvpUpdateSchema = z.object({
  rsvpStatus:         z.enum(['YES', 'NO', 'MAYBE']),
  mealPref:           MealPrefEnum.optional(),
  plusOnes:           z.number().int().min(0).max(8).optional(),
  plusOneNames:       z.array(z.string().max(255)).max(8).optional(),
  dietaryNotes:       z.string().max(500).optional(),
  accessibilityNotes: z.string().max(500).optional(),
  message:            z.string().max(1000).optional(),
  ceremonyPrefs: z.array(z.object({
    ceremonyId: z.string().uuid(),
    attending:  z.boolean(),
    mealPref:   MealPrefEnum.optional(),
  })).max(20).optional(),
  customAnswers: z.array(z.object({
    questionId: z.string().uuid(),
    answerText: z.string().max(2000).optional(),
    answerBool: z.boolean().optional(),
  })).max(50).optional(),
});

export type PublicRsvpUpdateInput = z.infer<typeof PublicRsvpUpdateSchema>;

// ── Rich Guest update (server uses this for PUT /guests/:guestId) ────────────

export const RichUpdateGuestSchema = z.object({
  name:                z.string().min(1).max(255).optional(),
  phone:               z.string().max(15).optional(),
  email:               z.string().email().optional(),
  relationship:        z.string().max(100).optional(),
  side:                GuestSideEnum.optional(),
  rsvpStatus:          RsvpStatusEnum.optional(),
  mealPref:            MealPrefEnum.optional(),
  roomNumber:          z.string().max(20).optional(),
  plusOnes:            z.number().int().min(0).max(8).optional(),
  plusOneNames:        z.array(z.string().max(255)).max(8).optional(),
  ageGroup:            GuestAgeEnum.optional(),
  isVip:               z.boolean().optional(),
  dietaryNotes:        z.string().max(500).optional(),
  accessibilityNotes:  z.string().max(500).optional(),
  invitedToCeremonies: z.array(z.string().uuid()).optional(),
  notes:               z.string().max(1000).optional(),
});

export type RichUpdateGuestInput = z.infer<typeof RichUpdateGuestSchema>;
export type CsvImportGuestsInput  = z.infer<typeof CsvImportGuestsSchema>;
export type CheckInGuestInput     = z.infer<typeof CheckInGuestSchema>;

// ── Custom RSVP Questions ────────────────────────────────────────────────────

export const RsvpQuestionTypeEnum = z.enum(['TEXT', 'BOOLEAN', 'CHOICE']);

export const AddRsvpQuestionSchema = z.object({
  questionText: z.string().min(1).max(500),
  questionType: RsvpQuestionTypeEnum.default('TEXT'),
  choices:      z.array(z.string().max(120)).max(20).optional(),
  isRequired:   z.boolean().optional(),
  sortOrder:    z.number().int().min(0).max(1000).optional(),
});

export const UpdateRsvpQuestionSchema = AddRsvpQuestionSchema.partial();

export type AddRsvpQuestionInput     = z.infer<typeof AddRsvpQuestionSchema>;
export type UpdateRsvpQuestionInput  = z.infer<typeof UpdateRsvpQuestionSchema>;

// ── Guest Address ────────────────────────────────────────────────────────────

export const UpsertGuestAddressSchema = z.object({
  line1:    z.string().max(255).optional(),
  line2:    z.string().max(255).optional(),
  city:     z.string().max(100).optional(),
  state:    z.string().max(100).optional(),
  pincode:  z.string().max(10).optional(),
  country:  z.string().max(50).optional(),
});

export type UpsertGuestAddressInput = z.infer<typeof UpsertGuestAddressSchema>;

// ── Per-Ceremony Guest Prefs ─────────────────────────────────────────────────

export const UpsertCeremonyPrefsSchema = z.object({
  prefs: z.array(z.object({
    ceremonyId: z.string().uuid(),
    attending:  z.boolean(),
    mealPref:   MealPrefEnum.optional(),
  })).min(1).max(50),
});

export type UpsertCeremonyPrefsInput = z.infer<typeof UpsertCeremonyPrefsSchema>;

// ── RSVP Deadline ────────────────────────────────────────────────────────────

export const UpsertRsvpDeadlineSchema = z.object({
  deadline:     z.string().datetime(),
  enforced:     z.boolean().optional(),
  reminderDays: z.array(z.number().int().min(0).max(120)).max(8).optional(),
});

export type UpsertRsvpDeadlineInput = z.infer<typeof UpsertRsvpDeadlineSchema>;

// ── Coordinator ──────────────────────────────────────────────────────────────

export const AssignCoordinatorSchema = z.object({
  coordinatorUserId: z.string().min(1),
  scope:             z.enum(['VIEW', 'EDIT', 'DAY_OF', 'FULL']).default('FULL'),
  notes:             z.string().max(500).optional(),
});

export type AssignCoordinatorInput = z.infer<typeof AssignCoordinatorSchema>;

// ── Incidents ────────────────────────────────────────────────────────────────

export const CreateIncidentSchema = z.object({
  ceremonyId:  z.string().uuid().optional(),
  severity:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
  title:       z.string().min(1).max(255),
  description: z.string().max(4000).optional(),
});

export const ResolveIncidentSchema = z.object({
  resolution: z.string().min(1).max(2000),
});

export type CreateIncidentInput  = z.infer<typeof CreateIncidentSchema>;
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentSchema>;

// ── Per-ceremony invitation ──────────────────────────────────────────────────

export const UpsertGuestCeremonyInviteSchema = z.object({
  ceremonyIds: z.array(z.string().uuid()).min(1).max(20),
  rsvpStatus:  z.enum(['PENDING', 'YES', 'NO', 'MAYBE']).optional(),
});

export type UpsertGuestCeremonyInviteInput = z.infer<typeof UpsertGuestCeremonyInviteSchema>;

// ── Day-of operations ────────────────────────────────────────────────────────

export const GuestArrivalCheckInSchema = z.object({
  arrivedAt: z.string().datetime().optional(),  // defaults to now
});

export const VendorCheckInSchema = z.object({
  checkedIn: z.boolean(),
});

export const MarkActualTimeSchema = z.object({
  actualStartAt: z.string().datetime().optional(),
  actualEndAt:   z.string().datetime().optional(),
});

export type GuestArrivalCheckInInput  = z.infer<typeof GuestArrivalCheckInSchema>;
export type VendorCheckInInput        = z.infer<typeof VendorCheckInSchema>;
export type MarkActualTimeInput       = z.infer<typeof MarkActualTimeSchema>;
export type UpdateCeremonyStatusInput = z.infer<typeof UpdateCeremonyStatusSchema>;
