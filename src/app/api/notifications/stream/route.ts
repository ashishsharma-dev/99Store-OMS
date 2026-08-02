import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sentKeys = new Set<string>();

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
        ndrRecords.slice(0, 3).forEach((ndr) => {
          const key = `ndr-${ndr.id}-${ndr.updatedAt || ndr.createdAt}`;
          sentKeys.add(key);
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
          const key = `order-${order.id}-${order.status}-${order.updatedAt || order.createdAt}`;
          sentKeys.add(key);
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

      // 5-second polling interval for real-time order/NDR updates & Delhivery Call Placed alerts
      const pollInterval = setInterval(async () => {
        try {
          const [orders, ndrRecords] = await Promise.all([
            db.getOrders(),
            db.getNdrRecords()
          ]);

          // 1. Delhivery Call Placed Notification orders
          orders.filter(o => o.status === 'Call Placed Notification').forEach(order => {
            const key = `call-${order.id}-${order.updatedAt || order.createdAt}`;
            if (!sentKeys.has(key)) {
              sentKeys.add(key);
              const eventPayload = `data: ${JSON.stringify({
                id: `evt-call-${order.id}-${Date.now()}`,
                title: `Delhivery: Call Placed`,
                message: `Call Placed Notification for Order #${order.orderId} - ${order.customerName}`,
                timestamp: order.updatedAt || order.createdAt || new Date().toISOString(),
                type: 'call_placed'
              })}\n\n`;
              controller.enqueue(encoder.encode(eventPayload));
            }
          });

          // 2. New pending NDR exception alerts
          ndrRecords.filter(r => r.status === 'Pending').forEach(ndr => {
            const key = `ndr-${ndr.id}-${ndr.updatedAt || ndr.createdAt}`;
            if (!sentKeys.has(key)) {
              sentKeys.add(key);
              const eventPayload = `data: ${JSON.stringify({
                id: `evt-ndr-${ndr.id}-${Date.now()}`,
                title: `NDR Alert: ${ndr.orderId}`,
                message: `Exception logged for ${ndr.customerName} (${ndr.courier}): ${ndr.reason}`,
                timestamp: ndr.updatedAt || ndr.createdAt || new Date().toISOString(),
                type: 'ndr'
              })}\n\n`;
              controller.enqueue(encoder.encode(eventPayload));
            }
          });

          // 3. Recent order updates
          orders.slice(-5).forEach(order => {
            const key = `order-${order.id}-${order.status}-${order.updatedAt || order.createdAt}`;
            if (!sentKeys.has(key)) {
              sentKeys.add(key);
              const eventPayload = `data: ${JSON.stringify({
                id: `evt-ord-${order.id}-${Date.now()}`,
                title: `Order Status: ${order.orderId}`,
                message: `Customer ${order.customerName} - Status: ${order.status} (${order.paymentType})`,
                timestamp: order.updatedAt || order.createdAt || new Date().toISOString(),
                type: 'order'
              })}\n\n`;
              controller.enqueue(encoder.encode(eventPayload));
            }
          });

        } catch (err) {
          console.error('Error in SSE notification stream poll loop:', err);
        }
      }, 5000);

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
        clearInterval(pollInterval);
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
