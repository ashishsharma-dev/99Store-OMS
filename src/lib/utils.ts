/**
 * Controls visibility of the Phase 2 (100%) client-facing UI features.
 * Unlocked via passphrase "UNLOCK-99STORE-100".
 */
export const SHOW_FULL_CLIENT_RELEASE = process.env.NEXT_PUBLIC_SHOW_FULL_CLIENT_RELEASE !== 'false';

/**
 * Maps a username to their user display name (full name).
 * If the username is not recognized, returns the original username.
 */
export const getUserDisplayName = (username: string): string => {
  if (!username) return 'N/A';
  const nameMap: Record<string, string> = {
    'admin': 'Aniket Sharma (Super Admin)',
    'super_admin': 'Aniket Sharma (Super Admin)',
    'superadmin': 'Aniket Sharma (Super Admin)',
    'order_user': 'Rahul K. (Order Team)',
    'packing_user': 'Suresh Kumar (Packing Team)',
    'tracking_user': 'Neha Mehta (Tracking Team)',
    'accounts_user': 'Rohan Shah (Accounts Team)'
  };
  return nameMap[username.toLowerCase()] || username;
};

/**
 * Checks courier serviceability based on the destination pincode.
 * - Dynamic couriers (XpressBees, Shadowfax, Velocity): returns null (unconfirmed until live booking/API verification)
 * - Standard couriers (DTDC, Delhivery, etc.): returns true for valid 6-digit Indian postal codes, false for malformed pincodes.
 */
export const checkCourierServiceability = (pincode: string, courier: string): boolean | null => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    return false;
  }
  const normalizedCourier = courier.toLowerCase();

  if (
    normalizedCourier.includes('xpressbees') ||
    normalizedCourier.includes('xbees') ||
    normalizedCourier.includes('shadowfax') ||
    normalizedCourier.includes('sfx') ||
    normalizedCourier.includes('velocity')
  ) {
    return null;
  }

  // Indian postal codes start with digits 1-9
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return false;
  }

  return true;
};

