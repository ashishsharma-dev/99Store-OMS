import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone')?.trim();
    const name = searchParams.get('name')?.toLowerCase().trim();
    const pincode = searchParams.get('pincode')?.trim();
    const address = searchParams.get('address')?.toLowerCase().trim();

    if (!phone && !name) {
      return NextResponse.json({ isDuplicate: false, matches: [] });
    }

    let orders = await db.getOrders();
    // Exclude deleted orders
    orders = orders.filter(o => !o.isDeleted);

    const matches: any[] = [];

    for (const order of orders) {
      let isMatch = false;
      const reasons: string[] = [];

      // 1. Exact phone match
      if (phone && (order.phonePrimary === phone || order.phoneSecondary === phone || order.phoneTertiary === phone)) {
        isMatch = true;
        reasons.push(`Primary or alternate phone number matches`);
      }

      // 2. Name and Pincode match
      if (name && pincode && order.customerName.toLowerCase().trim() === name && order.pincode === pincode) {
        isMatch = true;
        reasons.push(`Customer name and pincode match`);
      }

      // 3. Name and Address match (simple substring overlap check)
      if (name && address && order.customerName.toLowerCase().trim() === name) {
        const addr1 = order.address.toLowerCase().trim();
        const addr2 = address;
        if (addr1.includes(addr2) || addr2.includes(addr1) || getOverlapScore(addr1, addr2) > 0.5) {
          isMatch = true;
          reasons.push(`Customer name and highly similar address details match`);
        }
      }

      if (isMatch) {
        matches.push({
          id: order.id,
          orderId: order.orderId,
          customerName: order.customerName,
          phonePrimary: order.phonePrimary,
          pincode: order.pincode,
          address: order.address,
          productDetails: order.productDetails,
          orderValue: order.orderValue,
          status: order.status,
          createdAt: order.createdAt,
          reasons
        });
      }
    }

    return NextResponse.json({
      isDuplicate: matches.length > 0,
      matches
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to check duplicates.' }, { status: 500 });
  }
}

// Simple word-based overlap score to catch minor address details differences
function getOverlapScore(s1: string, s2: string): number {
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let intersection = 0;
  words1.forEach(w => {
    if (words2.has(w)) intersection++;
  });
  
  return intersection / Math.min(words1.size, words2.size);
}
