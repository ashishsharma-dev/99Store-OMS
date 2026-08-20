import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getXpressBeesToken } from '@/lib/xpressbees';

const pincodeMap: Record<string, { state: string; area: string }> = {
  '400050': { state: 'Maharashtra', area: 'Bandra West, Mumbai' },
  '400049': { state: 'Maharashtra', area: 'Juhu Scheme, Mumbai' },
  '110001': { state: 'Delhi', area: 'Connaught Place, New Delhi' },
  '560038': { state: 'Karnataka', area: 'Indira Nagar, Bengaluru' },
  '600001': { state: 'Tamil Nadu', area: 'George Town, Chennai' },
  '700001': { state: 'West Bengal', area: 'Chowringhee, Kolkata' },
  '380015': { state: 'Gujarat', area: 'SG Highway, Ahmedabad' },
  '122001': { state: 'Haryana', area: 'Sector 15, Gurugram' },
  '500001': { state: 'Telangana', area: 'Abids, Hyderabad' },
  '302001': { state: 'Rajasthan', area: 'M.I. Road, Jaipur' },
};

const pincodeCache = new Map<string, { state: string; area: string; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pincode = searchParams.get('pincode');

  if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
    return NextResponse.json({ error: 'Invalid pincode format. Must be 6 digits.' }, { status: 400 });
  }

  // Check in-memory LRU cache
  const cached = pincodeCache.get(pincode);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ state: cached.state, area: cached.area });
  }

  // Try live Delhivery pincode serviceability lookup if active
  try {
    const settings = await db.getSettings();
    if (settings.deliveryActive && settings.deliveryConfig.apiKey) {
      const apiKey = settings.deliveryConfig.apiKey;
      const isProduction = !apiKey.startsWith('MOCK') && !apiKey.includes('test') && !apiKey.includes('staging');
      const delhiveryBaseUrl = isProduction ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';
      
      const res = await fetch(`${delhiveryBaseUrl}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pincode)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.delivery_codes && data.delivery_codes.length > 0) {
          const postalCode = data.delivery_codes[0].postal_code;
          if (postalCode.is_delivered || postalCode.pre_paid === 'Y' || postalCode.cod === 'Y') {
            return NextResponse.json({
              state: postalCode.state_code || postalCode.state || 'Delhi/NCR',
              area: postalCode.district || postalCode.area || `Delhivery Serviced Area`
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch live Delhivery serviceability:', error);
  }

  // Try live Xpressbees pincode lookup if active
  try {
    const settings = await db.getSettings();
    if (settings.xpressbeesActive) {
      const token = await getXpressBeesToken(settings.xpressbeesConfig);
      const pincodeUrl = settings.xpressbeesConfig.pincodeUrl || 'https://xbmasterapi.xbees.in/expose/get/serviceabilitypincode/details';
      
      const res = await fetch(`${pincodeUrl}?pincode=${encodeURIComponent(pincode)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token,
          'XBKey': settings.xpressbeesConfig.xbKey || ''
        },
        body: JSON.stringify({
          BusinessUnit: 'B2C',
          BusinessFlow: 'Forward',
          BusinessService: settings.xpressbeesConfig.serviceType || 'Air'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === true || data.status === 'success' || data.ReturnCode === 100 || data.data)) {
          const info = data.data || data;
          const state = info.state || info.state_name || info.stateName || '';
          const city = info.city || info.city_name || info.cityName || info.district || '';
          return NextResponse.json({
            state: state || 'Uttar Pradesh',
            area: city || 'Xpressbees Serviced Area'
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch live Xpressbees serviceability:', error);
  }

  function returnAndCache(result: { state: string; area: string }) {
    pincodeCache.set(pincode, { ...result, cachedAt: Date.now() });
    return NextResponse.json(result);
  }

  // 1. Check exact map match
  if (pincodeMap[pincode]) {
    return returnAndCache(pincodeMap[pincode]);
  }

  // 2. Fallback based on postal zones (first digit of pincode)
  const zone = pincode.charAt(0);
  switch (zone) {
    case '1':
      return returnAndCache({ state: 'Delhi/NCR', area: `Zone 1 Region (Pincode: ${pincode})` });
    case '2':
      return returnAndCache({ state: 'Uttar Pradesh', area: `Zone 2 Region (Pincode: ${pincode})` });
    case '3':
      return returnAndCache({ state: 'Gujarat', area: `Zone 3 Region (Pincode: ${pincode})` });
    case '4':
      return returnAndCache({ state: 'Maharashtra', area: `Zone 4 Region (Pincode: ${pincode})` });
    case '5':
      return returnAndCache({ state: 'Karnataka/Andhra', area: `Zone 5 Region (Pincode: ${pincode})` });
    case '6':
      return returnAndCache({ state: 'Tamil Nadu/Kerala', area: `Zone 6 Region (Pincode: ${pincode})` });
    case '7':
      return returnAndCache({ state: 'West Bengal/NorthEast', area: `Zone 7 Region (Pincode: ${pincode})` });
    case '8':
      return returnAndCache({ state: 'Bihar/Jharkhand', area: `Zone 8 Region (Pincode: ${pincode})` });
    default:
      return returnAndCache({ state: 'Maharashtra', area: `Default Hub (Pincode: ${pincode})` });
  }
}
