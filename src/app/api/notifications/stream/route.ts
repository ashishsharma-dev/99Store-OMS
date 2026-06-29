import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Fetch real database records for authentic notification telemetry
        const [orders, ndrRecords] = await Promise.all([
          db.getOrders(),
          db.getNdrRecords()
        ]);

        // Send initial connection event
        const initMessage = `data: ${JSON.stringify({
          id: `evt-init-${Date.now()}`,
          title: 'System Telemetry Connected',
          message: `Connected to live 99Store notification feed (${orders.length} orders active).`,
          timestamp: new Date().toISOString(),
          type: 'system',
        })}\n\n`;
        controller.enqueue(encoder.encode(initMessage));

        // Stream real active NDR exception alerts from DB
        ndrRecords.slice(0, 3).forEach((ndr, idx) => {
          const ndrMsg = `data: ${JSON.stringify({
            id: `evt-ndr-${ndr.id}`,
            title: `NDR Alert: ${ndr.orderId}`,
            message: `Exception logged for ${ndr.customerName} (${ndr.courier}): ${ndr.reason}`,
            timestamp: ndr.createdAt,
            type: 'ndr',
          })}\n\n`;
          controller.enqueue(encoder.encode(ndrMsg));
        });

        // Stream real active recent orders
        orders.slice(-2).reverse().forEach((order) => {
          const orderMsg = `data: ${JSON.stringify({
            id: `evt-ord-${order.id}`,
            title: `Order Status: ${order.orderId}`,
            message: `Customer ${order.customerName} - Status: ${order.status} (${order.paymentType})`,
            timestamp: order.createdAt,
            type: 'order',
          })}\n\n`;
          controller.enqueue(encoder.encode(orderMsg));
        });

      } catch (err) {
        console.error('Error broadcasting authentic notification telemetry:', err);
      }

      // Silent heartbeat ping to keep SSE connection alive without emitting fake records
      const interval = setInterval(() => {
        try {
          const pingPayload = `: heartbeat ping\n\n`;
          controller.enqueue(encoder.encode(pingPayload));
        } catch (e) {
          clearInterval(interval);
        }
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
