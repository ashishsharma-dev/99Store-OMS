// In-memory cache map for XpressBees tokens per email account
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};
const pendingTokens = new Map<string, Promise<string>>();

/**
 * Retrieves a cached XpressBees JWT login token or fetches a new one if expired.
 * Tokens are cached for 12 hours per account email.
 */
export async function getXpressBeesToken(rawConfig: any, forceRefresh: boolean = false): Promise<string> {
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

  // Check if token exists in cache and hasn't expired yet (unless forceRefresh is requested)
  const now = Date.now();
  if (forceRefresh) {
    delete tokenCache[email];
  } else if (tokenCache[email] && now < tokenCache[email].expiresAt) {
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

    // Cache the token for 15 minutes (short window to avoid stale/expired token rejection)
    tokenCache[email] = {
      token,
      expiresAt: Date.now() + 15 * 60 * 1000
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

/** API success does not mean that a pincode is serviceable. */
export function parseXpressBeesServiceability(data: any, pincode: string): boolean | null {
  if (data?.error || (data?.ReturnCode != null && String(data.ReturnCode) !== '100')) return null;
  const rows = Array.isArray(data) ? data : data?.data ?? data?.Data ?? data?.PincodeDetails;
  const row = Array.isArray(rows)
    ? rows.find((item: any) => String(item.Pincode ?? item.PinCode ?? item.pincode ?? item.code) === pincode)
    : rows && typeof rows === 'object' ? rows : data;
  if (Array.isArray(rows) && !row) return false;
  for (const key of ['serviceable', 'Serviceable', 'IsServiceable', 'isServiceable', 'Delivery', 'delivery']) {
    const value = row?.[key];
    if (value === true || value === 1 || /^(true|yes|y|1)$/i.test(String(value))) return true;
    if (value === false || value === 0 || /^(false|no|n|0)$/i.test(String(value))) return false;
  }
  return null;
}

export async function checkXpressBeesServiceability(pincode: string, rawConfig: any, courier?: string): Promise<boolean | null> {
  const override = /surface|sfc/i.test(courier || '') ? 'Surface' : /air/i.test(courier || '') ? 'Air' : undefined;
  const config = resolveXpressBeesConfig(rawConfig, override);
  const key = JSON.stringify([config.email, config.activeAccount, config.tokenUrl]);
  let pending = pendingTokens.get(key);
  if (!pending) {
    pending = getXpressBeesToken(config).finally(() => pendingTokens.delete(key));
    pendingTokens.set(key, pending);
  }
  const token = await pending;
  if (token.startsWith('MOCK')) return null;
  const url = new URL(config.pincodeUrl || 'https://xbmasterapi.xbees.in/expose/get/serviceabilitypincode/details');
  url.searchParams.set('pincode', pincode);
  const response = await fetch(url, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Token: token, XBKey: config.xbKey || '' },
    body: JSON.stringify({ BusinessUnit: 'B2C', BusinessFlow: 'Forward', BusinessService: config.activeAccount }),
  });
  if (!response.ok) throw new Error(`XpressBees serviceability HTTP ${response.status}`);
  return parseXpressBeesServiceability(await response.json(), pincode);
}
