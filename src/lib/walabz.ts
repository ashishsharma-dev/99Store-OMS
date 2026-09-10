/**
 * Walabz WhatsApp Business API Client Library
 * Reference: scratch/walabz-api-reference.md
 * Platform: https://walabz.com
 */

export interface WalabzConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  defaultCountryCode?: string;
  defaultDialCode?: string;
}

export interface WalabzTemplate {
  _id: string;
  id?: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  language: string;
  template_type: 'simple' | 'dynamic';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body: string;
  footer?: string;
  buttons?: Array<{ type: string; text: string; value?: string }>;
  variables?: string[];
  sample_values?: Record<string, string>;
  authentication?: {
    otp_type?: string;
    button_text?: string;
    add_security_recommendation?: boolean;
    code_expiration_minutes?: number;
    message_send_ttl_seconds?: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface SendCampaignOptions {
  campaignName: string;
  templateId: string;
  recipients: string[]; // Phone numbers (e.g. ['919876543210'] or ['9876543210'])
  variableMappings?: Record<string, string>; // e.g. { "1": "John", "2": "ORD-101" }
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  mediaFilename?: string;
  countryCode?: string;
  dialCode?: string;
  action?: 'send' | 'draft';
}

export interface CampaignResult {
  success: boolean;
  campaignId?: string;
  message?: string;
  error?: string;
  rawResponse?: any;
}

export interface CampaignProgress {
  status: 'queued' | 'preparing' | 'processing' | 'completed' | 'failed' | string;
  total?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  percentage?: number;
  raw?: any;
}

// In-memory token cache for username/password authentication
let cachedToken: {
  token: string;
  expiresAt: number;
  username: string;
} | null = null;

export class WalabzClient {
  private baseUrl: string;
  private username?: string;
  private password?: string;
  private apiKey?: string;
  private defaultCountryCode: string;
  private defaultDialCode: string;

  constructor(config?: WalabzConfig) {
    let raw = (
      config?.baseUrl ||
      process.env.WALABZ_BASE_URL ||
      'https://walabz.com'
    ).trim().replace(/\/+$/, '');

    if (raw.endsWith('/api')) {
      raw = raw.slice(0, -4).replace(/\/+$/, '');
    }
    this.baseUrl = raw || 'https://walabz.com';

    this.username = config?.username || process.env.WALABZ_USERNAME;
    this.password = config?.password || process.env.WALABZ_PASSWORD;
    this.apiKey = config?.apiKey || process.env.WALABZ_API_KEY;
    this.defaultCountryCode = config?.defaultCountryCode || 'IN';
    this.defaultDialCode = config?.defaultDialCode || '91';
  }

  /**
   * Cleans and normalizes phone numbers into E.164 without '+' (e.g. 919876543210)
   */
  public normalizePhoneNumber(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      clean = (this.defaultDialCode || '91') + clean;
    }
    return clean;
  }

  /**
   * Resolves bearer token (prioritizing robust JWT authentication with API key fallback)
   */
  private async getAuthToken(forceRefresh = false): Promise<string> {
    const now = Date.now();

    // If we have a cached valid JWT token and not forcing refresh, use it
    if (
      !forceRefresh &&
      cachedToken &&
      cachedToken.username === this.username &&
      cachedToken.expiresAt > now + 60000
    ) {
      return cachedToken.token;
    }

    // 1. If username & password are provided, authenticate via /auth/login/api
    if (this.username && this.password) {
      try {
        const loginUrl = `${this.baseUrl}/auth/login/api`;
        const res = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            username: this.username,
            password: this.password
          }),
          signal: AbortSignal.timeout(10000)
        });

        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Walabz login response not JSON (HTTP ${res.status}): ${text.slice(0, 100)}`);
        }

        if (res.ok && data.access_token) {
          cachedToken = {
            token: data.access_token,
            expiresAt: now + 23 * 3600 * 1000,
            username: this.username
          };
          return cachedToken.token;
        } else {
          console.warn('[Walabz Client] Username/password login failed:', data.detail || data.error);
          if (this.apiKey && this.apiKey.trim()) {
            return this.apiKey.trim();
          }
          throw new Error(data.detail || data.error || data.message || `Walabz login failed (HTTP ${res.status})`);
        }
      } catch (loginErr: any) {
        if (this.apiKey && this.apiKey.trim()) {
          return this.apiKey.trim();
        }
        throw loginErr;
      }
    }

    // 2. Fall back to apiKey if username/password not provided
    if (this.apiKey && this.apiKey.trim()) {
      return this.apiKey.trim();
    }

    throw new Error('Walabz credentials missing: Provide Username & Password or an API Key in Settings.');
  }

  /**
   * Generic authenticated HTTP request with auto-retry on 401
   */
  private async authenticatedFetch(
    endpoint: string,
    options: RequestInit = {},
    hasRetried = false
  ): Promise<Response> {
    const token = await this.getAuthToken(hasRetried);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');

    const res = await fetch(url, {
      ...options,
      headers
    });

    // If 401 and we haven't retried, refresh token and retry
    if (res.status === 401 && !hasRetried && this.username && this.password) {
      console.warn('[Walabz Client] Received 401 Unauthorized. Retrying with fresh JWT authentication...');
      cachedToken = null;
      return this.authenticatedFetch(endpoint, options, true);
    }

    return res;
  }

  /**
   * Tests connection and credentials against Walabz
   */
  public async testConnection(): Promise<{
    success: boolean;
    user?: any;
    templatesCount?: number;
    error?: string;
  }> {
    try {
      const templates = await this.getTemplates('approved');
      return {
        success: true,
        templatesCount: templates.length
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Connection failed'
      };
    }
  }

  /**
   * Fetches list of templates from Walabz
   */
  public async getTemplates(status?: 'approved' | 'draft' | 'pending' | 'rejected'): Promise<WalabzTemplate[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.authenticatedFetch(`/api/templates/list${query}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse templates JSON: ${text.slice(0, 150)}`);
    }

    if (!res.ok) {
      throw new Error(data.detail || data.error || data.message || `HTTP ${res.status}`);
    }

    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.templates)) {
      return data.templates;
    }
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

    return [];
  }

  /**
   * Fetches a single template by ID
   */
  public async getTemplateById(templateId: string): Promise<WalabzTemplate | null> {
    const res = await this.authenticatedFetch(`/api/templates/${templateId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000)
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch template ${templateId} (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.template || data;
  }

  /**
   * Synchronizes template status with Meta
   */
  public async syncTemplateStatus(templateId: string): Promise<any> {
    const res = await this.authenticatedFetch(`/api/templates/${templateId}/sync-status`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000)
    });
    return res.json();
  }

  /**
   * Dispatches a transactional campaign message via POST /api/campaigns/create
   */
  public async sendCampaign(options: SendCampaignOptions): Promise<CampaignResult> {
    const {
      campaignName,
      templateId,
      recipients,
      variableMappings = {},
      mediaUrl,
      mediaType,
      mediaFilename,
      countryCode = this.defaultCountryCode,
      dialCode = this.defaultDialCode,
      action = 'send'
    } = options;

    if (!templateId) {
      return { success: false, error: 'Missing template_id' };
    }

    const cleanNumbers = recipients
      .map(r => this.normalizePhoneNumber(r))
      .filter(r => /^\d{11,15}$/.test(r));

    if (cleanNumbers.length === 0) {
      return { success: false, error: 'No valid recipient phone numbers provided' };
    }

    try {
      const formData = new FormData();
      formData.append('campaign_name', campaignName || `Camp-${Date.now()}`);
      formData.append('template_id', templateId);
      formData.append('audience_source', 'manual');
      formData.append('manual_numbers', cleanNumbers.join(','));
      formData.append('variable_mappings', JSON.stringify(variableMappings));
      formData.append('country_code', countryCode || 'IN');
      formData.append('dial_code', dialCode || '91');
      formData.append('action', action);

      if (mediaUrl) {
        formData.append('media_url', mediaUrl);
        if (mediaType) {
          formData.append('media_type', mediaType);
        }
        if (mediaFilename) {
          formData.append('media_filename', mediaFilename);
        }
      }

      const res = await this.authenticatedFetch('/api/campaigns/create', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000)
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: `Walabz campaign response not valid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
        };
      }

      if (!res.ok || data.success === false) {
        const errMsg = data.detail || data.error || data.message || `Walabz API error (HTTP ${res.status})`;
        return {
          success: false,
          error: errMsg,
          rawResponse: data
        };
      }

      return {
        success: true,
        campaignId: data.campaign_id || data.id,
        message: data.message || 'Campaign queued successfully',
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network failure when contacting Walabz API'
      };
    }
  }

  /**
   * Polls campaign progress: GET /api/campaigns/{campaign_id}/progress
   */
  public async getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
    const res = await this.authenticatedFetch(`/api/campaigns/${campaignId}/progress`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      throw new Error(`Failed to get campaign progress (HTTP ${res.status})`);
    }

    const data = await res.json();
    return {
      status: data.status || 'unknown',
      total: data.total,
      sent: data.sent,
      delivered: data.delivered,
      read: data.read,
      failed: data.failed,
      percentage: data.percentage,
      raw: data
    };
  }

  /**
   * Retrieves message-level delivery report for a campaign: GET /api/reports/messages/{campaign_id}
   */
  public async getCampaignMessages(campaignId: string): Promise<any[]> {
    const res = await this.authenticatedFetch(`/api/reports/messages/${campaignId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`Failed to get campaign messages (HTTP ${res.status})`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data.messages || [];
  }
}
