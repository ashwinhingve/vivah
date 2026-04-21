import { mongoose } from '../index.js'

const BudgetCategorySchema = new mongoose.Schema({
  name:      { type: String, required: true },
  allocated: { type: Number, default: 0 },
  spent:     { type: Number, default: 0 },
})

const CeremonySchema = new mongoose.Schema({
  type:      { type: String, required: true },
  date:      { type: Date },
  venue:     { type: String },
  startTime: { type: String },
  vendorIds: [{ type: String }],
  notes:     { type: String },
})

const ChecklistItemSchema = new mongoose.Schema({
  item:    { type: String, required: true },
  done:    { type: Boolean, default: false },
  dueDate: { type: Date },
})

const MuhuratSchema = new mongoose.Schema({
  date:     { type: Date, required: true },
  muhurat:  { type: String },
  selected: { type: Boolean, default: false },
})

const WeddingPlanSchema = new mongoose.Schema({
  weddingId: { type: String, required: true, unique: true },
  theme: {
    name:          { type: String },
    colorPalette:  [{ type: String }],
    style:         { type: String },
    moodBoardKeys: [{ type: String }],
  },
  budget: {
    total:      { type: Number, default: 0 },
    currency:   { type: String, default: 'INR' },
    categories: [BudgetCategorySchema],
  },
  ceremonies:   [CeremonySchema],
  checklist:    [ChecklistItemSchema],
  muhuratDates: [MuhuratSchema],
}, { timestamps: true })

// weddingId already has `unique: true` above — no extra index needed.

export const WeddingPlan = mongoose.model('WeddingPlan', WeddingPlanSchema)
