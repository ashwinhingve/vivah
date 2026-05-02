export const WeddingStatus = {
  PLANNING:  'PLANNING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type WeddingStatus = typeof WeddingStatus[keyof typeof WeddingStatus];

export const TaskStatus = {
  TODO:        'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE:        'DONE',
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const RsvpStatus = {
  PENDING: 'PENDING',
  YES:     'YES',
  NO:      'NO',
  MAYBE:   'MAYBE',
} as const;
export type RsvpStatus = typeof RsvpStatus[keyof typeof RsvpStatus];

export const MealPref = {
  VEG:           'VEG',
  NON_VEG:       'NON_VEG',
  JAIN:          'JAIN',
  VEGAN:         'VEGAN',
  EGGETARIAN:    'EGGETARIAN',
  NO_PREFERENCE: 'NO_PREFERENCE',
} as const;
export type MealPref = typeof MealPref[keyof typeof MealPref];

export const GuestSide = {
  BRIDE: 'BRIDE',
  GROOM: 'GROOM',
  BOTH:  'BOTH',
} as const;
export type GuestSide = typeof GuestSide[keyof typeof GuestSide];

export const GuestAgeGroup = {
  ADULT:  'ADULT',
  CHILD:  'CHILD',
  INFANT: 'INFANT',
} as const;
export type GuestAgeGroup = typeof GuestAgeGroup[keyof typeof GuestAgeGroup];

export interface WeddingSummary {
  id:           string;
  weddingDate:  string | null;
  venueName:    string | null;
  venueCity:    string | null;
  budgetTotal:  number | null;
  status:       WeddingStatus;
  taskProgress: { total: number; done: number };
  guestCount:   number;
}

export interface WeddingTask {
  id:         string;
  weddingId:  string;
  title:      string;
  dueDate:    string | null;
  status:     TaskStatus;
  priority:   TaskPriority;
  assignedTo: string | null;
  notes:      string | null;
}

export interface BudgetCategory {
  name:      string;
  allocated: number;
  spent:     number;
}

export interface WeddingPlan {
  weddingId: string;
  theme: {
    name:         string | null;
    colorPalette: string[];
    style:        string | null;
  };
  budget: {
    total:      number;
    currency:   string;
    categories: BudgetCategory[];
  };
  ceremonies: {
    type:  string;
    date:  string | null;
    venue: string | null;
    notes: string | null;
  }[];
  checklist: {
    item:    string;
    done:    boolean;
    dueDate: string | null;
  }[];
  muhuratDates: MuhuratDate[];
}

export interface GuestSummary {
  id:           string;
  name:         string;
  phone:        string | null;
  email:        string | null;
  relationship: string | null;
  rsvpStatus:   RsvpStatus;
  mealPref:     MealPref | null;
  roomNumber:   string | null;
}

export interface GuestRich extends GuestSummary {
  side:                GuestSide | null;
  plusOnes:            number;
  plusOneNames:        string[];
  ageGroup:            GuestAgeGroup;
  isVip:               boolean;
  dietaryNotes:        string | null;
  accessibilityNotes:  string | null;
  invitedToCeremonies: string[];
  notes:               string | null;
  arrivedAt:           string | null;
  checkedInBy:         string | null;
  createdAt:           string;
  updatedAt:           string;
}

export interface InvitationStatus {
  guestId:  string;
  sentAt:   string | null;
  channel:  string | null;
  openedAt: string | null;
}

export const CeremonyType = {
  HALDI:      'HALDI',
  MEHNDI:     'MEHNDI',
  SANGEET:    'SANGEET',
  WEDDING:    'WEDDING',
  RECEPTION:  'RECEPTION',
  ENGAGEMENT: 'ENGAGEMENT',
  OTHER:      'OTHER',
} as const;
export type CeremonyType = typeof CeremonyType[keyof typeof CeremonyType];

export const CeremonyStatus = {
  SCHEDULED:   'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
} as const;
export type CeremonyStatus = typeof CeremonyStatus[keyof typeof CeremonyStatus];

export interface Ceremony {
  id:             string;
  weddingId:      string;
  type:           CeremonyType;
  status:         CeremonyStatus;
  date:           string | null;
  venue:          string | null;
  venueAddress:   string | null;
  startTime:      string | null;
  endTime:        string | null;
  dressCode:      string | null;
  expectedGuests: number | null;
  isPublic:       boolean;
  notes:          string | null;
  startedAt:      string | null;
  completedAt:    string | null;
}

export interface MuhuratDate {
  date:     string;
  muhurat:  string;
  tithi:    string | null;
  selected: boolean;
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export const ExpenseStatus = {
  DRAFT:           'DRAFT',
  DUE:             'DUE',
  PARTIALLY_PAID:  'PARTIALLY_PAID',
  PAID:            'PAID',
  CANCELLED:       'CANCELLED',
} as const;
export type ExpenseStatus = typeof ExpenseStatus[keyof typeof ExpenseStatus];

export interface WeddingExpense {
  id:          string;
  weddingId:   string;
  category:    string;
  label:       string;
  vendorId:    string | null;
  bookingId:   string | null;
  amount:      number;
  paid:        number;
  currency:    string;
  dueDate:     string | null;
  paidAt:      string | null;
  status:      ExpenseStatus;
  receiptR2Key: string | null;
  notes:       string | null;
  createdAt:   string;
}

export interface ExpenseSummary {
  totalBudget:     number;
  totalAllocated:  number;
  totalCommitted:  number;
  totalPaid:       number;
  totalOutstanding:number;
  overBudget:      boolean;
  byCategory: Array<{
    category:    string;
    allocated:   number;
    committed:   number;
    paid:        number;
    outstanding: number;
  }>;
  upcomingDue: Array<{
    expenseId: string;
    label:     string;
    amount:    number;
    dueDate:   string;
  }>;
}

// ── Day-of Timeline ──────────────────────────────────────────────────────────

export interface TimelineEvent {
  id:          string;
  weddingId:   string;
  ceremonyId:  string | null;
  title:       string;
  description: string | null;
  startTime:   string;
  endTime:     string | null;
  location:    string | null;
  assignedTo:  string | null;
  vendorId:    string | null;
  sortOrder:   number;
}

// ── Seating ──────────────────────────────────────────────────────────────────

export const TableShape = {
  ROUND: 'ROUND', RECT: 'RECT', SQUARE: 'SQUARE', OVAL: 'OVAL',
} as const;
export type TableShape = typeof TableShape[keyof typeof TableShape];

export interface SeatingTable {
  id:         string;
  weddingId:  string;
  ceremonyId: string | null;
  name:       string;
  capacity:   number;
  shape:      TableShape;
  notes:      string | null;
  posX:       number;
  posY:       number;
  assignedGuests: Array<{ guestId: string; guestName: string; seatNumber: number | null }>;
}

// ── Documents ────────────────────────────────────────────────────────────────

export const DocumentType = {
  CONTRACT: 'CONTRACT', RECEIPT: 'RECEIPT', PERMIT: 'PERMIT', ID: 'ID',
  INSURANCE: 'INSURANCE', INVOICE: 'INVOICE', OTHER: 'OTHER',
} as const;
export type DocumentType = typeof DocumentType[keyof typeof DocumentType];

export interface WeddingDocument {
  id:        string;
  weddingId: string;
  type:      DocumentType;
  label:     string;
  r2Key:     string;
  url:       string | null;
  fileSize:  number | null;
  mimeType:  string | null;
  vendorId:  string | null;
  expenseId: string | null;
  uploadedBy: string;
  createdAt: string;
}

// ── Mood Board ───────────────────────────────────────────────────────────────

export const MoodBoardCategory = {
  DECOR: 'DECOR', ATTIRE: 'ATTIRE', MAKEUP: 'MAKEUP', VENUE: 'VENUE',
  FLORAL: 'FLORAL', INVITATION: 'INVITATION', CAKE: 'CAKE', OTHER: 'OTHER',
} as const;
export type MoodBoardCategory = typeof MoodBoardCategory[keyof typeof MoodBoardCategory];

export interface MoodBoardItem {
  id:        string;
  weddingId: string;
  r2Key:     string;
  url:       string | null;
  caption:   string | null;
  category:  MoodBoardCategory;
  tags:      string[];
  sortOrder: number;
  createdAt: string;
}

// ── Members + Invites ────────────────────────────────────────────────────────

export const WeddingMemberRole = {
  OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER',
} as const;
export type WeddingMemberRole = typeof WeddingMemberRole[keyof typeof WeddingMemberRole];

export interface WeddingMember {
  id:         string;
  weddingId:  string;
  userId:     string;
  email:      string | null;
  name:       string | null;
  role:       WeddingMemberRole;
  invitedAt:  string;
  acceptedAt: string | null;
}

export interface WeddingMemberInvite {
  id:         string;
  email:      string;
  role:       WeddingMemberRole;
  expiresAt:  string;
  acceptedAt: string | null;
  createdAt:  string;
}

// ── Vendor Assignments ───────────────────────────────────────────────────────

export const VendorAssignmentRole = {
  PHOTOGRAPHER:   'PHOTOGRAPHER',
  VIDEOGRAPHER:   'VIDEOGRAPHER',
  CATERER:        'CATERER',
  DECORATOR:      'DECORATOR',
  MUSICIAN:       'MUSICIAN',
  DJ:             'DJ',
  MAKEUP_ARTIST:  'MAKEUP_ARTIST',
  MEHENDI_ARTIST: 'MEHENDI_ARTIST',
  PRIEST:         'PRIEST',
  PLANNER:        'PLANNER',
  TRANSPORT:      'TRANSPORT',
  VENUE:          'VENUE',
  OTHER:          'OTHER',
} as const;
export type VendorAssignmentRole = typeof VendorAssignmentRole[keyof typeof VendorAssignmentRole];

export const VendorAssignmentStatus = {
  SHORTLISTED: 'SHORTLISTED',
  INQUIRED:    'INQUIRED',
  BOOKED:      'BOOKED',
  CONFIRMED:   'CONFIRMED',
  CANCELLED:   'CANCELLED',
} as const;
export type VendorAssignmentStatus = typeof VendorAssignmentStatus[keyof typeof VendorAssignmentStatus];

export interface WeddingVendorAssignment {
  id:         string;
  weddingId:  string;
  ceremonyId: string | null;
  vendorId:   string;
  vendorName: string | null;
  bookingId:  string | null;
  role:       VendorAssignmentRole;
  status:     VendorAssignmentStatus;
  notes:      string | null;
  createdAt:  string;
}

// ── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id:         string;
  weddingId:  string;
  actorId:    string | null;
  actorName:  string | null;
  action:     string;
  entityType: string | null;
  entityId:   string | null;
  payload:    Record<string, unknown> | null;
  createdAt:  string;
}

// ── Website ──────────────────────────────────────────────────────────────────

export interface WeddingWebsiteSection {
  id:    string;
  type:  'hero' | 'story' | 'gallery' | 'event_schedule' | 'venue_map' | 'rsvp' | 'registry' | 'qa' | 'custom';
  data:  Record<string, unknown>;
}

export interface WeddingWebsite {
  id:               string;
  weddingId:        string;
  slug:             string;
  title:            string;
  story:            string | null;
  heroImageKey:     string | null;
  heroImageUrl:     string | null;
  theme:            { primary: string; accent: string; font: string } | null;
  sections:         WeddingWebsiteSection[];
  isPublic:         boolean;
  passwordProtected:boolean;
  rsvpEnabled:      boolean;
  registryEnabled:  boolean;
  customDomain:     string | null;
  viewCount:        number;
  publishedAt:      string | null;
  createdAt:        string;
  updatedAt:        string;
}

// ── Gift Registry ────────────────────────────────────────────────────────────

export const RegistryStatus = {
  AVAILABLE: 'AVAILABLE', CLAIMED: 'CLAIMED', PURCHASED: 'PURCHASED',
} as const;
export type RegistryStatus = typeof RegistryStatus[keyof typeof RegistryStatus];

export interface RegistryItem {
  id:           string;
  weddingId:    string;
  label:        string;
  description:  string | null;
  price:        number | null;
  currency:     string;
  imageR2Key:   string | null;
  imageUrl:     string | null;
  externalUrl:  string | null;
  status:       RegistryStatus;
  claimedByName: string | null;
  claimedAt:    string | null;
  sortOrder:    number;
}

// ── Task comments + attachments ──────────────────────────────────────────────

export interface TaskComment {
  id:         string;
  taskId:     string;
  authorId:   string;
  authorName: string | null;
  body:       string;
  createdAt:  string;
}

export interface TaskAttachment {
  id:        string;
  taskId:    string;
  r2Key:     string;
  url:       string | null;
  fileName:  string;
  mimeType:  string | null;
  fileSize:  number | null;
  createdAt: string;
}

// ── Reminders ────────────────────────────────────────────────────────────────

export const ReminderType = {
  TASK_DUE:        'TASK_DUE',
  RSVP_FOLLOWUP:   'RSVP_FOLLOWUP',
  VENDOR_PAYMENT:  'VENDOR_PAYMENT',
  GUEST_REMINDER:  'GUEST_REMINDER',
  COUNTDOWN:       'COUNTDOWN',
} as const;
export type ReminderType = typeof ReminderType[keyof typeof ReminderType];

export interface WeddingReminder {
  id:          string;
  weddingId:   string;
  type:        ReminderType;
  targetType:  string | null;
  targetId:    string | null;
  scheduledAt: string;
  sentAt:      string | null;
}

// ── Public RSVP token ────────────────────────────────────────────────────────

export interface PublicRsvpView {
  guest: {
    id:                  string;
    name:                string;
    plusOnes:            number;
    plusOneNames:        string[];
    rsvpStatus:          RsvpStatus;
    mealPref:            MealPref | null;
    dietaryNotes:        string | null;
    accessibilityNotes:  string | null;
    invitedToCeremonies: string[];
  };
  wedding: {
    id:           string;
    title:        string | null;
    weddingDate:  string | null;
    venueName:    string | null;
    venueCity:    string | null;
    brideName:    string | null;
    groomName:    string | null;
    primaryColor: string | null;
  };
  ceremonies: Array<{
    id:        string;
    type:      string;
    date:      string | null;
    venue:     string | null;
    startTime: string | null;
    dressCode: string | null;
  }>;
  customQuestions: RsvpCustomQuestion[];
  ceremonyPrefs:   GuestCeremonyPref[];
  customAnswers:   RsvpCustomAnswer[];
  deadline:        RsvpDeadline | null;
  expiresAt: string;
}

// ── RSVP Custom Questions ────────────────────────────────────────────────────

export const RsvpQuestionType = {
  TEXT:    'TEXT',
  BOOLEAN: 'BOOLEAN',
  CHOICE:  'CHOICE',
} as const;
export type RsvpQuestionType = typeof RsvpQuestionType[keyof typeof RsvpQuestionType];

export interface RsvpCustomQuestion {
  id:           string;
  weddingId:    string;
  questionText: string;
  questionType: RsvpQuestionType;
  choices:      string[] | null;
  isRequired:   boolean;
  sortOrder:    number;
  createdAt:    string;
}

export interface RsvpCustomAnswer {
  id:         string;
  guestId:    string;
  questionId: string;
  answerText: string | null;
  answerBool: boolean | null;
  createdAt:  string;
}

// ── Guest Address ────────────────────────────────────────────────────────────

export interface GuestAddress {
  guestId:   string;
  line1:     string | null;
  line2:     string | null;
  city:      string | null;
  state:     string | null;
  pincode:   string | null;
  country:   string;
  updatedAt: string;
}

// ── Per-Ceremony Guest Prefs ─────────────────────────────────────────────────

export interface GuestCeremonyPref {
  guestId:    string;
  ceremonyId: string;
  attending:  boolean;
  mealPref:   MealPref;
}

// ── RSVP Deadline ────────────────────────────────────────────────────────────

export interface RsvpDeadline {
  weddingId:    string;
  deadline:     string;
  enforced:     boolean;
  reminderDays: number[];
  createdAt:    string;
  updatedAt:    string;
}

// ── RSVP Analytics ───────────────────────────────────────────────────────────

export interface RsvpAnalytics {
  totalGuests:      number;
  invited:          number;
  responded:        number;
  responseRate:     number; // 0..1
  byStatus:         Record<RsvpStatus, number>;
  byMealPref:       Record<MealPref, number>;
  bySide:           Record<'BRIDE' | 'GROOM' | 'BOTH' | 'UNKNOWN', number>;
  attendanceForecast: number;
  timeline:         Array<{ date: string; sent: number; responded: number }>;
  byCeremony:       Array<{ ceremonyId: string; type: string; attending: number; declined: number; pending: number }>;
  topDietary:       Array<{ note: string; count: number }>;
  topAccessibility: Array<{ note: string; count: number }>;
  checkedIn:        number;
}

// ── Invitation Batch ─────────────────────────────────────────────────────────

export interface InvitationBatch {
  id:           string;
  weddingId:    string;
  channel:      string;
  guestIds:     string[];
  previewedAt:  string;
  sentAt:       string | null;
  sentBy:       string | null;
  sentCount:    number;
  failedCount:  number;
}

// ── Coordinator ──────────────────────────────────────────────────────────────

export const CoordinatorScope = {
  VIEW:   'VIEW',
  EDIT:   'EDIT',
  DAY_OF: 'DAY_OF',
  FULL:   'FULL',
} as const;
export type CoordinatorScope = typeof CoordinatorScope[keyof typeof CoordinatorScope];

export interface CoordinatorAssignment {
  id:                string;
  weddingId:         string;
  coordinatorUserId: string;
  scope:             CoordinatorScope;
  assignedBy:        string | null;
  assignedAt:        string;
  revokedAt:         string | null;
  notes:             string | null;
}

export interface ManagedWeddingSummary {
  weddingId:        string;
  title:            string;
  weddingDate:      string | null;
  daysUntil:        number | null;
  ceremoniesCount:  number;
  nextCeremony:     { id: string; type: CeremonyType; date: string | null; status: CeremonyStatus } | null;
  openTasks:        number;
  openIncidents:    number;
  scope:            CoordinatorScope;
}

// ── Incidents ────────────────────────────────────────────────────────────────

export const IncidentSeverity = {
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IncidentSeverity = typeof IncidentSeverity[keyof typeof IncidentSeverity];

export interface WeddingIncident {
  id:          string;
  weddingId:   string;
  ceremonyId:  string | null;
  severity:    IncidentSeverity;
  title:       string;
  description: string | null;
  reportedBy:  string | null;
  resolvedBy:  string | null;
  resolvedAt:  string | null;
  resolution:  string | null;
  createdAt:   string;
  updatedAt:   string;
}

// ── Day-of Snapshot ──────────────────────────────────────────────────────────

export interface DayOfSnapshot {
  weddingId:         string;
  asOf:              string;  // ISO timestamp
  activeCeremonyId:  string | null;
  ceremonies: Array<{
    id:        string;
    type:      CeremonyType;
    status:    CeremonyStatus;
    date:      string | null;
    startTime: string | null;
    endTime:   string | null;
  }>;
  guestArrivals: {
    expected: number;
    arrived:  number;
  };
  vendorCheckIns: Array<{
    eventId:   string;
    title:     string;
    vendorId:  string | null;
    vendorName: string | null;
    checkedIn: boolean;
    checkedInAt: string | null;
    startTime: string;
  }>;
  recentIncidents: WeddingIncident[];
}

// ── Budget rollup by ceremony ────────────────────────────────────────────────

export interface CeremonyBudgetRow {
  ceremonyId:  string | null;  // null = unallocated
  ceremonyType: CeremonyType | null;
  ceremonyDate: string | null;
  allocated:   number;          // sum of category allocations referencing this ceremony (or 0)
  spent:       number;          // sum(weddingExpenses.paid) for ceremonyId
  committed:   number;          // sum(weddingExpenses.amount - paid)
  remaining:   number;
  overBudget:  boolean;
  expensesCount: number;
}

export interface CeremonyBudgetRollup {
  weddingId:    string;
  totalBudget:  number;
  totalSpent:   number;
  totalCommitted: number;
  totalRemaining: number;
  rows:         CeremonyBudgetRow[];
}

// ── Reminder Chain ───────────────────────────────────────────────────────────

export const CeremonyReminderType = {
  T_30D: 'CEREMONY_T_30D',
  T_7D:  'CEREMONY_T_7D',
  T_1D:  'CEREMONY_T_1D',
  T_1H:  'CEREMONY_T_1H',
} as const;
export type CeremonyReminderType = typeof CeremonyReminderType[keyof typeof CeremonyReminderType];

export interface CeremonyReminder {
  id:           string;
  weddingId:    string;
  ceremonyId:   string | null;
  type:         string;  // weddingReminderTypeEnum value
  channel:      string;  // IN_APP | EMAIL | SMS | WHATSAPP
  scheduledAt:  string;
  sentAt:       string | null;
  failedAt:     string | null;
  attemptCount: number;
}

// ── Per-Ceremony Guest Invite (junction) ─────────────────────────────────────

export interface GuestCeremonyInvite {
  id:          string;
  guestId:     string;
  ceremonyId:  string;
  rsvpStatus:  'PENDING' | 'YES' | 'NO' | 'MAYBE';
  plusOnes:    number;
  mealPref:    string | null;
  respondedAt: string | null;
  invitedAt:   string;
  notes:       string | null;
}
