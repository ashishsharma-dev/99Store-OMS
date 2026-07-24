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
