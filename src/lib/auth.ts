import crypto from 'crypto';

/**
 * Hashes a plain text password using SHA-256.
 * @param password The plain text password
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Generates a random 6-digit OTP code.
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
