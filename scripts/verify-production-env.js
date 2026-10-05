const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const required = [
  'AUTH_SESSION_SECRET',
  'MONGODB_URI',
  'NEXT_PUBLIC_APP_URL',
];

const errors = [];

for (const key of required) {
  if (!process.env[key]?.trim()) errors.push(`${key} is required`);
}

if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length < 32) {
  errors.push('AUTH_SESSION_SECRET must contain at least 32 characters');
}

if (process.env.USE_MONGODB !== 'true') {
  errors.push('USE_MONGODB must be true in production');
}

if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
  errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production');
}

for (const key of [
  'DISABLE_OTP',
  'ALLOW_UNSIGNED_WEBHOOKS',
  'ALLOW_COURIER_SIMULATION',
  'NEXT_PUBLIC_ENABLE_DEMO_TOOLS',
]) {
  if (process.env[key] === 'true') errors.push(`${key} must not be true in production`);
}

if (errors.length > 0) {
  console.error('Production environment validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Production environment validation passed.');
