import { db } from './db';
import { bookCourierShipment, CourierBookingResult } from './courierHelper';
import { isCourierSimulationEnabled } from './courierSimulation';
import { Order, ShipmentContactType, SystemSettings } from './types';

const NETWORK_UNCERTAINTY_PATTERN = /network|timeout|timed out|fetch failed|econnreset|econnrefused|socket|connection|aborted|aborterror/i;

export { isCourierSimulationEnabled };

export function isUncertainBookingFailure(error?: string): boolean {
  return NETWORK_UNCERTAINTY_PATTERN.test(error || '');
}

export function validateManifestWaybills(
  waybills: unknown,
  orders: Order[],
  courier = 'XpressBees',
): { valid: true; waybills: string[] } | { valid: false; error: string } {
  if (!Array.isArray(waybills) || waybills.length === 0) {
    return { valid: false, error: 'At least one AWB is required for manifest generation.' };
  }

  const normalized = [...new Set(waybills.map(value => String(value).trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return { valid: false, error: 'At least one valid AWB is required for manifest generation.' };
  }

  const orderByAwb = new Map(
    orders
      .filter(order => order.awb)
      .map(order => [order.awb!.trim().toLowerCase(), order]),
  );

  const unknown = normalized.filter(awb => !orderByAwb.has(awb.toLowerCase()));
  if (unknown.length > 0) {
    return { valid: false, error: `Manifest contains AWBs that are not assigned to an order: ${unknown.join(', ')}` };
  }

  const wrongCourier = normalized.filter(awb => {
    const order = orderByAwb.get(awb.toLowerCase());
    return order?.courier !== courier;
  });
  if (wrongCourier.length > 0) {
    return { valid: false, error: `Manifest contains AWBs not booked with ${courier}: ${wrongCourier.join(', ')}` };
  }

  return { valid: true, waybills: normalized };
}

export interface ReliableBookingOptions {
  weight?: number;
  courier: string;
  phone: string;
  shipmentContactType?: ShipmentContactType;
  mode?: string;
}

export interface ReliableBookingResult extends CourierBookingResult {
  duplicate?: boolean;
  reconciliationRequired?: boolean;
}

export async function bookOrderCourierShipment(
  order: Order,
  settings: SystemSettings,
  options: ReliableBookingOptions,
): Promise<ReliableBookingResult> {
  const attemptId = `booking-${order.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const claim = await db.claimCourierBooking(order.id, attemptId);

  if (claim.status === 'already_booked') {
    Object.assign(order, {
      courierBookingStatus: claim.order.courierBookingStatus || 'Booked',
      courierBookingAttemptId: claim.order.courierBookingAttemptId,
      courierBookingStartedAt: claim.order.courierBookingStartedAt,
      courierBookingCompletedAt: claim.order.courierBookingCompletedAt,
      courierBookingAttempts: claim.order.courierBookingAttempts,
      courierBookingError: claim.order.courierBookingError,
    });
    return {
      success: true,
      awb: claim.order.awb,
      eta: claim.order.eta,
      courier: claim.order.courier,
      duplicate: true,
      note: 'Existing AWB returned; no second courier booking was created.',
    };
  }

  if (claim.status === 'in_progress') {
    return { success: false, error: 'AWB generation is already in progress for this order. Please wait before retrying.' };
  }

  if (claim.status === 'reconciliation_required') {
    Object.assign(order, {
      courierBookingStatus: claim.order.courierBookingStatus,
      courierBookingAttemptId: claim.order.courierBookingAttemptId,
      courierBookingStartedAt: claim.order.courierBookingStartedAt,
      courierBookingCompletedAt: claim.order.courierBookingCompletedAt,
      courierBookingAttempts: claim.order.courierBookingAttempts,
      courierBookingError: claim.order.courierBookingError,
    });
    return {
      success: false,
      reconciliationRequired: true,
      error: claim.order.courierBookingError || 'The previous booking result is uncertain. Reconcile it with the courier before retrying.',
    };
  }

  if (claim.status !== 'claimed' || !claim.order) {
    return claim.status === 'not_found'
      ? { success: false, error: 'Order not found while reserving courier booking.' }
      : { success: false, error: 'The primary database is unavailable, so courier booking was stopped to prevent a duplicate AWB.' };
  }

  const claimedOrder = claim.order;
  Object.assign(order, {
    courierBookingStatus: claimedOrder.courierBookingStatus,
    courierBookingAttemptId: claimedOrder.courierBookingAttemptId,
    courierBookingStartedAt: claimedOrder.courierBookingStartedAt,
    courierBookingAttempts: claimedOrder.courierBookingAttempts,
    courierBookingError: claimedOrder.courierBookingError,
  });
  const result = await bookCourierShipment(
    claimedOrder,
    settings,
    options.weight,
    options.courier,
    options.phone,
    options.mode,
  );

  if (result.success && !result.awb?.trim()) {
    result.success = false;
    result.error = `${options.courier} reported success without an AWB. Manual reconciliation is required.`;
  }

  if (result.success && result.awb) {
    const collision = (await db.getOrders()).find(
      candidate => candidate.id !== claimedOrder.id && candidate.awb?.trim().toLowerCase() === result.awb!.trim().toLowerCase(),
    );
    if (collision) {
      const error = `Courier returned AWB ${result.awb}, but it is already assigned to order ${collision.orderId}. Manual reconciliation is required.`;
      await db.finalizeCourierBooking(claimedOrder.id, attemptId, {
        status: 'Reconciliation Required',
        error,
      });
      order.courierBookingStatus = 'Reconciliation Required';
      order.courierBookingCompletedAt = new Date().toISOString();
      order.courierBookingError = error;
      return { success: false, error, reconciliationRequired: true };
    }

    await db.finalizeCourierBooking(claimedOrder.id, attemptId, {
      status: 'Booked',
      awb: result.awb,
      eta: result.eta,
      courier: result.courier || options.courier,
      shipmentContactPhone: options.phone,
      shipmentContactType: options.shipmentContactType,
    });
    order.courierBookingStatus = 'Booked';
    order.courierBookingCompletedAt = new Date().toISOString();
    order.courierBookingError = undefined;
    return result;
  }

  const uncertain = isUncertainBookingFailure(result.error);
  await db.finalizeCourierBooking(claimedOrder.id, attemptId, {
    status: uncertain ? 'Reconciliation Required' : 'Failed',
    error: result.error || 'Courier booking failed.',
  });
  order.courierBookingStatus = uncertain ? 'Reconciliation Required' : 'Failed';
  order.courierBookingCompletedAt = new Date().toISOString();
  order.courierBookingError = result.error || 'Courier booking failed.';

  return { ...result, reconciliationRequired: uncertain };
}
