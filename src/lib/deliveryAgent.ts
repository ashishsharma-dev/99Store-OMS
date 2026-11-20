export interface DeliveryAgentDetails {
  name?: string;
  phone?: string;
}

type JsonRecord = Record<string, unknown>;

const PHONE_PATHS = [
  ['rider_contact'],
  ['riderContact'],
  ['riderPhone'],
  ['delivery_agent_phone'],
  ['deliveryAgentPhone'],
  ['field_executive_number'],
  ['feNumber'],
  ['delivery_agent', 'phone'],
  ['delivery_agent', 'contact'],
  ['delivery_partner', 'phone'],
  ['delivery_partner', 'contact'],
  ['masked_rider_contact'],
  ['alternate_masked_rider_contact'],
  ['CurrentShipmentStatus', 'FENumber'],
  ['CurrentShipmentStatus', 'FEMobile'],
  ['data', 'rider_contact'],
  ['data', 'riderPhone'],
] as const;

const NAME_PATHS = [
  ['rider_name'],
  ['riderName'],
  ['delivery_agent_name'],
  ['deliveryAgentName'],
  ['field_executive_name'],
  ['feName'],
  ['delivery_agent', 'name'],
  ['delivery_partner', 'name'],
  ['CurrentShipmentStatus', 'FEName'],
  ['data', 'rider_name'],
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function normalizePhone(value: unknown): string | undefined {
  if (isRecord(value)) {
    for (const key of ['virtual_number', 'phone', 'phone_number', 'contact', 'number']) {
      const normalized = normalizePhone(value[key]);
      if (normalized) return normalized;
    }
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const match = String(value).match(/(?:\+?91[\s-]*)?([6-9](?:[\s-]*\d){9})(?!\d)/);
  return match?.[1]?.replace(/\D/g, '');
}

function normalizeName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  return name || undefined;
}

export function extractDeliveryAgentDetails(payload: unknown): DeliveryAgentDetails {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const details = extractDeliveryAgentDetails(entry);
      if (details.phone || details.name) return details;
    }
    return {};
  }

  const phone = PHONE_PATHS
    .map(path => normalizePhone(readPath(payload, path)))
    .find(Boolean);
  const name = NAME_PATHS
    .map(path => normalizeName(readPath(payload, path)))
    .find(Boolean);

  return { phone, name };
}

export function appendDeliveryAgentRemarks(remarks: string, payload: unknown): string {
  const agent = extractDeliveryAgentDetails(payload);
  if (!agent.name && !agent.phone) return remarks;

  const parts = [agent.name ? `Rider: ${agent.name}` : '', agent.phone ? `Phone: ${agent.phone}` : '']
    .filter(Boolean)
    .join(', ');
  return `${remarks}${remarks ? ' ' : ''}(${parts})`;
}
