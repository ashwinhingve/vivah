import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { user, profiles } from '../schema/index.js';

// Load root .env — CWD is packages/db/ so go up two levels
config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

const TEST_USERS = [
  {
    id: 'seed-individual-001',
    name: 'Test Individual',
    email: 'individual@test.smartshaadi.co.in',
    phoneNumber: '+919999999001',
    role: 'INDIVIDUAL',
    status: 'ACTIVE',
  },
  {
    id: 'seed-vendor-001',
    name: 'Test Vendor',
    email: 'vendor@test.smartshaadi.co.in',
    phoneNumber: '+919999999002',
    role: 'VENDOR',
    status: 'ACTIVE',
  },
  {
    id: 'seed-admin-001',
    name: 'Test Admin',
    email: 'admin@test.smartshaadi.co.in',
    phoneNumber: '+919999999003',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
] as const;

export async function seedAuthUsers(): Promise<void> {
  for (const u of TEST_USERS) {
    // Insert user (ignore if already exists)
    await db
      .insert(user)
      .values({
        id:                   u.id,
        name:                 u.name,
        email:                u.email,
        emailVerified:        true,
        phoneNumber:          u.phoneNumber,
        phoneNumberVerified:  true,
        role:                 u.role,
        status:               u.status,
        createdAt:            new Date(),
        updatedAt:            new Date(),
      })
      .onConflictDoNothing();

    // Insert matching profile row
    await db
      .insert(profiles)
      .values({
        userId:              u.id,
        verificationStatus:  'PENDING',
        premiumTier:         'FREE',
        profileCompleteness: 0,
        isActive:            true,
        createdAt:           new Date(),
        updatedAt:           new Date(),
      })
      .onConflictDoNothing();
  }

  console.info('✅ Auth seed users created (+profiles)');
  await pool.end();
}
