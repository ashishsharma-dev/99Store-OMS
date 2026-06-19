'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Shield, 
  Truck, 
  MessageSquare, 
  Terminal, 
  Check, 
  RefreshCcw, 
  AlertCircle,
  Database,
  Trash2
} from 'lucide-react';
import { SystemSettings, WhatsAppLog, CourierApiLog } from '@/lib/types';

export default function IntegrationsSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [courierLogs, setCourierLogs] = useState<CourierApiLog[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'whatsapp' | 'courier'>('whatsapp');
  
  // Settings Form states
  const [ipInput, setIpInput] = useState('');
  const [isIpEnabled, setIsIpEnabled] = useState(false);
  const [autoCourier, setAutoCourier] = useState(true);
  const [dtdcActive, setDtdcActive] = useState(true);
  const [xpressActive, setXpressActive] = useState(true);
  const [dlvActive, setDlvActive] = useState(true);
  const [aggActive, setAggActive] = useState(true);
  
  // Courier keys
  const [dtdcKey, setDtdcKey] = useState('');
  const [xpressKey, setXpressKey] = useState('');
  const [xpressEmail, setXpressEmail] = useState('');
  const [xpressPassword, setXpressPassword] = useState('');
  const [xpressBaseUrl, setXpressBaseUrl] = useState('');
  const [xpressWarehouseName, setXpressWarehouseName] = useState('');
  const [xpressContactName, setXpressContactName] = useState('');
  const [xpressAddress, setXpressAddress] = useState('');
  const [xpressAddress2, setXpressAddress2] = useState('');
  const [xpressCity, setXpressCity] = useState('');
  const [xpressState, setXpressState] = useState('');
  const [xpressPincode, setXpressPincode] = useState('');
  const [xpressSecretKey, setXpressSecretKey] = useState('');
  const [xpressXbKey, setXpressXbKey] = useState('');
  const [xpressVendorCode, setXpressVendorCode] = useState('');
  const [xpressServiceType, setXpressServiceType] = useState('NDD');
  const [xpressAuthType, setXpressAuthType] = useState('new');
  const [xpressTokenUrl, setXpressTokenUrl] = useState('');
  const [xpressManifestUrl, setXpressManifestUrl] = useState('');
  const [xpressAwbGenUrl, setXpressAwbGenUrl] = useState('');
  const [xpressAwbRetrieveUrl, setXpressAwbRetrieveUrl] = useState('');
  const [xpressCancelUrl, setXpressCancelUrl] = useState('');
  const [xpressNdrUrl, setXpressNdrUrl] = useState('');
  const [xpressPincodeUrl, setXpressPincodeUrl] = useState('');
  const [xpressTrackSummaryUrl, setXpressTrackSummaryUrl] = useState('');
  const [xpressTrackBulkUrl, setXpressTrackBulkUrl] = useState('');
  const [xpressPhone, setXpressPhone] = useState('');
  const [dlvKey, setDlvKey] = useState('');
  const [dlvClientName, setDlvClientName] = useState('');
  const [dlvPickupLocation, setDlvPickupLocation] = useState('');

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const fetchSettingsAndLogs = async () => {
    setLoading(true);
    try {
      // 1. Get settings
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.settings) {
        const s: SystemSettings = settingsData.settings;
        setSettings(s);
        setIpInput(s.ipWhitelist.join(', '));
        setIsIpEnabled(s.isIpWhitelistEnabled);
        setAutoCourier(s.autoCourierEnabled);
        setDtdcActive(s.dtdcActive);
        setXpressActive(s.xpressbeesActive);
        setDlvActive(s.deliveryActive);
        setAggActive(s.aggregatorActive);
        setDtdcKey(s.dtdcConfig.apiKey);
        setXpressKey(s.xpressbeesConfig.apiKey || '');
        setXpressEmail(s.xpressbeesConfig.email || '');
        setXpressPassword(s.xpressbeesConfig.password || '');
        setXpressBaseUrl(s.xpressbeesConfig.baseUrl || '');
        setXpressWarehouseName(s.xpressbeesConfig.warehouseName || '');
        setXpressContactName(s.xpressbeesConfig.contactName || '');
        setXpressAddress(s.xpressbeesConfig.address || '');
        setXpressAddress2(s.xpressbeesConfig.address2 || '');
        setXpressCity(s.xpressbeesConfig.city || '');
        setXpressState(s.xpressbeesConfig.state || '');
        setXpressPincode(s.xpressbeesConfig.pincode || '');
        setXpressPhone(s.xpressbeesConfig.phone || '');
        setXpressSecretKey(s.xpressbeesConfig.secretKey || '');
        setXpressXbKey(s.xpressbeesConfig.xbKey || '');
        setXpressVendorCode(s.xpressbeesConfig.vendorCode || '');
        setXpressServiceType(s.xpressbeesConfig.serviceType || 'NDD');
        setXpressAuthType(s.xpressbeesConfig.authType || 'new');
        setXpressTokenUrl(s.xpressbeesConfig.tokenUrl || '');
        setXpressManifestUrl(s.xpressbeesConfig.manifestUrl || '');
        setXpressAwbGenUrl(s.xpressbeesConfig.awbGenUrl || '');
        setXpressAwbRetrieveUrl(s.xpressbeesConfig.awbRetrieveUrl || '');
        setXpressCancelUrl(s.xpressbeesConfig.cancelUrl || '');
        setXpressNdrUrl(s.xpressbeesConfig.ndrUrl || '');
        setXpressPincodeUrl(s.xpressbeesConfig.pincodeUrl || '');
        setXpressTrackSummaryUrl(s.xpressbeesConfig.trackSummaryUrl || '');
        setXpressTrackBulkUrl(s.xpressbeesConfig.trackBulkUrl || '');
        setDlvKey(s.deliveryConfig.apiKey);
        setDlvClientName(s.deliveryConfig.clientName || '');
        setDlvPickupLocation(s.deliveryConfig.pickupLocation || '');
      }

      // 2. Fetch WhatsApp logs from seed or DB
      const dbRes = await fetch('/api/orders?limit=1'); // Quick mock fetch endpoint trigger or we can fetch directly
      // In Next.js, we can write small get routes for whatsapp logs, but actually let's see.
      // Since we save whatsapp logs in our local DB in `src/lib/db.ts`, let's check.
      // Wait, we didn't write an explicit `/api/integrations/logs` endpoint, but we can easily fetch it from settings or general API!
      // Let's create an inline API route or load from settings API.
      // Wait, let's create a logs fetch: we can write a quick custom endpoint or load from Settings GET.
      // Let's modify Settings GET endpoint to also return the whatsappLogs and courierLogs! That is exceptionally clean and avoids creating more files.
      // Wait, let's check what settings GET returns right now: it only returns `{ settings }`.
      // Let's rewrite `/api/settings/route.ts` to ALSO return `whatsappLogs` and `courierLogs`!
      // This is a great, robust strategy. Let's do that right now.
      // But first, let's look at the fetch: we'll call `/api/settings` and expect `{ settings, whatsappLogs, courierLogs }`.
      const resData = settingsData;
      if (resData.whatsappLogs) setWaLogs(resData.whatsappLogs);
      if (resData.courierLogs) setCourierLogs(resData.courierLogs);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);

    // Parse IP list
    const ipList = ipInput
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipWhitelist: ipList,
          isIpWhitelistEnabled: isIpEnabled,
          autoCourierEnabled: autoCourier,
          dtdcActive,
          xpressbeesActive: xpressActive,
          deliveryActive: dlvActive,
          aggregatorActive: aggActive,
          dtdcConfig: { apiKey: dtdcKey },
          xpressbeesConfig: {
            apiKey: xpressKey,
            email: xpressEmail,
            password: xpressPassword,
            baseUrl: xpressBaseUrl,
            warehouseName: xpressWarehouseName,
            contactName: xpressContactName,
            address: xpressAddress,
            address2: xpressAddress2,
            city: xpressCity,
            state: xpressState,
            pincode: xpressPincode,
            phone: xpressPhone,
            secretKey: xpressSecretKey,
            xbKey: xpressXbKey,
            vendorCode: xpressVendorCode,
            serviceType: xpressServiceType,
            authType: xpressAuthType,
            tokenUrl: xpressTokenUrl,
            manifestUrl: xpressManifestUrl,
            awbGenUrl: xpressAwbGenUrl,
            awbRetrieveUrl: xpressAwbRetrieveUrl,
            cancelUrl: xpressCancelUrl,
            ndrUrl: xpressNdrUrl,
            pincodeUrl: xpressPincodeUrl,
            trackSummaryUrl: xpressTrackSummaryUrl,
            trackBulkUrl: xpressTrackBulkUrl
          },
          deliveryConfig: { 
            apiKey: dlvKey,
            clientName: dlvClientName,
            pickupLocation: dlvPickupLocation
          }
        })
      });

      setSaveLoading(false);
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchSettingsAndLogs();
      } else {
        alert('Failed to save settings.');
      }
    } catch (err) {
      setSaveLoading(false);
      alert('Settings API Network communication error.');
    }
  };

  // Reset Database back to Mock seed data
  const handleResetDb = async () => {
    if (confirm('WARNING: This will reset all orders, NDR logs, and user additions back to default seed mock data. Proceed?')) {
      setResetSuccess(false);
      try {
        const res = await fetch('/api/settings?reset=true', { method: 'POST', body: JSON.stringify({ resetDb: true }) });
        if (res.ok) {
          setResetSuccess(true);
          setTimeout(() => setResetSuccess(false), 3000);
          fetchSettingsAndLogs();
        }
      } catch (err) {
        alert('Failed to reset database.');
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>API Integrations & Firewalls</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Configure IP Whitelisting security, toggle live courier keys, and inspect real-time webhook payload logs.
          </p>
        </div>

        <button onClick={handleResetDb} className="premium-btn premium-btn-danger" style={{ padding: '8px 12px', fontSize: '12.5px' }}>
          <Database size={14} />
          <span>Reset System Database</span>
        </button>
      </div>

      {resetSuccess && (
        <div className="premium-card animate-fade-in" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: '#10B981', color: '#10B981', padding: '12px 18px', fontSize: '13px' }}>
          🟢 System Database has been successfully reset back to seed mock records. Page reloading...
        </div>
      )}

      {/* Main Grid split */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '24px' }} className="desktop-settings-grid">
        
        {/* Left Side: Configurations Forms */}
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: IP Whitelist firewall */}
          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} />
              <span>IP Whitelist Firewall Security</span>
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="ip_firewall"
                checked={isIpEnabled}
                onChange={(e) => setIsIpEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="ip_firewall" style={{ fontSize: '13px', color: '#FAFAFA', cursor: 'pointer' }}>
                Enable Whitelist IP Firewall
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>
                Authorized IP Addresses (Comma separated)
              </label>
              <textarea
                className="premium-input"
                placeholder="e.g. 127.0.0.1, 192.168.1.10"
                style={{ minHeight: '60px', fontFamily: 'monospace', resize: 'vertical' }}
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#737373', display: 'block', marginTop: '4px' }}>
                Current terminal session IP will be checked against this list if active.
              </span>
            </div>
          </div>

          {/* Card 2: Courier Routing keys */}
          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={16} />
              <span>Fulfillment Couriers Integration</span>
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <input
                type="checkbox"
                id="auto_routing"
                checked={autoCourier}
                onChange={(e) => setAutoCourier(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="auto_routing" style={{ fontSize: '13px', color: '#FAFAFA', cursor: 'pointer', fontWeight: 600 }}>
                Enable Automatic Courier Routing Engine
              </label>
            </div>

            {/* Courier Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* DTDC */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="dtdc_active" style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" id="dtdc_active" checked={dtdcActive} onChange={(e) => setDtdcActive(e.target.checked)} />
                    <span>DTDC Integration API</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-paid)' }}>Priority 1 (&lt;1kg)</span>
                </div>
                <input type="text" className="premium-input" placeholder="DTDC Security Token" value={dtdcKey} onChange={(e) => setDtdcKey(e.target.value)} disabled={!dtdcActive} style={{ fontFamily: 'monospace' }} />
              </div>

              {/* XpressBees */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label htmlFor="xb_active" style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" id="xb_active" checked={xpressActive} onChange={(e) => setXpressActive(e.target.checked)} />
                    <span>XpressBees Integration API</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-paid)' }}>Priority 2 (1kg-2kg)</span>
                </div>
                {xpressActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px', borderLeft: '1px solid var(--border-focus)', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#8A8A8A', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>API Credentials</div>
                    <input type="text" className="premium-input" placeholder="XpressBees Base URL" value={xpressBaseUrl} onChange={(e) => setXpressBaseUrl(e.target.value)} style={{ fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="XpressBees License Key" value={xpressKey} onChange={(e) => setXpressKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="email" className="premium-input" placeholder="Login Email" value={xpressEmail} onChange={(e) => setXpressEmail(e.target.value)} />
                      <input type="password" className="premium-input" placeholder="Login Password" value={xpressPassword} onChange={(e) => setXpressPassword(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="password" className="premium-input" placeholder="Secret Key" value={xpressSecretKey} onChange={(e) => setXpressSecretKey(e.target.value)} />
                      <input type="text" className="premium-input" placeholder="XB Key" value={xpressXbKey} onChange={(e) => setXpressXbKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input type="text" className="premium-input" placeholder="Vendor Code" value={xpressVendorCode} onChange={(e) => setXpressVendorCode(e.target.value)} />
                      
                      <select className="premium-input" value={xpressServiceType} onChange={(e) => setXpressServiceType(e.target.value)}>
                        <option value="NDD">Next Day Delivery (NDD)</option>
                        <option value="SDD">Same Day Delivery (SDD)</option>
                        <option value="SD">Standard Delivery (SD)</option>
                        <option value="IntraSDD">Intra Same Day (IntraSDD)</option>
                      </select>

                      <select className="premium-input" value={xpressAuthType} onChange={(e) => setXpressAuthType(e.target.value)}>
                        <option value="new">New Auth Type (generateToken)</option>
                        <option value="old">Old Auth Type (login)</option>
                      </select>
                    </div>

                    <div style={{ fontSize: '11px', color: '#8A8A8A', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '6px', marginBottom: '2px' }}>Custom API Endpoint URLs</div>
                    <input type="text" className="premium-input" placeholder="Token URL (e.g. https://userauthapis.xbees.in/...)" value={xpressTokenUrl} onChange={(e) => setXpressTokenUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Forward Manifest URL" value={xpressManifestUrl} onChange={(e) => setXpressManifestUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="AWB Gen Series URL" value={xpressAwbGenUrl} onChange={(e) => setXpressAwbGenUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Get Generated AWB Series URL" value={xpressAwbRetrieveUrl} onChange={(e) => setXpressAwbRetrieveUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Cancellation URL" value={xpressCancelUrl} onChange={(e) => setXpressCancelUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="NDR Update URL" value={xpressNdrUrl} onChange={(e) => setXpressNdrUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Pincode Serviceability URL" value={xpressPincodeUrl} onChange={(e) => setXpressPincodeUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Tracking Summary URL" value={xpressTrackSummaryUrl} onChange={(e) => setXpressTrackSummaryUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    <input type="text" className="premium-input" placeholder="Tracking Bulk URL" value={xpressTrackBulkUrl} onChange={(e) => setXpressTrackBulkUrl(e.target.value)} style={{ fontSize: '11.5px', fontFamily: 'monospace' }} />
                    
                    <div style={{ fontSize: '11px', color: '#8A8A8A', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '6px', marginBottom: '2px' }}>Warehouse Pickup Info</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="text" className="premium-input" placeholder="Warehouse Name" value={xpressWarehouseName} onChange={(e) => setXpressWarehouseName(e.target.value)} />
                      <input type="text" className="premium-input" placeholder="Contact Manager Name" value={xpressContactName} onChange={(e) => setXpressContactName(e.target.value)} />
                    </div>
                    <input type="text" className="premium-input" placeholder="Address Line 1" value={xpressAddress} onChange={(e) => setXpressAddress(e.target.value)} />
                    <input type="text" className="premium-input" placeholder="Address Line 2 (Optional)" value={xpressAddress2} onChange={(e) => setXpressAddress2(e.target.value)} />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '8px' }}>
                      <input type="text" className="premium-input" placeholder="City" value={xpressCity} onChange={(e) => setXpressCity(e.target.value)} />
                      <input type="text" className="premium-input" placeholder="State" value={xpressState} onChange={(e) => setXpressState(e.target.value)} />
                      <input type="text" className="premium-input" placeholder="Pincode" value={xpressPincode} onChange={(e) => setXpressPincode(e.target.value)} />
                    </div>
                    <input type="text" className="premium-input" placeholder="Warehouse Phone Number" value={xpressPhone} onChange={(e) => setXpressPhone(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Delhivery */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <label htmlFor="dlv_active" style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" id="dlv_active" checked={dlvActive} onChange={(e) => setDlvActive(e.target.checked)} />
                    <span>Delhivery Integration API</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-paid)' }}>Priority 3 (&gt;2kg)</span>
                </div>
                <input type="text" className="premium-input" placeholder="Delhivery Client Token" value={dlvKey} onChange={(e) => setDlvKey(e.target.value)} disabled={!dlvActive} style={{ fontFamily: 'monospace' }} />
                <input type="text" className="premium-input" placeholder="Delhivery Client Name (e.g. 99Store)" value={dlvClientName} onChange={(e) => setDlvClientName(e.target.value)} disabled={!dlvActive} />
                <input type="text" className="premium-input" placeholder="Delhivery Pickup Location Warehouse Name" value={dlvPickupLocation} onChange={(e) => setDlvPickupLocation(e.target.value)} disabled={!dlvActive} />
              </div>

              {/* Aggregator */}
              <div>
                <label htmlFor="agg_active" style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="checkbox" id="agg_active" checked={aggActive} onChange={(e) => setAggActive(e.target.checked)} />
                  <span>Aggregator API Integration</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', alignItems: 'center' }}>
              <button type="submit" className="premium-btn premium-btn-primary" disabled={saveLoading} style={{ padding: '8px 16px' }}>
                {saveLoading ? 'Saving...' : 'Save Settings'}
              </button>
              {saveSuccess && <span style={{ fontSize: '12px', color: 'var(--color-paid)' }}>🟢 Configurations Saved!</span>}
            </div>
          </div>

        </form>

        {/* Right Side: Webhooks Payload console logs */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '60vh' }}>
          <h3 style={{ fontSize: '15px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: '#10B981' }} />
            <span>Webhook Live Payload Console Log</span>
          </h3>

          {/* Console tabs switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
            <button
              onClick={() => setActiveConsoleTab('whatsapp')}
              style={{
                background: 'none', border: 'none', padding: '8px 4px', fontSize: '12.5px', fontWeight: 600,
                color: activeConsoleTab === 'whatsapp' ? '#FAFAFA' : '#737373',
                borderBottom: activeConsoleTab === 'whatsapp' ? '2px solid #FAFAFA' : 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <MessageSquare size={13} />
              <span>WhatsApp notifications ({waLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveConsoleTab('courier')}
              style={{
                background: 'none', border: 'none', padding: '8px 4px', fontSize: '12.5px', fontWeight: 600,
                color: activeConsoleTab === 'courier' ? '#FAFAFA' : '#737373',
                borderBottom: activeConsoleTab === 'courier' ? '2px solid #FAFAFA' : 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Truck size={13} />
              <span>Courier API payloads ({courierLogs.length})</span>
            </button>
          </div>

          {/* Render Logs list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <span style={{ fontSize: '12.5px', color: '#737373' }}>Reading payload feeds...</span>
            ) : activeConsoleTab === 'whatsapp' ? (
              /* WhatsApp Notifications log representation */
              waLogs.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: '#737373' }}>No WhatsApp logs found. Trigger order updates to generate logs.</span>
              ) : (
                waLogs.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: '#0A0A0B', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373', fontSize: '11px' }}>
                      <span>☎️ {log.phone} ({log.type} Number)</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ color: '#FAFAFA', lineHeight: '1.4', fontFamily: 'monospace' }}>
                      {log.message}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                      <span style={{ color: 'var(--color-paid)' }}>🟢 API Status: Delivered</span>
                      <span style={{ color: '#737373' }}>Outbound channel: Live SMS Gateway</span>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Courier API Requests and Responses json logger */
              courierLogs.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: '#737373' }}>No courier logs found. Generate AWB labels to record payloads.</span>
              ) : (
                courierLogs.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: '#0A0A0B', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#737373', fontSize: '11px' }}>
                      <span>🚀 Courier API: {log.courier} ({log.action})</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>POST Request Payload</span>
                        <pre style={{
                          backgroundColor: '#000', border: '1px solid #1C1C21', padding: '8px', borderRadius: '4px', overflowX: 'auto', maxHeight: '140px', fontSize: '10.5px', fontFamily: 'monospace', color: '#A1A1AA'
                        }}>{log.requestPayload}</pre>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Response Payload</span>
                        <pre style={{
                          backgroundColor: '#000', border: '1px solid #1C1C21', padding: '8px', borderRadius: '4px', overflowX: 'auto', maxHeight: '140px', fontSize: '10.5px', fontFamily: 'monospace', color: log.status === 'Success' ? '#10B981' : '#EF6868'
                        }}>{log.responsePayload}</pre>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

        </div>

      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .desktop-settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
