import type { Order, ShipmentContactType } from './types';

const shipmentContactTypes: ShipmentContactType[] = [
  'Primary',
  'Secondary',
  'Customer',
  'WhatsApp',
  'Custom',
];

export function isShipmentContactType(value: unknown): value is ShipmentContactType {
  return typeof value === 'string' && shipmentContactTypes.includes(value as ShipmentContactType);
}

export function getShipmentContactValue(
  order: Pick<Order, 'phonePrimary' | 'phoneSecondary' | 'phoneTertiary' | 'phoneWhatsApp'>,
  type: ShipmentContactType,
  customPhone?: string,
): string | undefined {
  switch (type) {
    case 'Primary':
      return order.phonePrimary;
    case 'Secondary':
      return order.phoneSecondary;
    case 'Customer':
      return order.phoneTertiary;
    case 'WhatsApp':
      return order.phoneWhatsApp;
    case 'Custom':
      return customPhone;
  }
}

export function normalizeShipmentContactPhone(value: string): string {
  let digits = value.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    throw new Error('Shipment contact number must contain exactly 10 digits.');
  }

  return digits;
}

export function resolveShipmentContact(
  order: Pick<Order, 'phonePrimary' | 'phoneSecondary' | 'phoneTertiary' | 'phoneWhatsApp'>,
  type: ShipmentContactType,
  customPhone?: string,
): { type: ShipmentContactType; phone: string } {
  const value = getShipmentContactValue(order, type, customPhone);

  if (!value?.trim()) {
    throw new Error(`No ${type.toLowerCase()} shipment contact number is available for this order.`);
  }

  return {
    type,
    phone: normalizeShipmentContactPhone(value),
  };
}

