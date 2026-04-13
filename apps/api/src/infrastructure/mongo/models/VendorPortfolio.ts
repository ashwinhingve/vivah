import { Schema, model, models } from 'mongoose';

/**
 * VendorPortfolio — MongoDB collection for rich vendor content.
 * Linked to PostgreSQL vendors table via vendorId (UUID).
 *
 * Stores media-heavy, variable-structure vendor data: portfolio galleries,
 * packages, FAQs, awards. The PostgreSQL vendors table stores indexed metadata.
 */

const vendorPortfolioSchema = new Schema(
  {
    vendorId: { type: String, required: true, unique: true, index: true },

    about:   String,
    tagline: String,

    portfolio: [
      {
        title:       String,
        description: String,
        eventType:   String,
        eventDate:   Date,
        photoKeys:   [String],   // R2 object keys
        videoKey:    String,     // R2 object key
      },
    ],

    packages: [
      {
        name:        String,
        price:       Number,
        priceUnit:   String,     // PER_EVENT | PER_HOUR | PER_PERSON
        inclusions:  [String],
        exclusions:  [String],
        photoKeys:   [String],   // R2 object keys
      },
    ],

    // Event types this vendor accepts (used by Vendor Utilization Engine)
    eventTypes: [String],

    faqs:           [{ question: String, answer: String }],
    awards:         [String],
    certifications: [String],
  },
  {
    collection: 'vendor_portfolios',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

export const VendorPortfolio =
  (models['VendorPortfolio'] as ReturnType<typeof model> | undefined) ??
  model('VendorPortfolio', vendorPortfolioSchema);
