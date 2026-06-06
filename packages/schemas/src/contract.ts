import { z } from 'zod';

// Mirrors @smartshaadi/types contract.ts (Documentation & e-sign).
// profileId is a raw UUID here; ProfileId brand applied at the resolver boundary.

const profileId = z.string().uuid();

export const CONTRACT_STATUSES = ['DRAFT', 'SENT', 'SIGNED', 'VOID'] as const;
export const ContractStatusSchema = z.enum(CONTRACT_STATUSES);

export const ESIGN_PROVIDERS = ['DIGILOCKER', 'SIGNZY'] as const;
export const ESignProviderSchema = z.enum(ESIGN_PROVIDERS);

export const CreateContractSchema = z.object({
  profileId,
  templateId: z.string().min(1).max(100),
  title:      z.string().min(1).max(255),
});

export const SendContractSchema = z.object({
  provider: ESignProviderSchema,
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type SendContractInput   = z.infer<typeof SendContractSchema>;
