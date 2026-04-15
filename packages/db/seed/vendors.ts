/**
 * Vendor seed — creates test vendor, services, and event type availability.
 * Uses the existing seed-vendor-001 user created by auth seed.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { vendors, vendorServices, vendorEventTypes } from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

export const SEED_VENDOR_ID = '00000000-0000-0000-0000-000000000001';
const SERVICE_PHOTO_ID      = '00000000-0000-0000-0000-000000000010';
const SERVICE_VIDEO_ID      = '00000000-0000-0000-0000-000000000011';

export async function seedVendors(): Promise<void> {
  // Vendor record for seed-vendor-001
  await db
    .insert(vendors)
    .values({
      id:           SEED_VENDOR_ID,
      userId:       'seed-vendor-001',
      businessName: 'Kapoor Moments Photography',
      category:     'PHOTOGRAPHY',
      city:         'Mumbai',
      state:        'Maharashtra',
      verified:     true,
      rating:       '4.80',
      totalReviews: 142,
      isActive:     true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    })
    .onConflictDoNothing();

  // Services
  await db
    .insert(vendorServices)
    .values([
      {
        id:          SERVICE_PHOTO_ID,
        vendorId:    SEED_VENDOR_ID,
        name:        'Full-Day Wedding Photography',
        description: 'Coverage from Haldi to Reception — 600+ edited photos, 2 photographers, online gallery',
        priceFrom:   '75000.00',
        priceTo:     '150000.00',
        currency:    'INR',
        isActive:    true,
        createdAt:   new Date(),
      },
      {
        id:          SERVICE_VIDEO_ID,
        vendorId:    SEED_VENDOR_ID,
        name:        'Wedding Highlight Film (4K)',
        description: '5-minute cinematic film + raw footage, drone shots included',
        priceFrom:   '50000.00',
        priceTo:     '100000.00',
        currency:    'INR',
        isActive:    true,
        createdAt:   new Date(),
      },
    ])
    .onConflictDoNothing();

  // Event types this vendor covers
  const eventTypes = ['WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION'] as const;
  for (const eventType of eventTypes) {
    await db
      .insert(vendorEventTypes)
      .values({ vendorId: SEED_VENDOR_ID, eventType, available: true })
      .onConflictDoNothing();
  }

  console.info('✅ Vendors + services + event types seeded');
  await pool.end();
}
