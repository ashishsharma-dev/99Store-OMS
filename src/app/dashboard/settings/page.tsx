'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Truck, 
  MessageSquare, 
  Terminal, 
  Check, 
  Database,
  Key,
  Globe,
  MapPin,
  Layers,
  Search,
  Sliders,
  Sparkles,
  Save,
  Activity,
  Server,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { SystemSettings, WhatsAppLog, CourierApiLog } from '@/lib/types';

export default function IntegrationsSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [courierLogs, setCourierLogs] = useState<CourierApiLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab states for organized clutter-free UX
  const [activeMainTab, setActiveMainTab] = useState<'couriers' | 'security' | 'console' | 'contacts'>('couriers');
  const [activeCourierSubTab, setActiveCourierSubTab] = useState<'xpressbees' | 'dtdc' | 'delhivery' | 'routing'>('xpressbees');
  const [activeXpressSubTab, setActiveXpressSubTab] = useState<'credentials' | 'endpoints' | 'warehouse'>('credentials');
  const [activeConsoleTab, setActiveConsoleTab] = useState<'courier' | 'whatsapp'>('courier');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [primaryContacts, setPrimaryContacts] = useState('');
  const [secondaryContacts, setSecondaryContacts] = useState('');

  // Settings Form states
  const [otpWhatsappNumber, setOtpWhatsappNumber] = useState('');
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

  // DTDC Extra fields
  const [dtdcCustomerCode, setDtdcCustomerCode] = useState('');
  const [dtdcServiceType, setDtdcServiceType] = useState('B2C PRIORITY');
  const [dtdcCommodityId, setDtdcCommodityId] = useState('2');
  const [dtdcUsername, setDtdcUsername] = useState('');
  const [dtdcPassword, setDtdcPassword] = useState('');

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
    fetchSettingsAndLogs();
  }, []);

  const fetchSettingsAndLogs = async () => {
    setLoading(true);
    try {
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.settings) {
        const s: SystemSettings = settingsData.settings;
        setSettings(s);
        setPrimaryContacts(s.primaryContactNumbers ? s.primaryContactNumbers.join(', ') : '+91 9876543210, +91 9876543211');
        setSecondaryContacts(s.secondaryContactNumbers ? s.secondaryContactNumbers.join(', ') : '+91 9123456789, +91 9123456780');
        setOtpWhatsappNumber(s.otpWhatsappNumber || '');
        setIpInput(s.ipWhitelist.join(', '));
        setIsIpEnabled(s.isIpWhitelistEnabled);
        setAutoCourier(s.autoCourierEnabled);
        setDtdcActive(s.dtdcActive);
        setXpressActive(s.xpressbeesActive);
        setDlvActive(s.deliveryActive);
        setAggActive(s.aggregatorActive);
        setDtdcKey(s.dtdcConfig.apiKey || '');
        setDtdcCustomerCode(s.dtdcConfig.customerCode || '');
        setDtdcServiceType(s.dtdcConfig.serviceTypeId || 'B2C PRIORITY');
        setDtdcCommodityId(s.dtdcConfig.commodityId || '2');
        setDtdcUsername(s.dtdcConfig.username || '');
        setDtdcPassword(s.dtdcConfig.password || '');
        const activeXpKey = s.xpressbeesConfig.apiKey?.startsWith('xb_live_key') ? (s.xpressbeesConfig.xbKey || 'JnueT39994Dyats') : (s.xpressbeesConfig.apiKey || s.xpressbeesConfig.xbKey || 'JnueT39994Dyats');
        setXpressKey(activeXpKey);
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
        setDlvKey(s.deliveryConfig.apiKey || '');
        setDlvClientName(s.deliveryConfig.clientName || '');
        setDlvPickupLocation(s.deliveryConfig.pickupLocation || '');
      }

      if (settingsData.whatsappLogs) setWaLogs(settingsData.whatsappLogs);
      if (settingsData.courierLogs) setCourierLogs(settingsData.courierLogs);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);

    const ipList = ipInput
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);

    try {
      const userRole = currentUser?.role || 'User';
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': userRole
        },
        body: JSON.stringify({
          userRole,
          primaryContactNumbers: primaryContacts.split(',').map(n => n.trim()).filter(n => n.length > 0),
          secondaryContactNumbers: secondaryContacts.split(',').map(n => n.trim()).filter(n => n.length > 0),
          otpWhatsappNumber,
          ipWhitelist: ipList,
          isIpWhitelistEnabled: isIpEnabled,
          autoCourierEnabled: autoCourier,
          dtdcActive,
          xpressbeesActive: xpressActive,
          deliveryActive: dlvActive,
          aggregatorActive: aggActive,
          dtdcConfig: { 
            apiKey: dtdcKey,
            customerCode: dtdcCustomerCode,
            serviceTypeId: dtdcServiceType,
            commodityId: dtdcCommodityId,
            username: dtdcUsername,
            password: dtdcPassword
          },
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

      const data = await res.json();
      setSaveLoading(false);
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        fetchSettingsAndLogs();
      } else {
        alert(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      setSaveLoading(false);
      alert('Settings API Network communication error.');
    }
  };

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

  const filteredCourierLogs = courierLogs.filter(log => 
    !logSearchQuery || 
    log.courier.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    log.requestPayload.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    log.responsePayload.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  const filteredWaLogs = waLogs.filter(log => 
    !logSearchQuery ||
    log.phone.includes(logSearchQuery) ||
    log.message.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, #18181B 0%, #09090B 100%)',
        border: '1px solid #27272A',
        borderRadius: '12px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
          }}>
            <Server size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', color: '#FAFAFA', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              API Integration Hub & Security Firewall
              <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                Live Active
              </span>
            </h1>
            <p style={{ color: '#A1A1AA', fontSize: '13px', marginTop: '4px' }}>
              Configure carrier integrations (XpressBees, DTDC, Delhivery), IP firewall security, and inspect real-time payload logs.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => handleSaveSettings()} 
            disabled={saveLoading}
            className="premium-btn premium-btn-primary"
            style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {saveLoading ? <span className="spinner spinner-sm" /> : <Save size={16} />}
            <span>{saveLoading ? 'Saving...' : 'Save All Changes'}</span>
          </button>

          <button 
            onClick={handleResetDb} 
            className="premium-btn premium-btn-danger" 
            style={{ padding: '10px 16px', fontSize: '13px', background: '#27272A', color: '#EF4444', border: '1px solid #3F3F46', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Database size={15} />
            <span>Reset Database</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="animate-fade-in" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981', color: '#10B981', padding: '14px 20px', borderRadius: '8px', border: '1px solid #10B981', fontSize: '13.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>All API Integration credentials and Firewall configurations have been successfully saved and applied!</span>
        </div>
      )}

      {resetSuccess && (
        <div className="animate-fade-in" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: '#3B82F6', color: '#60A5FA', padding: '14px 20px', borderRadius: '8px', border: '1px solid #3B82F6', fontSize: '13.5px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={18} />
          <span>System database reset completed. Seed mock data restored.</span>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #27272A', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveMainTab('couriers')}
          style={{
            padding: '12px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
            backgroundColor: activeMainTab === 'couriers' ? '#18181B' : 'transparent',
            color: activeMainTab === 'couriers' ? '#FAFAFA' : '#A1A1AA',
            borderBottom: activeMainTab === 'couriers' ? '2px solid #10B981' : '2px solid transparent'
          }}
        >
          <Truck size={18} style={{ color: activeMainTab === 'couriers' ? '#10B981' : '#A1A1AA' }} />
          <span>Courier Integrations</span>
        </button>

        <button
          onClick={() => setActiveMainTab('security')}
          style={{
            padding: '12px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
            backgroundColor: activeMainTab === 'security' ? '#18181B' : 'transparent',
            color: activeMainTab === 'security' ? '#FAFAFA' : '#A1A1AA',
            borderBottom: activeMainTab === 'security' ? '2px solid #6366F1' : '2px solid transparent'
          }}
        >
          <Shield size={18} style={{ color: activeMainTab === 'security' ? '#6366F1' : '#A1A1AA' }} />
          <span>Security & Firewall</span>
        </button>

        <button
          onClick={() => setActiveMainTab('contacts')}
          style={{
            padding: '12px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
            backgroundColor: activeMainTab === 'contacts' ? '#18181B' : 'transparent',
            color: activeMainTab === 'contacts' ? '#FAFAFA' : '#A1A1AA',
            borderBottom: activeMainTab === 'contacts' ? '2px solid #EC4899' : '2px solid transparent'
          }}
        >
          <Sliders size={18} style={{ color: activeMainTab === 'contacts' ? '#EC4899' : '#A1A1AA' }} />
          <span>Contact Configurations (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveMainTab('console')}
          style={{
            padding: '12px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
            backgroundColor: activeMainTab === 'console' ? '#18181B' : 'transparent',
            color: activeMainTab === 'console' ? '#FAFAFA' : '#A1A1AA',
            borderBottom: activeMainTab === 'console' ? '2px solid #F59E0B' : '2px solid transparent'
          }}
        >
          <Terminal size={18} style={{ color: activeMainTab === 'console' ? '#F59E0B' : '#A1A1AA' }} />
          <span>Webhook Console Logs</span>
          <span style={{ fontSize: '11px', background: '#27272A', color: '#D4D4D8', padding: '2px 6px', borderRadius: '10px' }}>
            {courierLogs.length + waLogs.length}
          </span>
        </button>
      </div>

      {/* Main Content Areas based on Active Tab */}
      {activeMainTab === 'couriers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Sub-tabs for Courier Selection */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveCourierSubTab('xpressbees')}
              style={{
                padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: activeCourierSubTab === 'xpressbees' ? 'rgba(16, 185, 129, 0.12)' : '#121212',
                borderColor: activeCourierSubTab === 'xpressbees' ? '#10B981' : '#27272A',
                color: activeCourierSubTab === 'xpressbees' ? '#10B981' : '#A1A1AA'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: xpressActive ? '#10B981' : '#71717A' }} />
              <span>XpressBees API</span>
              {xpressActive && <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 6px', borderRadius: '4px' }}>Active</span>}
            </button>

            <button
              onClick={() => setActiveCourierSubTab('dtdc')}
              style={{
                padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: activeCourierSubTab === 'dtdc' ? 'rgba(59, 130, 246, 0.12)' : '#121212',
                borderColor: activeCourierSubTab === 'dtdc' ? '#3B82F6' : '#27272A',
                color: activeCourierSubTab === 'dtdc' ? '#60A5FA' : '#A1A1AA'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dtdcActive ? '#3B82F6' : '#71717A' }} />
              <span>DTDC Express</span>
              {dtdcActive && <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', padding: '1px 6px', borderRadius: '4px' }}>Active</span>}
            </button>

            <button
              onClick={() => setActiveCourierSubTab('delhivery')}
              style={{
                padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: activeCourierSubTab === 'delhivery' ? 'rgba(245, 158, 11, 0.12)' : '#121212',
                borderColor: activeCourierSubTab === 'delhivery' ? '#F59E0B' : '#27272A',
                color: activeCourierSubTab === 'delhivery' ? '#FBBF24' : '#A1A1AA'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dlvActive ? '#F59E0B' : '#71717A' }} />
              <span>Delhivery Direct</span>
              {dlvActive && <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', padding: '1px 6px', borderRadius: '4px' }}>Active</span>}
            </button>

            <button
              onClick={() => setActiveCourierSubTab('routing')}
              style={{
                padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: activeCourierSubTab === 'routing' ? 'rgba(168, 85, 247, 0.12)' : '#121212',
                borderColor: activeCourierSubTab === 'routing' ? '#A855F7' : '#27272A',
                color: activeCourierSubTab === 'routing' ? '#C084FC' : '#A1A1AA'
              }}
            >
              <Sliders size={15} />
              <span>Auto-Routing Engine</span>
            </button>
          </div>

          {/* Courier Details Card */}
          <div className="premium-card" style={{ padding: '24px', borderRadius: '12px', backgroundColor: '#121212', border: '1px solid #27272A' }}>
            
            {/* XPRESSBEES TAB */}
            {activeCourierSubTab === 'xpressbees' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Master Active Switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #27272A' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      XpressBees API Integration
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#A1A1AA', marginTop: '2px' }}>
                      Configure JWT token generation, license keys, webhook endpoints, and warehouse origin.
                    </p>
                  </div>

                  <label htmlFor="xb_active_toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#18181B', padding: '8px 14px', borderRadius: '8px', border: '1px solid #27272A' }}>
                    <input type="checkbox" id="xb_active_toggle" checked={xpressActive} onChange={(e) => setXpressActive(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#10B981' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: xpressActive ? '#10B981' : '#71717A' }}>
                      {xpressActive ? 'Integration Active' : 'Integration Inactive'}
                    </span>
                  </label>
                </div>

                {xpressActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Sub-navigation inside XpressBees */}
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #27272A', paddingBottom: '8px' }}>
                      <button
                        onClick={() => setActiveXpressSubTab('credentials')}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          backgroundColor: activeXpressSubTab === 'credentials' ? '#27272A' : 'transparent',
                          color: activeXpressSubTab === 'credentials' ? '#FAFAFA' : '#A1A1AA'
                        }}
                      >
                        <Key size={14} />
                        <span>API Credentials</span>
                      </button>

                      <button
                        onClick={() => setActiveXpressSubTab('endpoints')}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          backgroundColor: activeXpressSubTab === 'endpoints' ? '#27272A' : 'transparent',
                          color: activeXpressSubTab === 'endpoints' ? '#FAFAFA' : '#A1A1AA'
                        }}
                      >
                        <Globe size={14} />
                        <span>Endpoint URLs</span>
                      </button>

                      <button
                        onClick={() => setActiveXpressSubTab('warehouse')}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          backgroundColor: activeXpressSubTab === 'warehouse' ? '#27272A' : 'transparent',
                          color: activeXpressSubTab === 'warehouse' ? '#FAFAFA' : '#A1A1AA'
                        }}
                      >
                        <MapPin size={14} />
                        <span>Warehouse Pickup Info</span>
                      </button>
                    </div>

                    {/* Sub-Tab 1: Credentials */}
                    {activeXpressSubTab === 'credentials' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* Profiles Overview */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ background: '#18181B', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>✈️ AIR PROFILE (Shivay Air)</span>
                              <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 6px', borderRadius: '4px' }}>Active</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#A1A1AA', fontFamily: 'monospace' }}>
                              Username: admin@shivayair.com<br />
                              XB Key: JnueT39994Dyats
                            </div>
                          </div>

                          <div style={{ background: '#18181B', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#60A5FA' }}>🚚 SURFACE PROFILE (Shivay Sfc)</span>
                              <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', padding: '1px 6px', borderRadius: '4px' }}>Active</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#A1A1AA', fontFamily: 'monospace' }}>
                              Username: admin@shivaysfc.com<br />
                              XB Key: JnueT39995Dyats
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Base API URL</label>
                            <input type="text" className="premium-input" placeholder="https://shipment.xpressbees.com/api" value={xpressBaseUrl} onChange={(e) => setXpressBaseUrl(e.target.value)} style={{ fontFamily: 'monospace' }} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Active XB Key / License Key</label>
                            <input type="text" className="premium-input" placeholder="JnueT39994Dyats" value={xpressKey} onChange={(e) => setXpressKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Login Email</label>
                            <input type="email" className="premium-input" placeholder="Login Email" value={xpressEmail} onChange={(e) => setXpressEmail(e.target.value)} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Login Password</label>
                            <input type="password" className="premium-input" placeholder="Login Password" value={xpressPassword} onChange={(e) => setXpressPassword(e.target.value)} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Secret Key</label>
                            <input type="password" className="premium-input" placeholder="Secret Key" value={xpressSecretKey} onChange={(e) => setXpressSecretKey(e.target.value)} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>XB Key (Header)</label>
                            <input type="text" className="premium-input" placeholder="XB Key" value={xpressXbKey} onChange={(e) => setXpressXbKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                          </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Vendor Code</label>
                          <input type="text" className="premium-input" placeholder="Vendor Code" value={xpressVendorCode} onChange={(e) => setXpressVendorCode(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Service Type</label>
                          <select className="premium-input" value={xpressServiceType} onChange={(e) => setXpressServiceType(e.target.value)}>
                            <option value="NDD">Next Day Delivery (NDD)</option>
                            <option value="SDD">Same Day Delivery (SDD)</option>
                            <option value="SD">Standard Delivery (SD)</option>
                            <option value="IntraSDD">Intra Same Day (IntraSDD)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Auth Method</label>
                          <select className="premium-input" value={xpressAuthType} onChange={(e) => setXpressAuthType(e.target.value)}>
                            <option value="new">New Auth Type (generateToken)</option>
                            <option value="old">Old Auth Type (login)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Sub-Tab 2: Endpoints */}
                    {activeXpressSubTab === 'endpoints' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Token Generation URL</label>
                          <input type="text" className="premium-input" placeholder="https://userauthapis.xbees.in/..." value={xpressTokenUrl} onChange={(e) => setXpressTokenUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Forward Manifest URL</label>
                          <input type="text" className="premium-input" placeholder="Forward Manifest URL" value={xpressManifestUrl} onChange={(e) => setXpressManifestUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>AWB Series Gen URL</label>
                          <input type="text" className="premium-input" placeholder="AWB Gen Series URL" value={xpressAwbGenUrl} onChange={(e) => setXpressAwbGenUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Get Generated AWB URL</label>
                          <input type="text" className="premium-input" placeholder="Get Generated AWB Series URL" value={xpressAwbRetrieveUrl} onChange={(e) => setXpressAwbRetrieveUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Shipment Cancellation URL</label>
                          <input type="text" className="premium-input" placeholder="Cancellation URL" value={xpressCancelUrl} onChange={(e) => setXpressCancelUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>NDR Update Escalation URL</label>
                          <input type="text" className="premium-input" placeholder="NDR Update URL" value={xpressNdrUrl} onChange={(e) => setXpressNdrUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Pincode Serviceability URL</label>
                          <input type="text" className="premium-input" placeholder="Pincode Serviceability URL" value={xpressPincodeUrl} onChange={(e) => setXpressPincodeUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Tracking Summary URL</label>
                          <input type="text" className="premium-input" placeholder="Tracking Summary URL" value={xpressTrackSummaryUrl} onChange={(e) => setXpressTrackSummaryUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '4px', fontWeight: 600 }}>Tracking Bulk URL</label>
                          <input type="text" className="premium-input" placeholder="Tracking Bulk URL" value={xpressTrackBulkUrl} onChange={(e) => setXpressTrackBulkUrl(e.target.value)} style={{ fontSize: '12px', fontFamily: 'monospace' }} />
                        </div>
                      </div>
                    )}

                    {/* Sub-Tab 3: Warehouse */}
                    {activeXpressSubTab === 'warehouse' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Warehouse Name</label>
                          <input type="text" className="premium-input" placeholder="Main Warehouse" value={xpressWarehouseName} onChange={(e) => setXpressWarehouseName(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Contact Manager</label>
                          <input type="text" className="premium-input" placeholder="Contact Manager Name" value={xpressContactName} onChange={(e) => setXpressContactName(e.target.value)} />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Address Line 1</label>
                          <input type="text" className="premium-input" placeholder="Street Address" value={xpressAddress} onChange={(e) => setXpressAddress(e.target.value)} />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Address Line 2 (Optional)</label>
                          <input type="text" className="premium-input" placeholder="Landmark / Suite" value={xpressAddress2} onChange={(e) => setXpressAddress2(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>City</label>
                          <input type="text" className="premium-input" placeholder="City" value={xpressCity} onChange={(e) => setXpressCity(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>State</label>
                          <input type="text" className="premium-input" placeholder="State" value={xpressState} onChange={(e) => setXpressState(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Pincode</label>
                          <input type="text" className="premium-input" placeholder="Pincode" value={xpressPincode} onChange={(e) => setXpressPincode(e.target.value)} />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Warehouse Phone</label>
                          <input type="text" className="premium-input" placeholder="Warehouse Phone Number" value={xpressPhone} onChange={(e) => setXpressPhone(e.target.value)} />
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* DTDC TAB */}
            {activeCourierSubTab === 'dtdc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #27272A' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600 }}>DTDC Express API Integration</h3>
                    <p style={{ fontSize: '12.5px', color: '#A1A1AA', marginTop: '2px' }}>Configure DTDC softdata booking and tracking credentials.</p>
                  </div>

                  <label htmlFor="dtdc_active_toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#18181B', padding: '8px 14px', borderRadius: '8px', border: '1px solid #27272A' }}>
                    <input type="checkbox" id="dtdc_active_toggle" checked={dtdcActive} onChange={(e) => setDtdcActive(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#3B82F6' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: dtdcActive ? '#60A5FA' : '#71717A' }}>
                      {dtdcActive ? 'Integration Active' : 'Integration Inactive'}
                    </span>
                  </label>
                </div>

                {dtdcActive && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Security API Key</label>
                      <input type="text" className="premium-input" placeholder="DTDC api-key" value={dtdcKey} onChange={(e) => setDtdcKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Customer Code</label>
                      <input type="text" className="premium-input" placeholder="DTDC Customer Code" value={dtdcCustomerCode} onChange={(e) => setDtdcCustomerCode(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Service Type ID</label>
                      <input type="text" className="premium-input" placeholder="e.g. B2C PRIORITY" value={dtdcServiceType} onChange={(e) => setDtdcServiceType(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Commodity ID</label>
                      <input type="text" className="premium-input" placeholder="e.g. 2" value={dtdcCommodityId} onChange={(e) => setDtdcCommodityId(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Tracking Username</label>
                      <input type="text" className="premium-input" placeholder="Tracking Username" value={dtdcUsername} onChange={(e) => setDtdcUsername(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Tracking Password</label>
                      <input type="password" className="premium-input" placeholder="Tracking Password" value={dtdcPassword} onChange={(e) => setDtdcPassword(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DELHIVERY TAB */}
            {activeCourierSubTab === 'delhivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #27272A' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600 }}>Delhivery Direct API Integration</h3>
                    <p style={{ fontSize: '12.5px', color: '#A1A1AA', marginTop: '2px' }}>Configure Delhivery CMU manifest and tracking token credentials.</p>
                  </div>

                  <label htmlFor="dlv_active_toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#18181B', padding: '8px 14px', borderRadius: '8px', border: '1px solid #27272A' }}>
                    <input type="checkbox" id="dlv_active_toggle" checked={dlvActive} onChange={(e) => setDlvActive(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F59E0B' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: dlvActive ? '#FBBF24' : '#71717A' }}>
                      {dlvActive ? 'Integration Active' : 'Integration Inactive'}
                    </span>
                  </label>
                </div>

                {dlvActive && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Client Security Token</label>
                      <input type="text" className="premium-input" placeholder="Delhivery Client Token" value={dlvKey} onChange={(e) => setDlvKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Client Registered Name</label>
                      <input type="text" className="premium-input" placeholder="e.g. 99Store" value={dlvClientName} onChange={(e) => setDlvClientName(e.target.value)} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Pickup Location Name</label>
                      <input type="text" className="premium-input" placeholder="Default Pickup Location" value={dlvPickupLocation} onChange={(e) => setDlvPickupLocation(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ROUTING TAB */}
            {activeCourierSubTab === 'routing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #27272A' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Automated Courier Allocation Engine
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#A1A1AA', marginTop: '2px' }}>Automatically assign optimal courier partner based on order weight and SLA rules.</p>
                  </div>

                  <label htmlFor="auto_routing_toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#18181B', padding: '8px 14px', borderRadius: '8px', border: '1px solid #27272A' }}>
                    <input type="checkbox" id="auto_routing_toggle" checked={autoCourier} onChange={(e) => setAutoCourier(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#A855F7' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: autoCourier ? '#C084FC' : '#71717A' }}>
                      {autoCourier ? 'Engine Enabled' : 'Engine Disabled'}
                    </span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#18181B', border: '1px solid #27272A', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>Priority 1: DTDC</span>
                      <span style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Light Packets (&lt;1kg)</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#A1A1AA' }}>Selected for express light delivery parcels with priority tracking.</p>
                  </div>

                  <div style={{ background: '#18181B', border: '1px solid #27272A', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>Priority 2: XpressBees</span>
                      <span style={{ fontSize: '11px', color: '#3B82F6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Standard (1kg - 2kg)</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#A1A1AA' }}>Selected for standard commercial shipments across pan-India pincodes.</p>
                  </div>

                  <div style={{ background: '#18181B', border: '1px solid #27272A', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>Priority 3: Delhivery</span>
                      <span style={{ fontSize: '11px', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Heavy Freight (&gt;2kg)</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#A1A1AA' }}>Selected for bulk or heavy weight orders with CMU manifest generation.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {activeMainTab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          
          {/* Card 1: OTP Routing */}
          <div className="premium-card" style={{ padding: '24px', borderRadius: '12px', backgroundColor: '#121212', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} style={{ color: '#E11D48' }} />
              <span>Global WhatsApp OTP Routing</span>
            </h3>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                Recipient WhatsApp Phone Number
              </label>
              <input
                type="text"
                className="premium-input"
                placeholder="e.g. 8439762192"
                style={{ fontFamily: 'monospace' }}
                value={otpWhatsappNumber}
                onChange={(e) => setOtpWhatsappNumber(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#71717A', display: 'block', marginTop: '6px', lineHeight: '1.4' }}>
                When configured, all multi-user verification OTPs route to this specific master phone number. Leave blank to send directly to individual user profiles.
              </span>
            </div>
          </div>

          {/* Card 2: IP Firewall */}
          <div className="premium-card" style={{ padding: '24px', borderRadius: '12px', backgroundColor: '#121212', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', color: '#FAFAFA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={18} style={{ color: '#6366F1' }} />
                <span>IP Whitelist Security Firewall</span>
              </h3>

              <input
                type="checkbox"
                id="ip_firewall"
                checked={isIpEnabled}
                onChange={(e) => setIsIpEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366F1', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                Authorized IP Addresses (Comma separated)
              </label>
              <textarea
                className="premium-input"
                placeholder="e.g. 127.0.0.1, 192.168.1.10"
                style={{ minHeight: '80px', fontFamily: 'monospace', resize: 'vertical' }}
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#71717A', display: 'block', marginTop: '6px', lineHeight: '1.4' }}>
                Requests originating outside this whitelist will be restricted if firewall mode is activated.
              </span>
            </div>
          </div>

        </div>
      )}

      {/* CONTACT CONFIGURATIONS TAB (MODULE 5) */}
      {activeMainTab === 'contacts' && (
        <div className="premium-card" style={{ padding: '28px', borderRadius: '12px', backgroundColor: '#121212', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: '#FAFAFA', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} style={{ color: '#EC4899' }} />
              Global Contact Hierarchy & Role Configurations
            </h3>
            <p style={{ fontSize: '13px', color: '#A1A1AA' }}>
              Define default Primary and Secondary contact arrays for store fulfillment. Editing these central settings requires an <strong>Admin / Super Admin</strong> user session (enforced via strict HTTP 403 authorization).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                Primary Store Contact Numbers (Comma Separated) *
              </label>
              <input
                type="text"
                className="premium-input"
                placeholder="+91 9876543210, +91 9876543211"
                value={primaryContacts}
                onChange={(e) => setPrimaryContacts(e.target.value)}
              />
              <span style={{ fontSize: '11.5px', color: '#71717A', marginTop: '4px', display: 'block' }}>
                Globally referenced across order creation forms and dispatch labels.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#A1A1AA', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                Secondary Hub Contact Numbers (Comma Separated) *
              </label>
              <input
                type="text"
                className="premium-input"
                placeholder="+91 9123456789, +91 9123456780"
                value={secondaryContacts}
                onChange={(e) => setSecondaryContacts(e.target.value)}
              />
              <span style={{ fontSize: '11.5px', color: '#71717A', marginTop: '4px', display: 'block' }}>
                Backup coordination contacts for packing department and courier partners.
              </span>
            </div>

            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={saveLoading}
                className="premium-btn premium-btn-primary"
                style={{ padding: '10px 20px', backgroundColor: '#EC4899', borderColor: '#EC4899' }}
              >
                {saveLoading ? 'Validating RBAC & Saving...' : 'Save Global Contact Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONSOLE LOGS TAB */}
      {activeMainTab === 'console' && (
        <div className="premium-card" style={{ padding: '24px', borderRadius: '12px', backgroundColor: '#121212', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #27272A', gap: '16px' }}>
              <button
                onClick={() => setActiveConsoleTab('courier')}
                style={{
                  background: 'none', border: 'none', padding: '8px 4px', fontSize: '13px', fontWeight: 600,
                  color: activeConsoleTab === 'courier' ? '#FAFAFA' : '#A1A1AA',
                  borderBottom: activeConsoleTab === 'courier' ? '2px solid #F59E0B' : '2px solid transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Truck size={15} />
                <span>Courier API Feeds ({courierLogs.length})</span>
              </button>

              <button
                onClick={() => setActiveConsoleTab('whatsapp')}
                style={{
                  background: 'none', border: 'none', padding: '8px 4px', fontSize: '13px', fontWeight: 600,
                  color: activeConsoleTab === 'whatsapp' ? '#FAFAFA' : '#A1A1AA',
                  borderBottom: activeConsoleTab === 'whatsapp' ? '2px solid #10B981' : '2px solid transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <MessageSquare size={15} />
                <span>WhatsApp Feeds ({waLogs.length})</span>
              </button>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
              <input 
                type="text" 
                placeholder="Search payloads or waybills..." 
                className="premium-input"
                style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Render Log Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '650px', overflowY: 'auto', paddingRight: '4px' }}>
            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#A1A1AA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span className="spinner spinner-lg" />
                <span>Loading payload telemetry...</span>
              </div>
            ) : activeConsoleTab === 'courier' ? (
              filteredCourierLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#71717A', background: '#18181B', borderRadius: '8px', border: '1px dashed #27272A' }}>
                  No courier API logs match your search. Generate AWBs or tracking requests to inspect live telemetry.
                </div>
              ) : (
                filteredCourierLogs.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: '#09090B', border: '1px solid #27272A', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAFAFA', background: '#18181B', padding: '3px 8px', borderRadius: '4px', border: '1px solid #27272A' }}>
                          {log.courier}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#E4E4E7' }}>{log.action}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                          backgroundColor: log.status === 'Success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.status === 'Success' ? '#10B981' : '#EF4444',
                          border: `1px solid ${log.status === 'Success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {log.status}
                        </span>
                        <span style={{ fontSize: '11px', color: '#71717A' }}>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#A1A1AA', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Request Payload</span>
                        <pre style={{
                          backgroundColor: '#000000', border: '1px solid #1C1C21', padding: '10px', borderRadius: '6px', overflowX: 'auto', maxHeight: '160px', fontSize: '11px', fontFamily: 'monospace', color: '#D4D4D8', lineHeight: '1.4'
                        }}>{log.requestPayload}</pre>
                      </div>

                      <div>
                        <span style={{ fontSize: '10px', color: '#A1A1AA', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Response Payload</span>
                        <pre style={{
                          backgroundColor: '#000000', border: '1px solid #1C1C21', padding: '10px', borderRadius: '6px', overflowX: 'auto', maxHeight: '160px', fontSize: '11px', fontFamily: 'monospace', color: log.status === 'Success' ? '#34D399' : '#F87171', lineHeight: '1.4'
                        }}>{log.responsePayload}</pre>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              filteredWaLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#71717A', background: '#18181B', borderRadius: '8px', border: '1px dashed #27272A' }}>
                  No WhatsApp log feeds found. Trigger order status updates to simulate notification feeds.
                </div>
              ) : (
                filteredWaLogs.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: '#09090B', border: '1px solid #27272A', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>☎️ Recipient: {log.phone} ({log.type} Number)</span>
                      <span style={{ fontSize: '11px', color: '#71717A' }}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>

                    <p style={{ color: '#FAFAFA', lineHeight: '1.5', fontFamily: 'monospace', fontSize: '12px', background: '#000000', padding: '10px', borderRadius: '6px', border: '1px solid #1C1C21' }}>
                      {log.message}
                    </p>
                  </div>
                ))
              )
            )}
          </div>

        </div>
      )}

    </div>
  );
}
