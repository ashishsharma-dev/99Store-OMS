import type { SystemSettings } from './types';

function fromEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : (fallback || '');
}

export function applyIntegrationSecrets(settings: SystemSettings): SystemSettings {
  const xpressbeesConfig = settings.xpressbeesConfig || { apiKey: '', priority: 2 };

  return {
    ...settings,
    googleSheetWebhookUrl: fromEnv('GOOGLE_SHEET_WEBHOOK_URL', settings.googleSheetWebhookUrl),
    whatsappDeviceId: fromEnv('WHATSAPP_DEVICE_ID', settings.whatsappDeviceId),
    whatsappAccessToken: fromEnv('WHATSAPP_ACCESS_TOKEN', settings.whatsappAccessToken),
    walabzUsername: fromEnv('WALABZ_USERNAME', settings.walabzUsername),
    walabzPassword: fromEnv('WALABZ_PASSWORD', settings.walabzPassword),
    walabzApiKey: fromEnv('WALABZ_API_KEY', settings.walabzApiKey),
    dtdcConfig: {
      ...settings.dtdcConfig,
      apiKey: fromEnv('DTDC_API_KEY', settings.dtdcConfig?.apiKey),
      username: fromEnv('DTDC_USERNAME', settings.dtdcConfig?.username),
      password: fromEnv('DTDC_PASSWORD', settings.dtdcConfig?.password),
      accessToken: fromEnv('DTDC_ACCESS_TOKEN', settings.dtdcConfig?.accessToken),
      customerCode: fromEnv('DTDC_CUSTOMER_CODE', settings.dtdcConfig?.customerCode),
    },
    xpressbeesConfig: {
      ...xpressbeesConfig,
      apiKey: fromEnv('XPRESSBEES_API_KEY', xpressbeesConfig.apiKey),
      email: fromEnv('XPRESSBEES_EMAIL', xpressbeesConfig.email),
      password: fromEnv('XPRESSBEES_PASSWORD', xpressbeesConfig.password),
      secretKey: fromEnv('XPRESSBEES_SECRET_KEY', xpressbeesConfig.secretKey),
      xbKey: fromEnv('XPRESSBEES_XB_KEY', xpressbeesConfig.xbKey),
      airAccount: xpressbeesConfig.airAccount ? {
        ...xpressbeesConfig.airAccount,
        email: fromEnv('XPRESSBEES_AIR_EMAIL', xpressbeesConfig.airAccount.email),
        password: fromEnv('XPRESSBEES_AIR_PASSWORD', xpressbeesConfig.airAccount.password),
        secretKey: fromEnv('XPRESSBEES_AIR_SECRET_KEY', xpressbeesConfig.airAccount.secretKey),
        xbKey: fromEnv('XPRESSBEES_AIR_XB_KEY', xpressbeesConfig.airAccount.xbKey),
      } : undefined,
      surfaceAccount: xpressbeesConfig.surfaceAccount ? {
        ...xpressbeesConfig.surfaceAccount,
        email: fromEnv('XPRESSBEES_SURFACE_EMAIL', xpressbeesConfig.surfaceAccount.email),
        password: fromEnv('XPRESSBEES_SURFACE_PASSWORD', xpressbeesConfig.surfaceAccount.password),
        secretKey: fromEnv('XPRESSBEES_SURFACE_SECRET_KEY', xpressbeesConfig.surfaceAccount.secretKey),
        xbKey: fromEnv('XPRESSBEES_SURFACE_XB_KEY', xpressbeesConfig.surfaceAccount.xbKey),
      } : undefined,
    },
    deliveryConfig: {
      ...settings.deliveryConfig,
      apiKey: fromEnv('DELHIVERY_API_KEY', settings.deliveryConfig?.apiKey),
    },
    shadowfaxConfig: {
      ...settings.shadowfaxConfig,
      apiKey: fromEnv('SHADOWFAX_API_KEY', settings.shadowfaxConfig?.apiKey),
    },
  };
}

export function stripIntegrationSecrets(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    googleSheetWebhookUrl: '',
    whatsappDeviceId: '',
    whatsappAccessToken: '',
    walabzUsername: '',
    walabzPassword: '',
    walabzApiKey: '',
    dtdcConfig: {
      ...settings.dtdcConfig,
      apiKey: '',
      username: '',
      password: '',
      accessToken: '',
      customerCode: '',
    },
    xpressbeesConfig: {
      ...settings.xpressbeesConfig,
      apiKey: '',
      email: '',
      password: '',
      secretKey: '',
      xbKey: '',
      airAccount: settings.xpressbeesConfig.airAccount ? {
        ...settings.xpressbeesConfig.airAccount,
        email: '',
        password: '',
        secretKey: '',
        xbKey: '',
      } : undefined,
      surfaceAccount: settings.xpressbeesConfig.surfaceAccount ? {
        ...settings.xpressbeesConfig.surfaceAccount,
        email: '',
        password: '',
        secretKey: '',
        xbKey: '',
      } : undefined,
    },
    deliveryConfig: { ...settings.deliveryConfig, apiKey: '' },
    shadowfaxConfig: { ...settings.shadowfaxConfig, apiKey: '' },
  };
}
