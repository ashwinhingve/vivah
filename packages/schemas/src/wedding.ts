import { z } from 'zod';

export const CreateWeddingSchema = z.object({
  weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venueName:   z.string().max(255).optional(),
  venueCity:   z.string().max(100).optional(),
  budgetTotal: z.number().positive().optional(),
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

export const AddGuestSchema = z.object({
  name:         z.string().min(1).max(255),
  phone:        z.string().max(15).optional(),
  email:        z.string().email().optional(),
  relationship: z.string().max(100).optional(),
  mealPref:     z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN']).optional(),
  roomNumber:   z.string().max(20).optional(),
});

export const UpdateGuestSchema = AddGuestSchema.partial().extend({
  rsvpStatus: z.enum(['PENDING', 'YES', 'NO', 'MAYBE']).optional(),
});

export const RsvpUpdateSchema = z.object({
  rsvpStatus: z.enum(['PENDING', 'YES', 'NO', 'MAYBE']),
  mealPref:   z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN']).optional(),
});

export const SendInvitationsSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1),
  channel:  z.enum(['EMAIL', 'SMS', 'WHATSAPP']).default('EMAIL'),
  message:  z.string().max(500).optional(),
});

export const BulkImportGuestsSchema = z.object({
  guests: z.array(AddGuestSchema).min(1).max(500),
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
  type:      z.enum(['HALDI', 'MEHNDI', 'SANGEET', 'WEDDING', 'RECEPTION', 'ENGAGEMENT', 'OTHER']),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venue:     z.string().max(255).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes:     z.string().max(1000).optional(),
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
