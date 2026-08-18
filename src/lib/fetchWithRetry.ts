/**
 * Robust fetch utility with timeout, retry backoff, response validation,
 * structured logging, and non-retryable error handling for Courier APIs.
 */

export interface FetchRetryConfig {
  timeoutMs?: number; // Default 10000 (10 seconds)
  maxAttempts?: number; // Default 3 attempts
  initialDelayMs?: number; // Default 300ms
  backoffFactor?: number; // Default 2
  validateStatus?: boolean; // Default true (throws HttpError for !response.ok)
  awb?: string;
  courierName?: string;
  fetchFn?: typeof fetch; // Optional custom fetch implementation for unit testing
}

export class HttpError extends Error {
  public status: number;
  public statusText: string;
  public isRetryable: boolean;
  public bodyText: string;

  constructor(status: number, statusText: string, bodyText: string = '', isRetryable: boolean = false) {
    super(`HTTP ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
    this.isRetryable = isRetryable;
  }
}

/**
 * Determines whether an HTTP status code is retryable.
 * Retries for 408 (Request Timeout), 429 (Too Many Requests), and 5xx Server Errors.
 * Does NOT retry for 400, 401, 403, 404, or other 4xx client errors.
 */
export function isRetryableStatusCode(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * Classifies an error into a structured category for logging and telemetry.
 */
export function getErrorCategory(err: any, status?: number): string {
  if (status) {
    if (status === 429) return 'HTTP_429_TOO_MANY_REQUESTS';
    if (status === 408) return 'HTTP_408_REQUEST_TIMEOUT';
    if (status >= 500) return 'HTTP_5XX_SERVER_ERROR';
    if (status >= 400 && status < 500) return 'HTTP_4XX_CLIENT_ERROR';
  }

  const errName = err?.name || '';
  const errCode = err?.code || err?.cause?.code || '';
  const errMsg = err?.message || '';

  if (
    errName === 'AbortError' ||
    errName === 'TimeoutError' ||
    errMsg.toLowerCase().includes('timeout') ||
    errMsg.toLowerCase().includes('aborted')
  ) {
    return 'TIMEOUT_ERROR';
  }

  if (
    errCode === 'ECONNRESET' ||
    errCode === 'ETIMEDOUT' ||
    errCode === 'ENOTFOUND' ||
    errCode === 'ECONNREFUSED' ||
    errCode === 'EPIPE' ||
    errMsg.includes('ECONNRESET') ||
    errMsg.includes('fetch failed')
  ) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Determines if an error (Network, Timeout, or HttpError) should trigger a retry attempt.
 */
export function isRetryableError(err: any): boolean {
  if (err instanceof HttpError) {
    return err.isRetryable;
  }

  const category = getErrorCategory(err);
  return category === 'NETWORK_ERROR' || category === 'TIMEOUT_ERROR';
}

/**
 * Executes an HTTP fetch request with automatic retries, backoff, and timeouts.
 */
export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit = {},
  config: FetchRetryConfig = {}
): Promise<Response> {
  const timeoutMs = config.timeoutMs ?? 10000;
  const maxAttempts = config.maxAttempts ?? 3;
  const initialDelayMs = config.initialDelayMs ?? 300;
  const backoffFactor = config.backoffFactor ?? 2;
  const validateStatus = config.validateStatus ?? true;
  const awb = config.awb || 'N/A';
  const courierName = config.courierName || 'Courier';
  const fetchImpl = config.fetchFn || fetch;

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxAttempts) {
    attempt++;

    let controller: AbortController | null = null;
    let timer: NodeJS.Timeout | null = null;
    let signal = init.signal;

    // Attach 10s timeout signal
    if (!init.signal) {
      if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
        try {
          signal = AbortSignal.timeout(timeoutMs);
        } catch (e) {
          controller = new AbortController();
          timer = setTimeout(() => controller?.abort(), timeoutMs);
          signal = controller.signal;
        }
      } else {
        controller = new AbortController();
        timer = setTimeout(() => controller?.abort(), timeoutMs);
        signal = controller.signal;
      }
    }

    try {
      const response = await fetchImpl(url, {
        ...init,
        signal
      });

      if (timer) clearTimeout(timer);

      if (validateStatus && !response.ok) {
        // Consume response body to prevent socket leaks before throwing/retrying
        const bodyText = await response.text().catch(() => '');
        const retryable = isRetryableStatusCode(response.status);
        throw new HttpError(response.status, response.statusText || 'Error', bodyText, retryable);
      }

      return response;

    } catch (err: any) {
      if (timer) clearTimeout(timer);

      const status = err instanceof HttpError ? err.status : undefined;
      const category = getErrorCategory(err, status);
      const retryable = isRetryableError(err);

      // Structured logging without exposing tokens, passwords, or PII
      console.warn(
        `[Courier Fetch Retry] Attempt ${attempt}/${maxAttempts} | AWB: ${awb} | Courier: ${courierName} | Category: ${category} | Status: ${status || 'N/A'} | Retryable: ${retryable}`
      );

      if (!retryable || attempt >= maxAttempts) {
        throw err;
      }

      // Wait backoff delay before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }

  throw new Error(`[Courier Fetch] Maximum attempts (${maxAttempts}) exceeded for AWB: ${awb}`);
}
