# Database Schema Reference

Smart Shaadi uses three databases, each serving a distinct purpose.

---

## PostgreSQL — Relational Core

**ORM:** Drizzle  
**Connection:** `DATABASE_URL` env var  
**Schema files:** `packages/db/schema/index.ts` (app tables) + `packages/db/schema/auth.ts` (Better Auth tables)

### When to Use PostgreSQL

All data that requires:
- ACID transactions (payments, escrow, booking state changes)
- Foreign key relationships (user → profile → bookings)
- Complex JOINs (reports, admin analytics)
- Financial records (never store money in MongoDB)

---

### Auth Tables (Better Auth — `packages/db/schema/auth.ts`)

Better Auth manages its own tables. IDs are **nanoid text strings**, NOT UUIDs.

#### `user`
```sql
id                    text PRIMARY KEY              -- nanoid (NOT uuid)
name                  text NOT NULL
email                 text UNIQUE
email_verified        boolean NOT NULL DEFAULT false
image                 text
created_at            timestamp NOT NULL DEFAULT now()
updated_at            timestamp NOT NULL DEFAULT now()
phone_number          text UNIQUE                   -- Better Auth phoneNumber plugin
phone_number_verified boolean NOT NULL DEFAULT false
role                  text NOT NULL DEFAULT 'INDIVIDUAL'
status                text NOT NULL DEFAULT 'PENDING_VERIFICATION'

-- role: INDIVIDUAL | FAMILY_MEMBER | VENDOR | EVENT_COORDINATOR | ADMIN | SUPPORT
-- status: ACTIVE | SUSPENDED | PENDING_VERIFICATION | DELETED
```

#### `session`
```sql
id          text PRIMARY KEY
expires_at  timestamp NOT NULL
token       text NOT NULL UNIQUE
created_at  timestamp NOT NULL DEFAULT now()
updated_at  timestamp NOT NULL DEFAULT now()
ip_address  text
user_agent  text
user_id     text NOT NULL REFERENCES user(id) ON DELETE CASCADE
```

#### `account`
```sql
id                       text PRIMARY KEY
account_id               text NOT NULL
provider_id              text NOT NULL
user_id                  text NOT NULL REFERENCES user(id) ON DELETE CASCADE
access_token             text
refresh_token            text
id_token                 text
access_token_expires_at  timestamp
refresh_token_expires_at timestamp
scope                    text
password                 text
created_at               timestamp NOT NULL DEFAULT now()
updated_at               timestamp NOT NULL DEFAULT now()
```

#### `verification`
```sql
id          text PRIMARY KEY
identifier  text NOT NULL
value       text NOT NULL
expires_at  timestamp NOT NULL
created_at  timestamp DEFAULT now()
updated_at  timestamp DEFAULT now()
```

> **Note:** The old `otp_verifications` table is NOT in the schema. OTP is handled entirely by Better Auth's `verification` table.

---

### App Tables (`packages/db/schema/index.ts`)

#### `profiles`
```sql
id                       uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  text UNIQUE NOT NULL REFERENCES user(id)   -- nanoid FK
mongo_profile_id         varchar(24)                -- MongoDB ObjectId reference
verification_status      verification_status DEFAULT 'PENDING' NOT NULL
premium_tier             premium_tier DEFAULT 'FREE' NOT NULL
profile_completeness     integer DEFAULT 0           -- 0-100
is_active                boolean DEFAULT true NOT NULL
last_active_at           timestamp
stay_quotient            varchar(20)                -- INDEPENDENT | WITH_PARENTS | WITH_INLAWS | FLEXIBLE
family_inclination_score integer                    -- 0-100, null until user fills
function_attendance_score integer                   -- 0-100, null until user fills
created_at               timestamp NOT NULL DEFAULT now()
updated_at               timestamp NOT NULL DEFAULT now()

-- verification_status: PENDING | VERIFIED | REJECTED | MANUAL_REVIEW
-- premium_tier: FREE | STANDARD | PREMIUM
```

#### `profile_photos`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
r2_key        varchar(500) NOT NULL    -- Cloudflare R2 object key
is_primary    boolean DEFAULT false NOT NULL
display_order integer DEFAULT 0 NOT NULL
uploaded_at   timestamp DEFAULT now() NOT NULL
```

#### `community_zones`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id     uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
community      varchar(100)      -- e.g. 'Rajput', 'Brahmin', 'Jain'
sub_community  varchar(100)
language       varchar(50)       -- primary language preference
lgbtq_profile  boolean DEFAULT false
created_at     timestamp NOT NULL DEFAULT now()
```

#### `kyc_verifications`
```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id        uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
aadhaar_verified  boolean DEFAULT false NOT NULL
aadhaar_ref_id    varchar(100)     -- DigiLocker reference ID (never the Aadhaar number)
photo_analysis    jsonb            -- PhotoAnalysis result from Rekognition
duplicate_flag    boolean DEFAULT false NOT NULL
duplicate_reason  text
admin_note        text
reviewed_by       text REFERENCES user(id)
reviewed_at       timestamp
created_at        timestamp NOT NULL DEFAULT now()
updated_at        timestamp NOT NULL DEFAULT now()
```

#### `match_requests`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
sender_id     uuid NOT NULL REFERENCES profiles(id)
receiver_id   uuid NOT NULL REFERENCES profiles(id)
status        match_status DEFAULT 'PENDING' NOT NULL
message       text
responded_at  timestamp
expires_at    timestamp
created_at    timestamp NOT NULL DEFAULT now()

-- status: PENDING | ACCEPTED | DECLINED | WITHDRAWN | BLOCKED | EXPIRED
-- UNIQUE(sender_id, receiver_id)
```

#### `match_scores`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_a        uuid NOT NULL REFERENCES profiles(id)
profile_b        uuid NOT NULL REFERENCES profiles(id)
total_score      integer NOT NULL             -- 0-100
breakdown        jsonb                        -- per-dimension scores
guna_milan_score integer                      -- 0-36
computed_at      timestamp DEFAULT now() NOT NULL

-- UNIQUE(profile_a, profile_b) — store only once per pair (a < b alphabetically)
```

#### `blocked_users`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
blocker_id  uuid NOT NULL REFERENCES profiles(id)
blocked_id  uuid NOT NULL REFERENCES profiles(id)
reason      text
created_at  timestamp NOT NULL DEFAULT now()

-- UNIQUE(blocker_id, blocked_id)
```

#### `vendors`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             text UNIQUE NOT NULL REFERENCES user(id)   -- nanoid FK
mongo_portfolio_id  varchar(24)           -- MongoDB ObjectId reference
business_name       varchar(255) NOT NULL
category            vendor_category NOT NULL
city                varchar(100) NOT NULL
state               varchar(100) NOT NULL
verified            boolean DEFAULT false NOT NULL
rating              decimal(3,2) DEFAULT 0
total_reviews       integer DEFAULT 0 NOT NULL
is_active           boolean DEFAULT true NOT NULL
created_at          timestamp NOT NULL DEFAULT now()
updated_at          timestamp NOT NULL DEFAULT now()

-- vendor_category: PHOTOGRAPHY | VIDEOGRAPHY | CATERING | DECORATION | VENUE |
--   MAKEUP | JEWELLERY | CLOTHING | MUSIC | LIGHTING | SECURITY | TRANSPORT |
--   PRIEST | SOUND | EVENT_HOSTING | RENTAL | OTHER
```

#### `vendor_services`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
vendor_id    uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
name         varchar(255) NOT NULL
description  text
price_from   decimal(12,2)
price_to     decimal(12,2)
price_unit   varchar(50)      -- PER_EVENT | PER_HOUR | PER_PERSON
is_active    boolean DEFAULT true NOT NULL
created_at   timestamp NOT NULL DEFAULT now()
```

#### `vendor_event_types`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
vendor_id   uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
event_type  ceremony_type NOT NULL
available   boolean DEFAULT true NOT NULL

-- UNIQUE(vendor_id, event_type)
-- Used by Vendor Utilization Engine (Phase 5)
```

#### `bookings`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id   text NOT NULL REFERENCES user(id)       -- nanoid FK
vendor_id     uuid NOT NULL REFERENCES vendors(id)
service_id    uuid REFERENCES vendor_services(id)
event_date    date NOT NULL
ceremony_type ceremony_type DEFAULT 'WEDDING' NOT NULL
status        booking_status DEFAULT 'PENDING' NOT NULL
total_amount  decimal(12,2) NOT NULL
notes         text
created_at    timestamp NOT NULL DEFAULT now()
updated_at    timestamp NOT NULL DEFAULT now()

-- booking_status: PENDING | CONFIRMED | COMPLETED | CANCELLED | DISPUTED
-- ceremony_type: WEDDING | HALDI | MEHNDI | SANGEET | ENGAGEMENT | RECEPTION |
--   CORPORATE | FESTIVAL | COMMUNITY | GOVERNMENT | SCHOOL | OTHER
```

#### `payments`
```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id            uuid NOT NULL REFERENCES bookings(id)
amount                decimal(12,2) NOT NULL
currency              varchar(3) DEFAULT 'INR' NOT NULL
method                payment_method
status                payment_status DEFAULT 'PENDING' NOT NULL
razorpay_order_id     varchar(255)
razorpay_payment_id   varchar(255)
razorpay_signature    varchar(500)
created_at            timestamp NOT NULL DEFAULT now()
settled_at            timestamp

-- payment_method: UPI | CARD | NETBANKING | WALLET | EMI | CASH
-- payment_status: PENDING | CAPTURED | FAILED | REFUNDED | PARTIALLY_REFUNDED
```

#### `escrow_accounts`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      uuid UNIQUE NOT NULL REFERENCES bookings(id)
total_held      decimal(12,2) NOT NULL
released        decimal(12,2) DEFAULT 0 NOT NULL
status          escrow_status DEFAULT 'HELD' NOT NULL
release_due_at  timestamp        -- 48h after event completion
released_at     timestamp
created_at      timestamp NOT NULL DEFAULT now()

-- escrow_status: HELD | RELEASED | DISPUTED | REFUNDED
```

#### `audit_logs` — Immutable, append-only
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
event_type    audit_event_type NOT NULL
entity_type   varchar(50) NOT NULL
entity_id     uuid NOT NULL
actor_id      text REFERENCES user(id)    -- nanoid FK
payload       jsonb
content_hash  varchar(64) NOT NULL        -- SHA-256 of (prev_hash + payload)
prev_hash     varchar(64)                 -- links to previous log entry
created_at    timestamp NOT NULL DEFAULT now()

-- Never UPDATE or DELETE rows in this table
```

#### `weddings`
```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id            uuid NOT NULL REFERENCES profiles(id)
mongo_wedding_plan_id varchar(24)       -- MongoDB ObjectId reference
wedding_date          date
venue_name            varchar(255)
venue_city            varchar(100)
budget_total          decimal(12,2)
guest_count           integer
status                wedding_status DEFAULT 'PLANNING' NOT NULL
created_at            timestamp NOT NULL DEFAULT now()
updated_at            timestamp NOT NULL DEFAULT now()

-- wedding_status: PLANNING | CONFIRMED | COMPLETED | CANCELLED
```

#### `wedding_members`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
wedding_id  uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE
user_id     text NOT NULL REFERENCES user(id)    -- nanoid FK
role        varchar(50) DEFAULT 'VIEWER' NOT NULL   -- VIEWER | EDITOR | OWNER
invited_at  timestamp NOT NULL DEFAULT now()
accepted_at timestamp

-- UNIQUE(wedding_id, user_id)
```

#### `wedding_tasks`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
wedding_id  uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE
title       varchar(255) NOT NULL
description text
due_date    date
status      varchar(20) DEFAULT 'TODO' NOT NULL     -- TODO | IN_PROGRESS | DONE
priority    varchar(10) DEFAULT 'MEDIUM' NOT NULL   -- LOW | MEDIUM | HIGH
assigned_to text REFERENCES user(id)               -- nanoid FK
category    varchar(50)
created_at  timestamp NOT NULL DEFAULT now()
updated_at  timestamp NOT NULL DEFAULT now()
```

#### `guest_lists`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
wedding_id  uuid UNIQUE NOT NULL REFERENCES weddings(id) ON DELETE CASCADE
created_by  text NOT NULL REFERENCES user(id)    -- nanoid FK
created_at  timestamp NOT NULL DEFAULT now()
```

#### `guests`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
guest_list_id    uuid NOT NULL REFERENCES guest_lists(id) ON DELETE CASCADE
name             varchar(255) NOT NULL
phone            varchar(15)
email            varchar(255)
relationship     varchar(100)
side             varchar(10)           -- BRIDE | GROOM | BOTH
rsvp_status      rsvp_status DEFAULT 'PENDING' NOT NULL
meal_preference  meal_preference DEFAULT 'NO_PREFERENCE' NOT NULL
room_number      varchar(20)
plus_ones        integer DEFAULT 0 NOT NULL
notes            text
created_at       timestamp NOT NULL DEFAULT now()

-- rsvp_status: PENDING | YES | NO | MAYBE
-- meal_preference: VEG | NON_VEG | JAIN | VEGAN | EGGETARIAN | NO_PREFERENCE
```

#### `invitations`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
guest_id    uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE
sent_at     timestamp NOT NULL DEFAULT now()
channel     varchar(20) NOT NULL     -- EMAIL | SMS | WHATSAPP
opened_at   timestamp
rsvp_at     timestamp
message_id  varchar(255)             -- provider message ID
```

#### `notifications`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     text NOT NULL REFERENCES user(id) ON DELETE CASCADE   -- nanoid FK
type        notification_type NOT NULL
title       varchar(255) NOT NULL
body        text NOT NULL
data        jsonb
read        boolean DEFAULT false NOT NULL
sent_via    text[]
created_at  timestamp NOT NULL DEFAULT now()
```

#### `notification_preferences`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     text UNIQUE NOT NULL REFERENCES user(id) ON DELETE CASCADE   -- nanoid FK
push        boolean DEFAULT true NOT NULL
sms         boolean DEFAULT true NOT NULL
email       boolean DEFAULT true NOT NULL
in_app      boolean DEFAULT true NOT NULL
marketing   boolean DEFAULT false NOT NULL
updated_at  timestamp NOT NULL DEFAULT now()
```

#### `products`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
name           varchar(255) NOT NULL
description    text
category       varchar(100) NOT NULL
price          decimal(12,2) NOT NULL
compare_price  decimal(12,2)
stock_qty      integer DEFAULT 0 NOT NULL
sku            varchar(100)
r2_image_keys  text[]                  -- Cloudflare R2 product photo keys
is_active      boolean DEFAULT true NOT NULL
is_featured    boolean DEFAULT false NOT NULL
created_at     timestamp NOT NULL DEFAULT now()
updated_at     timestamp NOT NULL DEFAULT now()
```

#### `orders`
```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id          text NOT NULL REFERENCES user(id)    -- nanoid FK
status               order_status DEFAULT 'PLACED' NOT NULL
subtotal             decimal(12,2) NOT NULL
shipping_fee         decimal(12,2) DEFAULT 0 NOT NULL
total                decimal(12,2) NOT NULL
shipping_address     jsonb NOT NULL    -- {name, phone, address, city, state, pincode}
razorpay_order_id    varchar(255)
razorpay_payment_id  varchar(255)
notes                text
created_at           timestamp NOT NULL DEFAULT now()
updated_at           timestamp NOT NULL DEFAULT now()

-- order_status: PLACED | CONFIRMED | SHIPPED | DELIVERED | CANCELLED | REFUNDED
```

#### `order_items`
```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE
product_id        uuid NOT NULL REFERENCES products(id)
vendor_id         uuid NOT NULL REFERENCES vendors(id)
quantity          integer NOT NULL
unit_price        decimal(12,2) NOT NULL    -- price at time of purchase (snapshot)
subtotal          decimal(12,2) NOT NULL
fulfilment_status varchar(20) DEFAULT 'PENDING' NOT NULL   -- PENDING | SHIPPED | DELIVERED
tracking_number   varchar(255)
created_at        timestamp NOT NULL DEFAULT now()
```

---

## MongoDB — Flexible Content

**ODM:** Mongoose  
**Connection:** `MONGODB_URI` env var  
**Models:** `apps/api/src/infrastructure/mongo/models/`

> **Mock mode:** When `USE_MOCK_SERVICES=true`, MongoDB connection is skipped. Models must be guarded before use.

### When to Use MongoDB

All data with:
- Highly variable schema (profiles with different fields per community)
- Nested arrays of unknown depth (wedding plans, chat history)
- Rich media references (portfolio galleries)
- AI embeddings (vector data alongside profile data)

---

### Collections

#### `profiles_content`
```javascript
{
  _id: ObjectId,
  userId: String,              // PostgreSQL user.id (nanoid)

  personal: {
    fullName: String,
    dob: Date,
    gender: String,            // MALE | FEMALE | OTHER
    height: Number,            // in cm
    weight: Number,            // in kg
    complexion: String,
    maritalStatus: String,     // NEVER_MARRIED | DIVORCED | WIDOWED | SEPARATED
    motherTongue: String,
    religion: String,
    caste: String,
    subCaste: String,
    manglik: Boolean,
    gotra: String
  },

  education: {
    degree: String,
    college: String,
    fieldOfStudy: String,
    year: Number
  },

  profession: {
    occupation: String,
    employer: String,
    incomeRange: String,       // e.g. "5-10 LPA"
    workLocation: String,
    workingAbroad: Boolean
  },

  family: {
    fatherName: String,
    fatherOccupation: String,
    motherName: String,
    motherOccupation: String,
    siblings: [{ name: String, married: Boolean, occupation: String }],
    familyType: String,        // JOINT | NUCLEAR | EXTENDED
    familyValues: String,      // TRADITIONAL | MODERATE | LIBERAL
    familyStatus: String       // MIDDLE_CLASS | UPPER_MIDDLE | AFFLUENT
  },

  location: {
    city: String,
    state: String,
    country: String,
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },

  lifestyle: {
    diet: String,              // VEG | NON_VEG | JAIN | VEGAN | EGGETARIAN
    smoking: String,           // NEVER | OCCASIONALLY | REGULARLY
    drinking: String,          // NEVER | OCCASIONALLY | REGULARLY
    hobbies: [String],
    interests: [String],
    hyperNicheTags: [String]   // career-first | environmentalist | spiritual | etc.
  },

  horoscope: {
    rashi: String,             // Moon sign
    nakshatra: String,         // Birth star
    dob: Date,
    tob: String,               // Time of birth HH:MM
    pob: String,               // Place of birth
    manglik: Boolean,
    gunaScore: Number,         // Cached from last Guna Milan calculation
    chartImageKey: String      // R2 key for kundli chart image
  },

  partnerPreferences: {
    ageRange: { min: Number, max: Number },
    heightRange: { min: Number, max: Number },
    incomeRange: String,
    education: [String],
    religion: [String],
    caste: [String],
    location: [String],        // preferred states/cities
    manglik: String,           // ANY | ONLY_MANGLIK | NON_MANGLIK
    diet: [String],
    openToInterfaith: Boolean,
    openToInterCaste: Boolean
  },

  safetyMode: {
    contactHidden: Boolean,    // default true
    unlockedWith: [String]     // profile IDs that can see contact
  },

  aboutMe: String,
  partnerDescription: String,

  aiEmbedding: [Number],       // 1536-dim sentence-transformer vector (Phase 3)
  embeddingUpdatedAt: Date,

  communityZone: String,
  lgbtqProfile: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

#### `vendor_portfolios`
```javascript
{
  _id: ObjectId,
  vendorId: String,            // PostgreSQL vendors.id (UUID)

  about: String,
  tagline: String,

  portfolio: [{
    title: String,
    description: String,
    eventType: String,
    eventDate: Date,
    photoKeys: [String],       // R2 keys
    videoKey: String
  }],

  packages: [{
    name: String,
    price: Number,
    priceUnit: String,         // PER_EVENT | PER_HOUR | PER_PERSON
    inclusions: [String],
    exclusions: [String],
    photoKeys: [String]
  }],

  eventTypes: [String],        // event types this vendor accepts (Vendor Utilization Engine)

  faqs: [{ question: String, answer: String }],
  awards: [String],
  certifications: [String],

  createdAt: Date,
  updatedAt: Date
}
```

#### `wedding_plans`
```javascript
{
  _id: ObjectId,
  weddingId: String,           // PostgreSQL weddings.id (UUID)

  theme: {
    name: String,
    colorPalette: [String],
    style: String,
    moodBoardKeys: [String]    // R2 keys
  },

  budget: {
    total: Number,
    currency: String,
    categories: [{
      name: String,
      allocated: Number,
      spent: Number,
      vendorBookingIds: [String]
    }]
  },

  ceremonies: [{
    type: String,              // HALDI | MEHNDI | SANGEET | WEDDING | RECEPTION
    date: Date,
    venue: String,
    startTime: String,
    vendorIds: [String],
    notes: String
  }],

  timeline: [{ time: String, event: String, notes: String }],

  muhuratDates: [{ date: Date, muhurat: String, selected: Boolean }],

  checklist: [{
    item: String,
    done: Boolean,
    dueDate: Date,
    assignedTo: String,        // user ID
    notes: String
  }],

  updatedAt: Date
}
```

#### `chats`
```javascript
{
  _id: ObjectId,
  participants: [String],      // Two profile IDs
  matchRequestId: String,      // PostgreSQL match_requests.id

  messages: [{
    _id: ObjectId,
    senderId: String,
    content: String,
    contentHi: String,         // Hindi translation
    contentEn: String,         // English translation
    type: String,              // TEXT | PHOTO | SYSTEM
    photoKey: String,          // R2 key if type === PHOTO
    sentAt: Date,
    readAt: Date,
    readBy: [String]
  }],

  lastMessage: { content: String, sentAt: Date, senderId: String },

  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Redis — Cache & Queues

**Client:** ioredis  
**Connection:** `REDIS_URL` env var

### Key Patterns

```
# Sessions
sessions:{userId}                    → JWT session data (JSON)           TTL: 30 days

# Match data (refreshed weekly by cron)
match_scores:{profileId}:{targetId}  → Computed score (Number)           TTL: 7 days
match_feed:{userId}                  → Top-20 AI match feed (JSON)       TTL: 24h

# Auth
otp:{phone}:{purpose}                → OTP code (hashed)                 TTL: 10 min

# Rate limiting
rate:{ip}:{route}                    → Request count                     TTL: 1 min
rate:otp:{phone}                     → OTP send count                    TTL: 10 min

# Bull queue names
queue:notifications                  → Push / SMS / email dispatch jobs
queue:match-compute                  → Nightly match recalculation jobs
queue:escrow-release                 → Delayed 48h escrow auto-release jobs
queue:ai-index                       → Profile embedding refresh jobs

# Socket.io multi-instance adapter
socket:*                             → Socket.io Redis adapter namespace
```

### Bull Queue Job Schemas

```typescript
// notifications queue
interface NotificationJob {
  userId: string
  type: 'push' | 'sms' | 'email'
  title: string
  body: string
  data?: Record<string, string>
}

// escrow-release queue (delayed)
interface EscrowReleaseJob {
  escrowId: string
  bookingId: string
  vendorId: string
  amount: number
}

// ai-index queue
interface AIIndexJob {
  profileId: string
  reason: 'profile_update' | 'new_profile' | 'weekly_refresh'
}
```
