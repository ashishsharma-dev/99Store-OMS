import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyIntegrationSecrets, stripIntegrationSecrets } from '../src/lib/integrationSecrets';
import { mockSettings } from '../src/lib/mockData';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

describe('integration credential environment storage', () => {
  it('uses protected environment values instead of persisted credential fields', () => {
    process.env.DTDC_API_KEY = 'env-dtdc-key';
    process.env.XPRESSBEES_AIR_SECRET_KEY = 'env-air-secret';
    process.env.SHADOWFAX_API_KEY = 'env-shadowfax-key';

    const settings = structuredClone(mockSettings);
    settings.dtdcConfig.apiKey = 'persisted-dtdc-key';
    settings.xpressbeesConfig.airAccount!.secretKey = 'persisted-air-secret';
    settings.shadowfaxConfig.apiKey = 'persisted-shadowfax-key';

    const hydrated = applyIntegrationSecrets(settings);
    assert.equal(hydrated.dtdcConfig.apiKey, 'env-dtdc-key');
    assert.equal(hydrated.xpressbeesConfig.airAccount?.secretKey, 'env-air-secret');
    assert.equal(hydrated.shadowfaxConfig.apiKey, 'env-shadowfax-key');
  });

  it('removes integration credentials before database or backup persistence', () => {
    const settings = structuredClone(mockSettings);
    settings.whatsappAccessToken = 'whatsapp-secret';
    settings.dtdcConfig.password = 'dtdc-secret';
    settings.xpressbeesConfig.password = 'xpress-secret';
    settings.deliveryConfig.apiKey = 'delhivery-secret';
    settings.shadowfaxConfig.apiKey = 'shadowfax-secret';

    const persisted = stripIntegrationSecrets(settings);
    assert.equal(persisted.whatsappAccessToken, '');
    assert.equal(persisted.dtdcConfig.password, '');
    assert.equal(persisted.xpressbeesConfig.password, '');
    assert.equal(persisted.deliveryConfig.apiKey, '');
    assert.equal(persisted.shadowfaxConfig.apiKey, '');
  });
});
