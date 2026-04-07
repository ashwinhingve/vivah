# Database Schema Reference

VivahOS uses three databases, each serving a distinct purpose.

---

## PostgreSQL — Relational Core

**ORM:** Drizzle  
**Connection:** `DATABASE_URL` env var  
**Schema files:** `packages/db/schema/`

### When to Use PostgreSQL

All data that requires:
- ACID transactions (payments, escrow, booking state changes)
- Foreign key relationships (user → profile → bookings)
- Complex JOINs (reports, admin analytics)
- Financial records (never store money in MongoDB)

---

### Core Tables

#### `users`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
phone           varchar(15) UNIQUE NOT NULL
email           varchar(255) UNIQUE
role            user_role NOT NULL DEFAULT 'INDIVIDUAL'
status          user_status NOT NULL DEFAULT 'ACTIVE'
verified_at     timestamp
created_at      timestamp DEFAULT now()
updated_at      timestamp DEFAULT now()

-- role enum: INDIVIDUAL | FAMILY_MEMBER | VENDOR | EVENT_COORDINATOR | ADMIN | SUPPORT
-- status enum: ACTIVE | SUSPENDED | PENDING_VERIFICATION | DELETED
```

#### `sessions`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash      varchar(64) UNIQUE NOT NULL   -- bcrypt hash of refresh token
device          varchar(255)
ip_address      inet
expires_at      timestamp NOT NULL
created_at      timestamp DEFAULT now()
```

#### `otp_verifications`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
phone           varchar(15) NOT NULL
otp_hash        varchar(64) NOT NULL            -- bcrypt hash of OTP
purpose         otp_purpose NOT NULL            -- LOGIN | KYC | CONTACT_UNLOCK
expires_at      timestamp NOT NULL
used_at         timestamp
created_at      timestamp DEFAULT now()
```

#### `profiles`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid UNIQUE NOT NULL REFERENCES users(id)
mongo_profile_id varchar(24)                   -- MongoDB ObjectId reference
verification_status verification_status DEFAULT 'PENDING'
premium_tier    premium_tier DEFAULT 'FREE'
is_active       boolean DEFAULT true
created_at      timestamp DEFAULT now()
updated_at      timestamp DEFAULT now()

-- verification_status: PENDING | VERIFIED | REJECTED | MANUAL_REVIEW
-- premium_tier: FREE | STANDARD | PREMIUM
```

#### `profile_photos`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
r2_key          varchar(500) NOT NULL          -- Cloudflare R2 object key
is_primary      boolean DEFAULT false
display_order   int NOT NULL DEFAULT 0
uploaded_at     timestamp DEFAULT now()
```

#### `match_requests`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sender_id       uuid NOT NULL REFERENCES profiles(id)
receiver_id     uuid NOT NULL REFERENCES profiles(id)
status          match_status DEFAULT 'PENDING'
message         text
responded_at    timestamp
created_at      timestamp DEFAULT now()

-- status: PENDING | ACCEPTED | DECLINED | WITHDRAWN | BLOCKED
-- UNIQUE(sender_id, receiver_id)
```

#### `match_scores`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_a       uuid NOT NULL REFERENCES profiles(id)
profile_b       uuid NOT NULL REFERENCES profiles(id)
total_score     int NOT NULL                   -- 0-100
breakdown       jsonb                          -- per-dimension scores
guna_milan_score int                           -- 0-36
computed_at     timestamp DEFAULT now()

-- UNIQUE(profile_a, profile_b) — store only once per pair (a < b alphabetically)
```

#### `vendors`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid UNIQUE NOT NULL REFERENCES users(id)
business_name   varchar(255) NOT NULL
category        vendor_category NOT NULL
city            varchar(100) NOT NULL
state           varchar(100) NOT NULL
verified        boolean DEFAULT false
rating          decimal(3,2) DEFAULT 0         -- 0.00-5.00
total_reviews   int DEFAULT 0
is_active       boolean DEFAULT true
created_at      timestamp DEFAULT now()
```

#### `bookings`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     uuid NOT NULL REFERENCES users(id)
vendor_id       uuid NOT NULL REFERENCES vendors(id)
service_id      uuid REFERENCES vendor_services(id)
event_date      date NOT NULL
ceremony_type   ceremony_type                  -- WEDDING | HALDI | MEHNDI | SANGEET | CORPORATE | etc.
status          booking_status DEFAULT 'PENDING'
total_amount    decimal(12,2) NOT NULL
escrow_amount   decimal(12,2)                  -- 50% held in escrow
notes           text
created_at      timestamp DEFAULT now()
updated_at      timestamp DEFAULT now()

-- booking_status: PENDING | CONFIRMED | COMPLETED | CANCELLED | DISPUTED
```

#### `payments`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      uuid NOT NULL REFERENCES bookings(id)
amount          decimal(12,2) NOT NULL
currency        varchar(3) DEFAULT 'INR'
method          payment_method                 -- UPI | CARD | NETBANKING | WALLET | EMI
status          payment_status DEFAULT 'PENDING'
razorpay_order_id  varchar(255)
razorpay_payment_id varchar(255)
created_at      timestamp DEFAULT now()
settled_at      timestamp
```

#### `escrow_accounts`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      uuid UNIQUE NOT NULL REFERENCES bookings(id)
total_held      decimal(12,2) NOT NULL
released        decimal(12,2) DEFAULT 0
status          escrow_status DEFAULT 'HELD'   -- HELD | RELEASED | DISPUTED | REFUNDED
release_due_at  timestamp                      -- 48h after event completion
created_at      timestamp DEFAULT now()
```

#### `audit_logs` — Immutable, append-only
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
event_type      varchar(100) NOT NULL          -- KYC_VERIFIED | PAYMENT_RECEIVED | ESCROW_RELEASED | etc.
entity_type     varchar(50) NOT NULL           -- user | booking | payment | contract
entity_id       uuid NOT NULL
actor_id        uuid REFERENCES users(id)
payload         jsonb                          -- event-specific data
content_hash    varchar(64) NOT NULL           -- SHA-256 of (prev_hash + payload)
prev_hash       varchar(64)                    -- links to previous log entry
created_at      timestamp DEFAULT now()

-- Never UPDATE or DELETE rows in this table
```

#### `weddings`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id      uuid NOT NULL REFERENCES profiles(id)
wedding_date    date
venue_name      varchar(255)
venue_city      varchar(100)
budget_total    decimal(12,2)
status          wedding_status DEFAULT 'PLANNING'
created_at      timestamp DEFAULT now()
```

#### `guests`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
wedding_id      uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE
name            varchar(255) NOT NULL
phone           varchar(15)
email           varchar(255)
relationship    varchar(100)
rsvp_status     rsvp_status DEFAULT 'PENDING'  -- PENDING | YES | NO | MAYBE
meal_preference meal_pref                      -- VEG | NON_VEG | JAIN | VEGAN
room_number     varchar(20)
created_at      timestamp DEFAULT now()
```


#### `products`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE
name            varchar(255) NOT NULL
description     text
category        varchar(100) NOT NULL       -- Gifts | Trousseau | Ethnic Wear | Pooja | Decor | Stationery | Other
price           decimal(12,2) NOT NULL
compare_price   decimal(12,2)               -- original price for discount display
stock_qty       integer NOT NULL DEFAULT 0
sku             varchar(100)
r2_image_keys   text[]                      -- Cloudflare R2 product photo keys
is_active       boolean DEFAULT true NOT NULL
is_featured     boolean DEFAULT false NOT NULL
created_at      timestamp DEFAULT now()
updated_at      timestamp DEFAULT now()
```

#### `orders`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     uuid NOT NULL REFERENCES users(id)
status          order_status DEFAULT 'PLACED' NOT NULL
subtotal        decimal(12,2) NOT NULL
shipping_fee    decimal(12,2) DEFAULT 0
total           decimal(12,2) NOT NULL
shipping_address jsonb NOT NULL             -- {name, phone, address, city, state, pincode}
razorpay_order_id varchar(255)
razorpay_payment_id varchar(255)
notes           text
created_at      timestamp DEFAULT now()
updated_at      timestamp DEFAULT now()

-- order_status: PLACED | CONFIRMED | SHIPPED | DELIVERED | CANCELLED | REFUNDED
```

#### `order_items`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE
product_id      uuid NOT NULL REFERENCES products(id)
vendor_id       uuid NOT NULL REFERENCES vendors(id)
quantity        integer NOT NULL
unit_price      decimal(12,2) NOT NULL      -- price at time of purchase (snapshot)
subtotal        decimal(12,2) NOT NULL
fulfilment_status varchar(20) DEFAULT 'PENDING'  -- PENDING | SHIPPED | DELIVERED
tracking_number varchar(255)
created_at      timestamp DEFAULT now()
```

#### `notifications`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid NOT NULL REFERENCES users(id)
type            notification_type NOT NULL
title           varchar(255) NOT NULL
body            text NOT NULL
data            jsonb                          -- deeplink, entity IDs etc.
read            boolean DEFAULT false
sent_via        varchar(50)[]                  -- ['push', 'sms', 'email']
created_at      timestamp DEFAULT now()
```

---

## MongoDB — Flexible Content

**ODM:** Mongoose  
**Connection:** `MONGODB_URI` env var  
**Models:** `apps/api/infrastructure/mongo/models/`

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
  userId: String,              // PostgreSQL users.id
  
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
    incomeRange: String,       // e.g., "5-10 LPA"
    workLocation: String,
    workingAbroad: Boolean
  },
  
  family: {
    fatherName: String,
    fatherOccupation: String,
    motherName: String,
    motherOccupation: String,
    siblings: [{
      name: String,
      married: Boolean,
      occupation: String
    }],
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
    hyperNicheTags: [String]   // career-first | environmentalist | entrepreneur | spiritual | etc.
  },
  
  horoscope: {
    rashi: String,             // Moon sign
    nakshatra: String,         // Birth star
    dob: Date,
    tob: String,               // Time of birth HH:MM
    pob: String,               // Place of birth
    manglik: Boolean,
    gunaScore: Number,         // Cached from last calculation
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
    contactHidden: Boolean,
    unlockedWith: [String]     // profile IDs that can see contact
  },
  
  aboutMe: String,             // Free text bio
  partnerDescription: String,  // Free text ideal partner description
  
  aiEmbedding: [Number],       // 1536-dim sentence-transformer vector
  embeddingUpdatedAt: Date,
  
  communityZone: String,
  lgbtqProfile: Boolean,       // flagged only if user self-identifies
  
  createdAt: Date,
  updatedAt: Date
}
```

#### `wedding_plans`
```javascript
{
  _id: ObjectId,
  weddingId: String,           // PostgreSQL weddings.id
  
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
      name: String,            // Venue | Catering | Decoration | Photography | etc.
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
  
  timeline: [{
    time: String,              // Day-of timeline: "10:00 AM — Baraat arrives"
    event: String,
    notes: String
  }],
  
  muhuratDates: [{
    date: Date,
    muhurat: String,
    selected: Boolean
  }],
  
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
    contentHi: String,         // Hindi translation (if applicable)
    contentEn: String,         // English translation (if applicable)
    type: String,              // TEXT | PHOTO | SYSTEM
    photoKey: String,          // R2 key if type === PHOTO
    sentAt: Date,
    readAt: Date,
    readBy: [String]
  }],
  
  lastMessage: {
    content: String,
    sentAt: Date,
    senderId: String
  },
  
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### `vendor_portfolios`
```javascript
{
  _id: ObjectId,
  vendorId: String,            // PostgreSQL vendors.id
  
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
  
  eventTypes: [String],        // Types this vendor accepts (utilization engine)
  
  faqs: [{ question: String, answer: String }],
  awards: [String],
  certifications: [String],
  
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
sessions:{userId}                → JWT session data (JSON)  TTL: 30 days

# Match data (refreshed weekly by cron)
match_scores:{profileId}:{targetId} → Computed score (Number)  TTL: 7 days
match_feed:{userId}              → Top-20 AI match feed (JSON)  TTL: 24h

# Auth
otp:{phone}:{purpose}           → OTP code (hashed)  TTL: 10 min

# Rate limiting
rate:{ip}:{route}               → Request count  TTL: 1 min
rate:otp:{phone}                → OTP send count  TTL: 10 min

# Bull queue names
queue:notifications              → Push / SMS / email dispatch jobs
queue:match-compute              → Nightly match recalculation jobs
queue:escrow-release             → Delayed 48h escrow auto-release jobs
queue:ai-index                   → Profile embedding refresh jobs

# Socket.io multi-instance adapter
socket:*                         → Socket.io Redis adapter namespace
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
