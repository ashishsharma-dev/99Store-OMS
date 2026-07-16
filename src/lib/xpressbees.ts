// In-memory cache map for XpressBees tokens per email account
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

/**
 * Retrieves a cached XpressBees JWT login token or fetches a new one if expired.
 * Tokens are cached for 12 hours per account email.
 */
export async function getXpressBeesToken(rawConfig: any): Promise<string> {
  const config = resolveXpressBeesConfig(rawConfig);
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
  if (tokenCache[email] && now < tokenCache[email].expiresAt) {
    return tokenCache[email].token;
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
    let token: string | undefined;
    if (typeof data.token === 'string' && data.token) token = data.token;
    else if (typeof data.Token === 'string' && data.Token) token = data.Token;
    else if (typeof data.TokenNumber === 'string' && data.TokenNumber) token = data.TokenNumber;
    else if (typeof data.data === 'string' && data.data) token = data.data;
    else if (data.data && typeof data.data.token === 'string' && data.data.token) token = data.data.token;
    else if (data.data && typeof data.data.Token === 'string' && data.data.Token) token = data.data.Token;
    else if (data.data && typeof data.data.TokenNumber === 'string' && data.data.TokenNumber) token = data.data.TokenNumber;

    if (!token || typeof token !== 'string') {
      throw new Error(`XpressBees Login returned error or missing token string: ${JSON.stringify(data)}`);
    }

    // Cache the token for 12 hours (conservatively within the 24h validity window)
    tokenCache[email] = {
      token,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    };

    return token;
  } catch (err: any) {
    delete tokenCache[email];
    throw new Error(`Failed to fetch token from XpressBees: ${err.message}`);
  }
}

/**
 * Resolves active XpressBees credentials (Air vs Surface) based on requested account mode or system defaults.
 */
export function resolveXpressBeesConfig(xbConfig: any, accountOverride?: string) {
  if (!xbConfig) return {};
  const mode = (accountOverride || xbConfig.activeAccount || 'Air').toLowerCase();
  const isSurface = mode.includes('surface') || mode.includes('sfc');
  
  const selectedSubAccount = isSurface ? xbConfig.surfaceAccount : xbConfig.airAccount;
  
  return {
    ...xbConfig,
    email: selectedSubAccount?.email || xbConfig.email,
    password: selectedSubAccount?.password || xbConfig.password,
    secretKey: selectedSubAccount?.secretKey || xbConfig.secretKey,
    xbKey: selectedSubAccount?.xbKey || xbConfig.xbKey,
    activeAccount: isSurface ? 'Surface' : 'Air'
  };
}
