// In-memory cache variables for XpressBees token
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Retrieves a cached XpressBees JWT login token or fetches a new one if expired.
 * Tokens are cached for 12 hours.
 */
export async function getXpressBeesToken(config: any): Promise<string> {
  const baseUrl = config.baseUrl || 'https://shipment.xpressbees.com/api';
  const email = config.email;
  const password = config.password;
  const secretKey = config.secretKey;
  const authType = config.authType || 'new';
  const tokenUrl = config.tokenUrl || 'https://userauthapis.xbees.in/api/auth/generateToken';

  // Simulation mode fallback
  if (!email || !password || email.includes('example.com') || email.startsWith('your-') || email.includes('mock')) {
    return 'MOCK_TOKEN_12345';
  }

  // Check if token exists in cache and hasn't expired yet
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetch(authType === 'new' ? tokenUrl : `${baseUrl}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: authType === 'new' 
        ? JSON.stringify({ username: email, password, secretkey: secretKey })
        : JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`XpressBees Login HTTP status error: ${res.status}. ${text}`);
    }

    const data = await res.json();
    const token = data.token || data.data || (data.data && data.data.token);

    if (!token) {
      throw new Error(`XpressBees Login returned error or missing token: ${JSON.stringify(data)}`);
    }

    // Cache the token for 12 hours (conservatively within the 24h validity window)
    cachedToken = token;
    tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;

    return token;
  } catch (err: any) {
    // Clear cache on error to force retry on next request
    cachedToken = null;
    tokenExpiresAt = 0;
    throw new Error(`Failed to fetch token from XpressBees: ${err.message}`);
  }
}
