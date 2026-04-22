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
  VEG:     'VEG',
  NON_VEG: 'NON_VEG',
  JAIN:    'JAIN',
  VEGAN:   'VEGAN',
} as const;
export type MealPref = typeof MealPref[keyof typeof MealPref];

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
  muhuratDates: {
    date:     string;
    muhurat:  string;
    selected: boolean;
  }[];
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

export interface Ceremony {
  id:        string;
  weddingId: string;
  type:      CeremonyType;
  date:      string | null;
  venue:     string | null;
  startTime: string | null;
  endTime:   string | null;
  notes:     string | null;
}

export interface MuhuratDate {
  date:     string;
  muhurat:  string;
  tithi:    string | null;
  selected: boolean;
}
