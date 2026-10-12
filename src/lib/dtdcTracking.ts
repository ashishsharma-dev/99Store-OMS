import { fetchWithRetry, HttpError } from './fetchWithRetry';

const DTDC_TRACKING_URLS = {
  production: {
    auth: 'https://blktracksvc.dtdc.com/dtdc-api/api/dtdc/authenticate',
    track: 'https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails',
  },
  staging: {
    auth: 'https://dtdcstagingapi.dtdc.com/dtdc-api/api/dtdc/authenticate',
    track: 'https://dtdcstagingapi.dtdc.com/dtdc-tracking-api/dtdc-api/rest/JSONCnTrk/getTrackDetails',
  },
} as const;

type TrackingFetch = typeof fetchWithRetry;

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const TOKEN_CACHE_TTL_MS = 45 * 60 * 1000;

export class DtdcTrackingError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamBody?: string,
  ) {
    super(message);
    this.name = 'DtdcTrackingError';
  }
}

function cleanToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function extractDtdcTrackingToken(responseText: string, headers?: Headers): string {
  const headerToken = cleanToken(
    headers?.get('x-access-token') || headers?.get('X-Access-Token'),
  );
  if (headerToken) return headerToken;

  try {
    const body = JSON.parse(responseText);
    const jsonToken = cleanToken(
      body?.token ||
      body?.accessToken ||
      body?.access_token ||
      body?.xAccessToken ||
      body?.['x-access-token'] ||
      body?.data?.token ||
      body?.data?.accessToken ||
      body?.data?.access_token ||
      (typeof body?.data === 'string' ? body.data : ''),
    );
    return jsonToken;
  } catch {
    // DTDC can return the token as plain text rather than JSON.
  }

  const plainToken = cleanToken(responseText);
  return plainToken && !plainToken.startsWith('<') ? plainToken : '';
}

function isCredentialConfigured(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) &&
    !['username', 'password', 'changeme'].includes(normalized) &&
    !normalized.includes('placeholder');
}

function cacheKey(isStaging: boolean, username: string): string {
  return `${isStaging ? 'staging' : 'production'}:${username}`;
}

async function authenticate(
  username: string,
  password: string,
  isStaging: boolean,
  fetcher: TrackingFetch,
): Promise<string> {
  if (!isCredentialConfigured(username) || !isCredentialConfigured(password)) {
    throw new DtdcTrackingError(
      'DTDC tracking credentials are incomplete. Configure DTDC_USERNAME and DTDC_PASSWORD.',
    );
  }

  const urls = DTDC_TRACKING_URLS[isStaging ? 'staging' : 'production'];
  const authUrl = `${urls.auth}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  try {
    const response = await fetcher(
      authUrl,
      { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
      { courierName: 'DTDC Tracking Auth', timeoutMs: 10000, maxAttempts: 2 },
    );
    const responseText = await response.text();
    const token = extractDtdcTrackingToken(responseText, response.headers);

    if (!token) {
      throw new DtdcTrackingError(
        'DTDC authentication succeeded but did not return a tracking token.',
        response.status,
      );
    }

    tokenCache.set(cacheKey(isStaging, username), {
      token,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });
    return token;
  } catch (error) {
    if (error instanceof DtdcTrackingError) throw error;
    if (error instanceof HttpError) {
      throw new DtdcTrackingError(
        error.status === 401 || error.status === 403
          ? 'DTDC rejected the tracking username or password.'
          : `DTDC tracking authentication failed with HTTP ${error.status}.`,
        error.status,
        error.bodyText,
      );
    }
    throw new DtdcTrackingError(
      `DTDC tracking authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export interface TrackDtdcShipmentOptions {
  waybill: string;
  username: string;
  password: string;
  configuredAccessToken?: string;
  isStaging: boolean;
  fetcher?: TrackingFetch;
}

export interface TrackDtdcShipmentResult {
  data: any;
  requestUrl: string;
  requestPayload: {
    trkType: 'cnno';
    strcnno: string;
    addtnlDtl: 'Y';
  };
  tokenRefreshed: boolean;
}

export async function trackDtdcShipment({
  waybill,
  username,
  password,
  configuredAccessToken = '',
  isStaging,
  fetcher = fetchWithRetry,
}: TrackDtdcShipmentOptions): Promise<TrackDtdcShipmentResult> {
  const urls = DTDC_TRACKING_URLS[isStaging ? 'staging' : 'production'];
  const key = cacheKey(isStaging, username);
  const cached = tokenCache.get(key);
  let token = cached && cached.expiresAt > Date.now()
    ? cached.token
    : cleanToken(configuredAccessToken);
  let tokenRefreshed = false;

  if (!token) {
    token = await authenticate(username, password, isStaging, fetcher);
    tokenRefreshed = true;
  }

  const requestPayload = {
    trkType: 'cnno' as const,
    strcnno: waybill,
    addtnlDtl: 'Y' as const,
  };

  const requestTracking = (accessToken: string) => fetcher(
    urls.track,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': accessToken,
      },
      body: JSON.stringify(requestPayload),
      cache: 'no-store',
    },
    {
      awb: waybill,
      courierName: 'DTDC',
      timeoutMs: 10000,
      maxAttempts: 3,
    },
  );

  let response: Response;
  try {
    response = await requestTracking(token);
  } catch (error) {
    if (!(error instanceof HttpError) || (error.status !== 401 && error.status !== 403)) {
      throw error;
    }

    // A configured or cached DTDC token may have expired. Refresh it once and retry.
    tokenCache.delete(key);
    token = await authenticate(username, password, isStaging, fetcher);
    tokenRefreshed = true;
    try {
      response = await requestTracking(token);
    } catch (retryError) {
      if (retryError instanceof HttpError && (retryError.status === 401 || retryError.status === 403)) {
        tokenCache.delete(key);
        throw new DtdcTrackingError(
          'DTDC rejected the refreshed tracking token. Verify the DTDC tracking credentials with DTDC support.',
          retryError.status,
          retryError.bodyText,
        );
      }
      throw retryError;
    }
  }

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { error: responseText };
  }

  return { data, requestUrl: urls.track, requestPayload, tokenRefreshed };
}
