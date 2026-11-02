import fs from 'fs/promises';
import path from 'path';
import { verifyPackingSlipMediaToken } from '@/lib/packingSlipMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const url = new URL(request.url);
  if (!verifyPackingSlipMediaToken(orderId, url.searchParams.get('expires'), url.searchParams.get('token'))) {
    return new Response('Invalid or expired media link.', { status: 403 });
  }

  try {
    const image = await fs.readFile(path.join(process.cwd(), 'public', 'packing-slips', `${orderId}.png`));
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(image.length),
        'Cache-Control': 'public, max-age=3600, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return new Response('Packing slip not found.', { status: 404 });
    console.error(`[Packing slip media] Failed to read image for ${orderId}:`, error);
    return new Response('Packing slip media unavailable.', { status: 500 });
  }
}
