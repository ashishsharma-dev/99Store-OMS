import crypto from 'crypto';

/**
 * Hashes a plain text password using SHA-256.
 * @param password The plain text password
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Generates a random 6-digit OTP code.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function isOtpBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DISABLE_OTP === 'true';
}

export function verifyOtp(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
