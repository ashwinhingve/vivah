// Pre-populate all required env vars before any module loads.
// This file is run before every test file via vitest.config.ts > setupFiles.
process.env['NODE_ENV'] = 'test';
process.env['USE_MOCK_SERVICES'] = 'true';
process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long!!';
process.env['DATABASE_URL'] = 'postgresql://localhost:5432/vivah_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['MSG91_API_KEY'] = 'test-msg91-api-key';
process.env['MSG91_TEMPLATE_ID'] = 'test-template-id';
process.env['FRONTEND_URL'] = 'http://localhost:3000';

process.env['CLOUDFLARE_R2_ACCOUNT_ID'] = 'test-account-id';
process.env['CLOUDFLARE_R2_ACCESS_KEY'] = 'test-access-key';
process.env['CLOUDFLARE_R2_SECRET_KEY'] = 'test-secret-key';
process.env['CLOUDFLARE_R2_BUCKET']     = 'smart-shaadi-media';
process.env['AWS_REKOGNITION_REGION']   = 'ap-south-1';
