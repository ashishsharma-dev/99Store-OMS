const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(projectRoot, 'data', 'db.json');
const envPath = path.join(projectRoot, '.env.local');
const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
const settings = database.settings || {};

const mappings = [
  ['GOOGLE_SHEET_WEBHOOK_URL', settings.googleSheetWebhookUrl],
  ['WHATSAPP_DEVICE_ID', settings.whatsappDeviceId],
  ['WHATSAPP_ACCESS_TOKEN', settings.whatsappAccessToken],
  ['WALABZ_USERNAME', settings.walabzUsername],
  ['WALABZ_PASSWORD', settings.walabzPassword],
  ['WALABZ_API_KEY', settings.walabzApiKey],
  ['DTDC_API_KEY', settings.dtdcConfig?.apiKey],
  ['DTDC_USERNAME', settings.dtdcConfig?.username],
  ['DTDC_PASSWORD', settings.dtdcConfig?.password],
  ['DTDC_ACCESS_TOKEN', settings.dtdcConfig?.accessToken],
  ['DTDC_CUSTOMER_CODE', settings.dtdcConfig?.customerCode],
  ['XPRESSBEES_API_KEY', settings.xpressbeesConfig?.apiKey],
  ['XPRESSBEES_EMAIL', settings.xpressbeesConfig?.email],
  ['XPRESSBEES_PASSWORD', settings.xpressbeesConfig?.password],
  ['XPRESSBEES_SECRET_KEY', settings.xpressbeesConfig?.secretKey],
  ['XPRESSBEES_XB_KEY', settings.xpressbeesConfig?.xbKey],
  ['XPRESSBEES_AIR_EMAIL', settings.xpressbeesConfig?.airAccount?.email],
  ['XPRESSBEES_AIR_PASSWORD', settings.xpressbeesConfig?.airAccount?.password],
  ['XPRESSBEES_AIR_SECRET_KEY', settings.xpressbeesConfig?.airAccount?.secretKey],
  ['XPRESSBEES_AIR_XB_KEY', settings.xpressbeesConfig?.airAccount?.xbKey],
  ['XPRESSBEES_SURFACE_EMAIL', settings.xpressbeesConfig?.surfaceAccount?.email],
  ['XPRESSBEES_SURFACE_PASSWORD', settings.xpressbeesConfig?.surfaceAccount?.password],
  ['XPRESSBEES_SURFACE_SECRET_KEY', settings.xpressbeesConfig?.surfaceAccount?.secretKey],
  ['XPRESSBEES_SURFACE_XB_KEY', settings.xpressbeesConfig?.surfaceAccount?.xbKey],
  ['DELHIVERY_API_KEY', settings.deliveryConfig?.apiKey],
  ['SHADOWFAX_API_KEY', settings.shadowfaxConfig?.apiKey],
];

// The persisted settings may only contain the active XpressBees account. Recover
// the previously committed seed account values without printing them.
try {
  const historicalMockData = execFileSync('git', ['show', 'HEAD:src/lib/mockData.ts'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const accountValues = accountName => {
    const block = historicalMockData.match(new RegExp(`${accountName}: \\{([\\s\\S]*?)\\n    \\}`))?.[1] || '';
    const read = key => block.match(new RegExp(`${key}: '([^']*)'`))?.[1];
    return { email: read('email'), password: read('password'), secretKey: read('secretKey'), xbKey: read('xbKey') };
  };
  const air = accountValues('airAccount');
  const surface = accountValues('surfaceAccount');
  mappings.push(
    ['XPRESSBEES_AIR_EMAIL', air.email],
    ['XPRESSBEES_AIR_PASSWORD', air.password],
    ['XPRESSBEES_AIR_SECRET_KEY', air.secretKey],
    ['XPRESSBEES_AIR_XB_KEY', air.xbKey],
    ['XPRESSBEES_SURFACE_EMAIL', surface.email],
    ['XPRESSBEES_SURFACE_PASSWORD', surface.password],
    ['XPRESSBEES_SURFACE_SECRET_KEY', surface.secretKey],
    ['XPRESSBEES_SURFACE_XB_KEY', surface.xbKey],
  );
} catch {
  // A source archive is optional; active persisted credentials are still migrated.
}

let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const existingKeys = new Set(
  envContent.split(/\r?\n/).map(line => line.match(/^\s*([^#=\s]+)\s*=/)?.[1]).filter(Boolean),
);
const added = [];

for (const [name, rawValue] of mappings) {
  if (rawValue === undefined || rawValue === null || String(rawValue) === '' || existingKeys.has(name)) continue;
  if (envContent && !envContent.endsWith('\n')) envContent += '\n';
  envContent += `${name}=${JSON.stringify(String(rawValue))}\n`;
  existingKeys.add(name);
  added.push(name);
}

fs.writeFileSync(envPath, envContent, 'utf8');

function clear(object, keys) {
  if (!object) return;
  for (const key of keys) {
    if (key in object) object[key] = '';
  }
}

clear(settings, ['googleSheetWebhookUrl', 'whatsappDeviceId', 'whatsappAccessToken', 'walabzUsername', 'walabzPassword', 'walabzApiKey']);
clear(settings.dtdcConfig, ['apiKey', 'username', 'password', 'accessToken', 'customerCode']);
clear(settings.xpressbeesConfig, ['apiKey', 'email', 'password', 'secretKey', 'xbKey']);
clear(settings.xpressbeesConfig?.airAccount, ['email', 'password', 'secretKey', 'xbKey']);
clear(settings.xpressbeesConfig?.surfaceAccount, ['email', 'password', 'secretKey', 'xbKey']);
clear(settings.deliveryConfig, ['apiKey']);
clear(settings.shadowfaxConfig, ['apiKey']);

fs.writeFileSync(databasePath, JSON.stringify(database), 'utf8');

const mockDataPath = path.join(projectRoot, 'src', 'lib', 'mockData.ts');
let mockDataSource = fs.readFileSync(mockDataPath, 'utf8');
const settingsStart = mockDataSource.indexOf('export const mockSettings: SystemSettings = {');
const settingsEnd = mockDataSource.indexOf('export const mockOrders:', settingsStart);
if (settingsStart < 0 || settingsEnd < 0) throw new Error('Could not locate mockSettings for credential redaction.');
let settingsSource = mockDataSource.slice(settingsStart, settingsEnd);
for (const key of ['apiKey', 'username', 'password', 'accessToken', 'email', 'secretKey', 'xbKey', 'customerCode']) {
  const pattern = new RegExp(`(^\\s*${key}:\\s*)'[^']*'`, 'gm');
  settingsSource = settingsSource.replace(pattern, `$1''`);
}
mockDataSource = mockDataSource.slice(0, settingsStart) + settingsSource + mockDataSource.slice(settingsEnd);
fs.writeFileSync(mockDataPath, mockDataSource, 'utf8');

const dbSourcePath = path.join(projectRoot, 'src', 'lib', 'db.ts');
let dbSource = fs.readFileSync(dbSourcePath, 'utf8');
const legacyStart = dbSource.indexOf('          if (\n            settings.dtdcConfig &&');
const legacyEnd = dbSource.indexOf('          return settings;', legacyStart);
if (legacyStart >= 0 && legacyEnd > legacyStart) {
  dbSource = dbSource.slice(0, legacyStart) + dbSource.slice(legacyEnd);
  fs.writeFileSync(dbSourcePath, dbSource, 'utf8');
}

const settingsPagePath = path.join(projectRoot, 'src', 'app', 'dashboard', 'settings', 'page.tsx');
let settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
settingsPage = settingsPage
  .replace(/const \[shadowfaxApiKey, setShadowfaxApiKey\] = useState\([^;]+\);/, "const [shadowfaxApiKey, setShadowfaxApiKey] = useState('');")
  ;
fs.writeFileSync(settingsPagePath, settingsPage, 'utf8');

console.log(`Credential migration complete. Added ${added.length} protected variables to .env.local and redacted tracked credential values.`);
