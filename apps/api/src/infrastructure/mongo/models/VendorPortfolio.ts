import { mongoose } from '../index.js'

const vendorPortfolioSchema = new mongoose.Schema(
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
        photoKeys:   [String],
        videoKey:    String,
      },
    ],

    packages: [
      {
        name:        String,
        price:       Number,
        priceUnit:   String,
        inclusions:  [String],
        exclusions:  [String],
        photoKeys:   [String],
      },
    ],

    eventTypes:     [String],
    faqs:           [{ question: String, answer: String }],
    awards:         [String],
    certifications: [String],
  },
  {
    collection: 'vendor_portfolios',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

export const VendorPortfolio = mongoose.models['VendorPortfolio'] ?? mongoose.model('VendorPortfolio', vendorPortfolioSchema)
