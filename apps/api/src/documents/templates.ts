/**
 * Smart Shaadi — Contract & Compliance Document Templates
 *
 * Code-based template registry mapping templateId → render function.
 * Each template produces structured sections/lines from typed input data.
 * No database template table — templates are versioned in code alongside prompts.
 */

// Optional fields are explicitly `| undefined` so parser output (zod infers
// optionals as `T | undefined`) assigns cleanly under exactOptionalPropertyTypes.
export interface ContractParty {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  gstinOrPan?: string | undefined;
}

export interface ContractData {
  party1: ContractParty;
  party2: ContractParty;
  effectiveDate: string;
  expiryDate?: string | undefined;
  amount?: number | undefined;
  terms?: string[] | undefined;
  services?: string[] | undefined;
  specialTerms?: Record<string, string> | undefined;
}

export interface ContractSection {
  title: string;
  content: string[];
}

/**
 * Vendor Service Agreement template — standard B2B service contract
 */
export function vendorServiceAgreement(data: ContractData): ContractSection[] {
  return [
    {
      title: 'PARTIES',
      content: [
        `This Agreement is entered into between:`,
        `Provider: ${data.party1.name} (hereinafter "Provider")`,
        `Client: ${data.party2.name} (hereinafter "Client")`,
      ],
    },
    {
      title: 'EFFECTIVE DATE',
      content: [
        `This Agreement becomes effective on ${data.effectiveDate}.`,
        ...(data.expiryDate ? [`It shall remain in effect until ${data.expiryDate}.`] : []),
      ],
    },
    {
      title: 'SERVICES',
      content: data.services && data.services.length > 0
        ? data.services.map((s, i) => `${i + 1}. ${s}`)
        : ['Services as mutually agreed upon between the parties.'],
    },
    {
      title: 'FEES & PAYMENT',
      content: data.amount
        ? [`Total Service Fee: Rs. ${data.amount.toFixed(2)}`, 'Payment due upon completion of services.']
        : ['Fees shall be as per the schedule mutually agreed.'],
    },
    {
      title: 'TERMS & CONDITIONS',
      content: data.terms && data.terms.length > 0
        ? data.terms.map((t, i) => `${i + 1}. ${t}`)
        : [
            '1. Provider shall maintain professional standards.',
            '2. Client shall provide timely information and cooperation.',
            '3. Either party may terminate with 14 days written notice.',
          ],
    },
    {
      title: 'LIABILITY & INDEMNIFICATION',
      content: [
        'Neither party shall be liable for indirect, incidental, or consequential damages.',
        'Each party indemnifies the other against third-party claims arising from its breach.',
      ],
    },
    {
      title: 'CONFIDENTIALITY',
      content: [
        'The parties agree to maintain confidentiality of any proprietary information shared.',
        'This obligation shall survive termination of the agreement.',
      ],
    },
    {
      title: 'GOVERNING LAW',
      content: [
        'This Agreement is governed by the laws of India.',
        'Disputes shall be resolved through mutual negotiation or arbitration under ICA.',
      ],
    },
  ];
}

/**
 * B2B Contract template — institutional buyer / vendor bulk services
 */
export function b2bContract(data: ContractData): ContractSection[] {
  return [
    {
      title: 'PARTIES',
      content: [
        `This Agreement is entered into between:`,
        `Supplier: ${data.party1.name} (hereinafter "Supplier")`,
        `Buyer: ${data.party2.name} (hereinafter "Buyer")`,
        `GSTIN/PAN: ${data.party1.gstinOrPan || 'Not provided'}`,
      ],
    },
    {
      title: 'SCOPE OF SUPPLY',
      content: data.services && data.services.length > 0
        ? data.services.map((s, i) => `${i + 1}. ${s}`)
        : ['Goods/services as per attached schedule.'],
    },
    {
      title: 'PRICING & PAYMENT TERMS',
      content: [
        `${data.amount ? `Contract Value: Rs. ${data.amount.toFixed(2)}` : 'Contract value as per PO.'}`,
        'Payment: Net 30 days from invoice date.',
        'GST shall be charged as per applicable slab.',
      ],
    },
    {
      title: 'DELIVERY',
      content: [
        'Delivery location: As specified in purchase orders.',
        'Delivery timeline: Within 14 days of PO or as agreed.',
        'Risk transfer: Upon delivery acceptance.',
      ],
    },
    {
      title: 'QUALITY & WARRANTY',
      content: [
        'Supplier warrants all goods/services meet quality standards.',
        'Warranty period: 12 months from delivery.',
        'Non-conforming items shall be replaced at supplier cost.',
      ],
    },
    {
      title: 'PURCHASE ORDER PROCESS',
      content: [
        'All orders must be via formal Purchase Order.',
        'Supplier shall issue invoice within 5 days of dispatch.',
        'Payment shall be made within invoice terms.',
      ],
    },
    {
      title: 'TERM & TERMINATION',
      content: [
        `Initial term: From ${data.effectiveDate}${data.expiryDate ? ` to ${data.expiryDate}` : ' for one year.'}.`,
        'Either party may terminate with 30 days written notice.',
        'Outstanding obligations survive termination.',
      ],
    },
    {
      title: 'DISPUTE RESOLUTION',
      content: [
        'Disputes shall first be resolved through senior management negotiation.',
        'Unresolved disputes shall be referred to arbitration under Arbitration Act, 1996.',
        'Seat of arbitration: Mumbai.',
      ],
    },
  ];
}

/**
 * Booking Terms & Conditions template — event/service booking
 */
export function bookingTermsAndConditions(data: ContractData): ContractSection[] {
  return [
    {
      title: 'PARTIES',
      content: [
        `Service Provider: ${data.party1.name} (hereinafter "Provider")`,
        `Client / Event Organizer: ${data.party2.name} (hereinafter "Client")`,
      ],
    },
    {
      title: 'SERVICE DESCRIPTION',
      content: data.services && data.services.length > 0
        ? data.services.map((s, i) => `${i + 1}. ${s}`)
        : ['Services as per booking confirmation.'],
    },
    {
      title: 'BOOKING DATE & EVENT DATE',
      content: [
        `Booking Date: ${data.effectiveDate}`,
        ...(data.expiryDate ? [`Event Date: ${data.expiryDate}`] : []),
      ],
    },
    {
      title: 'FEES & PAYMENT',
      content: [
        `Total Booking Fee: Rs. ${data.amount?.toFixed(2) || 'As per quotation'}`,
        'Booking Confirmation: 50% deposit required to confirm.',
        'Final Payment: 100% due 7 days before event date.',
        'Cancellation: Subject to cancellation policy below.',
      ],
    },
    {
      title: 'CANCELLATION POLICY',
      content: [
        'Cancellation 30+ days before event: 50% refund of deposit.',
        'Cancellation 15–29 days before: 25% refund of deposit.',
        'Cancellation <15 days: No refund.',
      ],
    },
    {
      title: 'RESPONSIBILITIES',
      content: [
        'Provider: Deliver services as agreed; maintain professional conduct.',
        'Client: Provide timely information; ensure venue access and logistics.',
      ],
    },
    {
      title: 'LIABILITY CLAUSE',
      content: [
        'Provider is not liable for client-caused delays or third-party interference.',
        'Client is liable for any damage to the provider equipment during the event.',
      ],
    },
    {
      title: 'MODIFICATIONS',
      content: [
        'Any changes to booking require written mutual agreement.',
        'Changes within 14 days of event: Rs. 5,000 modification fee applies.',
      ],
    },
  ];
}

/**
 * Template registry — map templateId to template factory
 */
export const templateRegistry: Record<string, (data: ContractData) => ContractSection[]> = {
  'vendor-service-agreement': vendorServiceAgreement,
  'b2b-contract': b2bContract,
  'booking-terms': bookingTermsAndConditions,
};

/**
 * Render a contract template by ID
 */
export function renderTemplate(templateId: string, data: ContractData): ContractSection[] {
  const factory = templateRegistry[templateId];
  if (!factory) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return factory(data);
}

/**
 * Flatten sections into plain text for hashing/audit
 */
export function flattenSections(sections: ContractSection[]): string {
  return sections.map(s => `${s.title}\n${s.content.join('\n')}`).join('\n\n');
}
