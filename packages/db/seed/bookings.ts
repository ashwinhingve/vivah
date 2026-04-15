/**
 * Bookings seed — creates a sample booking + payment for test individual.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { bookings, payments } from '../schema/index.js';
import { SEED_VENDOR_ID } from './vendors.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

const BOOKING_ID = '00000000-0000-0000-0000-000000000020';
const PAYMENT_ID = '00000000-0000-0000-0000-000000000030';

export async function seedBookings(): Promise<void> {
  // Sample booking: individual-001 books vendor-001 for wedding
  await db
    .insert(bookings)
    .values({
      id:            BOOKING_ID,
      customerId:    'seed-individual-001',
      vendorId:      SEED_VENDOR_ID,
      eventDate:     '2026-12-10',
      ceremonyType:  'WEDDING',
      status:        'CONFIRMED',
      totalAmount:   '100000.00',
      notes:         'Full-day photography for December wedding in Pune',
      createdAt:     new Date(),
      updatedAt:     new Date(),
    })
    .onConflictDoNothing();

  // Payment for the booking
  await db
    .insert(payments)
    .values({
      id:               PAYMENT_ID,
      bookingId:        BOOKING_ID,
      amount:           '50000.00',       // 50% advance
      currency:         'INR',
      status:           'CAPTURED',
      razorpayOrderId:  'order_seed_001',
      razorpayPaymentId: 'pay_seed_001',
      method:           'UPI',
      createdAt:        new Date(),
    })
    .onConflictDoNothing();

  console.info('✅ Sample bookings + payments seeded');
  await pool.end();
}
