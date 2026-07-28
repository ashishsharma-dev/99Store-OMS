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
 * - DTDC: Unserviceable for Zone 7 (pincode starts with 7)
 * - XpressBees: Unserviceable for Zone 6 (pincode starts with 6)
 * - Delhivery: Unserviceable for Zone 5 (pincode starts with 5)
 * - Velocity / Aggregator: Unserviceable for Zone 3 (pincode starts with 3)
 */
export const checkCourierServiceability = (pincode: string, courier: string): boolean => {
  if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
    return false;
  }
  const prefix = pincode.charAt(0);
  const normalizedCourier = courier.toLowerCase();

  if (normalizedCourier.includes('dtdc')) {
    return prefix !== '7';
  }
  if (normalizedCourier.includes('xpressbees')) {
    return prefix !== '6';
  }
  if (normalizedCourier.includes('delhivery')) {
    return prefix !== '5';
  }
  if (normalizedCourier.includes('velocity') || normalizedCourier.includes('aggregator')) {
    return prefix !== '3';
  }

  return true;
};

