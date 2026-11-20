import type { Order, ShipmentContactType } from './types';

const shipmentContactTypes: ShipmentContactType[] = [
  'Primary',
  'Secondary',
  'Additional 1',
  'Additional 2',
  'Customer',
  'WhatsApp',
  'Custom',
];

export function isShipmentContactType(value: unknown): value is ShipmentContactType {
  return typeof value === 'string' && shipmentContactTypes.includes(value as ShipmentContactType);
}

export function getShipmentContactValue(
  order: Pick<Order, 'phonePrimary' | 'phoneSecondary' | 'phoneAdditional1' | 'phoneAdditional2' | 'phoneTertiary' | 'phoneWhatsApp'>,
  type: ShipmentContactType,
  customPhone?: string,
): string | undefined {
  switch (type) {
    case 'Primary':
      return order.phonePrimary;
    case 'Secondary':
      return order.phoneSecondary;
    case 'Additional 1':
      return order.phoneAdditional1;
    case 'Additional 2':
      return order.phoneAdditional2;
    case 'Customer':
      return order.phoneTertiary || order.phoneWhatsApp;
    case 'WhatsApp':
      return order.phoneWhatsApp || order.phoneTertiary;
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
  order: Pick<Order, 'phonePrimary' | 'phoneSecondary' | 'phoneAdditional1' | 'phoneAdditional2' | 'phoneTertiary' | 'phoneWhatsApp'>,
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

const KNOWN_DUMMY_PHONES = new Set([
  '9876543210',
  '9123456789',
  '9999999999',
  '0000000000',
  '1234567890',
  '8888888888',
  '7777777777',
]);

export function isDummyPhoneNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 && KNOWN_DUMMY_PHONES.has(digits);
}

export function resolveConsigneePhone(
  order: Pick<Order, 'phonePrimary' | 'phoneSecondary' | 'phoneAdditional1' | 'phoneAdditional2' | 'phoneTertiary' | 'phoneWhatsApp'> & {
    shipmentContactPhone?: string;
  },
  phoneOverride?: string,
): string {
  const candidates = [
    phoneOverride,
    order.shipmentContactPhone,
    order.phoneTertiary,
    order.phoneWhatsApp,
    order.phonePrimary,
    order.phoneSecondary,
    order.phoneAdditional1,
    order.phoneAdditional2,
  ];

  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) {
      let digits = cand.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      const tenDigits = digits.slice(-10);
      if (tenDigits.length === 10 && !KNOWN_DUMMY_PHONES.has(tenDigits)) {
        return tenDigits;
      }
    }
  }

  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) {
      const digits = cand.replace(/\D/g, '');
      if (digits.length >= 10) {
        return digits.slice(-10);
      }
    }
  }

  return '';
}


