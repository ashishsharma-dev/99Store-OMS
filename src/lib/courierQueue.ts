import { db } from './db';
import { bookCourierShipment } from './courierHelper';
import { triggerWhatsAppNotification } from './whatsapp';
import { BulkJob } from './types';

let isCourierQueueProcessing = false;

export async function enqueueBulkJob(orderIds: string[], courierPartner: string, username: string): Promise<BulkJob> {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newJob: BulkJob = {
    id: jobId,
    status: 'Pending',
    total: orderIds.length,
    current: 0,
    successCount: 0,
    failedCount: 0,
    activeOrder: '',
    results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  (newJob as any).orderIds = orderIds;
  (newJob as any).courier = courierPartner;
  (newJob as any).createdBy = username;

  await db.saveBulkJob(newJob);

  // Trigger processor check asynchronously
  triggerCourierQueueProcessor();

  return newJob;
}

export function triggerCourierQueueProcessor() {
  if (isCourierQueueProcessing) return;
  processCourierJobs().catch(err => console.error('[Courier Queue] Error in background runner:', err));
}

async function processCourierJobs() {
  if (isCourierQueueProcessing) return;
  isCourierQueueProcessing = true;

  try {
    const allJobs = await db.listBulkJobs();
    const pendingJob = allJobs.find(j => j.status === 'Pending');

    if (!pendingJob) {
      isCourierQueueProcessing = false;
      return;
    }

    console.log(`[Courier Queue] Starting bulk AWB job ${pendingJob.id} with ${pendingJob.total} orders.`);
    pendingJob.status = 'Processing';
    pendingJob.updatedAt = new Date().toISOString();
    await db.saveBulkJob(pendingJob);

    const settings = await db.getSettings();
    const allOrders = await db.getOrders();
    const orderIds: string[] = (pendingJob as any).orderIds || [];
    const targetCourier: string = (pendingJob as any).courier || 'DTDC';
    const createdBy: string = (pendingJob as any).createdBy || 'system';

    let index = 0;
    const CONCURRENCY = 2; // Controlled parallel workers for API booking

    const worker = async () => {
      while (index < orderIds.length) {
        const currentIdx = index++;
        if (currentIdx >= orderIds.length) return;

        const orderId = orderIds[currentIdx];
        const order = allOrders.find(o => o.id === orderId || o.orderId === orderId);

        if (!order) {
          pendingJob.current++;
          pendingJob.failedCount++;
          pendingJob.results.push({
            orderId: orderId,
            success: false,
            message: 'Order record not found in database.'
          });
          pendingJob.updatedAt = new Date().toISOString();
          await db.saveBulkJob(pendingJob);
          continue;
        }

        // Update active status
        pendingJob.activeOrder = order.orderId;
        pendingJob.updatedAt = new Date().toISOString();
        await db.saveBulkJob(pendingJob);

        console.log(`[Courier Queue] Processing order ${order.orderId} (${currentIdx + 1}/${orderIds.length})`);

        // Check if AWB is already generated to prevent duplicate bookings
        if (order.awb) {
          pendingJob.current++;
          pendingJob.successCount++;
          pendingJob.results.push({
            orderId: order.orderId,
            success: true,
            message: 'Already generated',
            awb: order.awb
          });
          pendingJob.updatedAt = new Date().toISOString();
          await db.saveBulkJob(pendingJob);
          continue;
        }

        try {
          const result = await bookCourierShipment(
            order,
            settings,
            order.weight,
            targetCourier,
            order.phonePrimary
          );

          if (result.success) {
            order.status = 'Label Generated';
            order.awb = result.awb;
            order.eta = result.eta;
            order.courier = result.courier as any;
            if (result.velocity_label_url) {
              order.velocity_label_url = result.velocity_label_url;
            }
            if (result.velocity_shipment_id) {
              order.velocity_shipment_id = result.velocity_shipment_id;
            }
            
            order.history.push({
              status: 'Label Generated',
              timestamp: new Date().toISOString(),
              updatedBy: createdBy,
              remarks: `Bulk queue generated AWB ${result.awb} via ${targetCourier}.`
            });
            order.updatedAt = new Date().toISOString();
            await db.saveOrder(order);

            // Trigger WhatsApp
            triggerWhatsAppNotification({
              orderId: order.orderId,
              customerName: order.customerName,
              phonePrimary: order.phonePrimary,
              phoneSecondary: order.phoneSecondary,
              status: order.status,
              awb: order.awb || 'N/A',
              courier: order.courier || 'N/A',
              eta: order.eta || 'N/A',
              orderValue: order.orderValue,
              paymentType: order.paymentType,
              baseUrl: 'https://99-store-oms.vercel.app'
            }).catch(err => console.error('[Courier Queue] WhatsApp trigger failed:', err));

            pendingJob.current++;
            pendingJob.successCount++;
            pendingJob.results.push({
              orderId: order.orderId,
              success: true,
              message: 'AWB generated successfully.',
              awb: result.awb
            });
          } else {
            pendingJob.current++;
            pendingJob.failedCount++;
            pendingJob.results.push({
              orderId: order.orderId,
              success: false,
              message: result.error || 'Courier booking returned failure.'
            });
          }
        } catch (err: any) {
          pendingJob.current++;
          pendingJob.failedCount++;
          pendingJob.results.push({
            orderId: order.orderId,
            success: false,
            message: err.message || 'Fatal error during booking execution.'
          });
        }

        pendingJob.updatedAt = new Date().toISOString();
        await db.saveBulkJob(pendingJob);
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, orderIds.length) }, () => worker());
    await Promise.all(workers);

    pendingJob.status = 'Completed';
    pendingJob.activeOrder = '';
    pendingJob.updatedAt = new Date().toISOString();
    await db.saveBulkJob(pendingJob);
    console.log(`[Courier Queue] Finished bulk AWB job ${pendingJob.id}. Success: ${pendingJob.successCount}, Failed: ${pendingJob.failedCount}`);
  } catch (err) {
    console.error('[Courier Queue] Fatal error in queue runner loop:', err);
  } finally {
    isCourierQueueProcessing = false;
    setTimeout(() => {
      triggerCourierQueueProcessor();
    }, 1000);
  }
}

export function startCourierQueueProcessor() {
  setInterval(() => {
    triggerCourierQueueProcessor();
  }, 15000);
  
  setTimeout(() => {
    triggerCourierQueueProcessor();
  }, 5000);
}

if (typeof window === 'undefined') {
  startCourierQueueProcessor();
}
