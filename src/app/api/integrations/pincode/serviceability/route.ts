import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getXpressBeesToken } from '@/lib/xpressbees';

// Static check function as fallback
function checkCourierServiceabilityFallback(pincode: string, courier: string): boolean {
  if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
    return false;
  }
  const prefix = pincode.charAt(0);
  const normalizedCourier = courier.toLowerCase();

  if (normalizedCourier.includes('dtdc')) {
    return prefix !== '7';
  }
  if (normalizedCourier.includes('xpressbees')) {
    return prefix !== '6';
  }
  if (normalizedCourier.includes('delhivery')) {
    return prefix !== '5';
  }
  if (normalizedCourier.includes('velocity') || normalizedCourier.includes('aggregator')) {
    return prefix !== '3';
  }

  return true;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get('pincode')?.trim();
    const courier = searchParams.get('courier')?.trim() || '';

    if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
      return NextResponse.json({ serviceable: false, error: 'Invalid pincode.' }, { status: 400 });
    }

    const settings = await db.getSettings();
    const normalizedCourier = courier.toLowerCase();

    // 1. Check Delhivery live API if active
    if (normalizedCourier.includes('delhivery')) {
      if (settings.deliveryActive && settings.deliveryConfig.apiKey) {
        const apiKey = settings.deliveryConfig.apiKey;
        const isProduction = !apiKey.startsWith('MOCK') && !apiKey.includes('test') && !apiKey.includes('staging');
        const delhiveryBaseUrl = isProduction ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com';

        const res = await fetch(`${delhiveryBaseUrl}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
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
            const isServiceable = !!(postalCode.is_delivered || postalCode.pre_paid === 'Y' || postalCode.cod === 'Y');
            return NextResponse.json({ serviceable: isServiceable, method: 'Delhivery API' });
          }
        }
      }
      return NextResponse.json({ serviceable: checkCourierServiceabilityFallback(pincode, courier), method: 'Static Fallback' });
    }

    // 2. Check XpressBees live API if active
    if (normalizedCourier.includes('xpressbees') || normalizedCourier.includes('xbees')) {
      if (settings.xpressbeesActive) {
        const token = await getXpressBeesToken(settings.xpressbeesConfig);
        const pincodeUrl = settings.xpressbeesConfig.pincodeUrl || 'https://xbmasterapi.xbees.in/expose/get/serviceabilitypincode/details';

        const res = await fetch(`${pincodeUrl}?pincode=${pincode}`, {
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
          const isServiceable = !!(data && (data.status === true || data.status === 'success' || data.ReturnCode === 100 || data.data));
          return NextResponse.json({ serviceable: isServiceable, method: 'XpressBees API' });
        }
      }
      return NextResponse.json({ serviceable: checkCourierServiceabilityFallback(pincode, courier), method: 'Static Fallback' });
    }

    // 3. Fallback for DTDC, Velocity, Aggregators
    const staticCheck = checkCourierServiceabilityFallback(pincode, courier);
    return NextResponse.json({ serviceable: staticCheck, method: 'Static Fallback' });

  } catch (error: any) {
    return NextResponse.json({ serviceable: false, error: error.message || 'Verification failed.' });
  }
}
