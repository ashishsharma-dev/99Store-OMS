export function normalizeCustomerWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const digits = value.replace(/\D/g, '');
  const nationalNumber = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits;

  return /^[6-9]\d{9}$/.test(nationalNumber) ? nationalNumber : null;
}

