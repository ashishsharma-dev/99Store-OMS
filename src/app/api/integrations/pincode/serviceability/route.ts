import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkXpressBeesServiceability } from '@/lib/xpressbees';
import { checkShadowfaxServiceability } from '@/lib/shadowfax';

// Static check function as fallback
function checkCourierServiceabilityFallback(pincode: string, courier: string): boolean | null {
  if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
    return false;
  }
  const prefix = pincode.charAt(0);
  const normalizedCourier = courier.toLowerCase();

  if (normalizedCourier.includes('dtdc')) {
    return prefix !== '7';
  }
  if (normalizedCourier.includes('xpressbees') || normalizedCourier.includes('xbees')) {
    return null;
  }
  if (normalizedCourier.includes('delhivery')) {
    return prefix !== '5';
  }
  if (normalizedCourier.includes('shadowfax') || normalizedCourier.includes('sfx')) {
    return null;
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

    // 1. Check Shadowfax live API if active
    if (normalizedCourier.includes('shadowfax') || normalizedCourier.includes('sfx')) {
      if (settings.shadowfaxActive) {
        const res = await checkShadowfaxServiceability(pincode, settings.shadowfaxConfig);
        return NextResponse.json({ serviceable: res.serviceable, services: res.services, method: 'Shadowfax API' });
      }
      return NextResponse.json({ serviceable: checkCourierServiceabilityFallback(pincode, courier), method: 'Static Fallback' });
    }

    // 2. Check Delhivery live API if active
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
        const serviceable = await checkXpressBeesServiceability(pincode, settings.xpressbeesConfig, courier);
        return NextResponse.json({ serviceable, method: 'XpressBees API' });
      }
      return NextResponse.json({ serviceable: checkCourierServiceabilityFallback(pincode, courier), method: 'Static Fallback' });
    }

    // 3. Static fallback for couriers without a live serviceability response.
    const staticCheck = checkCourierServiceabilityFallback(pincode, courier);
    return NextResponse.json({ serviceable: staticCheck, method: 'Static Fallback' });

  } catch (error: any) {
    const affectedCourier = /shadowfax|sfx|xpressbees|xbees/i.test(new URL(request.url).searchParams.get('courier') || '');
    return NextResponse.json({ serviceable: affectedCourier ? null : false, error: error.message || 'Verification failed.' });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { checks } = body as { checks: { pincode: string; courier: string }[] };

    if (!checks || !Array.isArray(checks)) {
      return NextResponse.json({ error: 'Invalid checks list.' }, { status: 400 });
    }

    const settings = await db.getSettings();
    const results: Record<string, boolean | null> = {};

    await Promise.all(
      checks.map(async ({ pincode, courier }) => {
        const key = `${pincode}-${courier}`;
        if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
          results[key] = false;
          return;
        }

        const normalizedCourier = courier.toLowerCase();

        try {
          if (normalizedCourier.includes('shadowfax') || normalizedCourier.includes('sfx')) {
            if (settings.shadowfaxActive) {
              const res = await checkShadowfaxServiceability(pincode, settings.shadowfaxConfig);
              results[key] = res.serviceable;
              return;
            }
            results[key] = checkCourierServiceabilityFallback(pincode, courier);
            return;
          }

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
                  results[key] = !!(postalCode.is_delivered || postalCode.pre_paid === 'Y' || postalCode.cod === 'Y');
                  return;
                }
              }
            }
            results[key] = checkCourierServiceabilityFallback(pincode, courier);
            return;
          }

          if (normalizedCourier.includes('xpressbees') || normalizedCourier.includes('xbees')) {
            if (settings.xpressbeesActive) {
              results[key] = await checkXpressBeesServiceability(pincode, settings.xpressbeesConfig, courier);
              return;
            }
            results[key] = checkCourierServiceabilityFallback(pincode, courier);
            return;
          }

          results[key] = checkCourierServiceabilityFallback(pincode, courier);
        } catch (err) {
          results[key] = checkCourierServiceabilityFallback(pincode, courier);
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Batch check failed.' }, { status: 500 });
  }
}
