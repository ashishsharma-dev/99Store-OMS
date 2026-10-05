import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getShipmentContactValue,
  isShipmentContactType,
  normalizeShipmentContactPhone,
  resolveShipmentContact,
} from '../src/lib/shipmentContact';

const contacts = {
  phonePrimary: '+91 98765 43210',
  phoneSecondary: '09876543211',
  phoneTertiary: '9876543212',
  phoneWhatsApp: '9876543213',
};

describe('shipment contact selection', () => {
  it('resolves each of the four saved order contacts', () => {
    assert.deepEqual(resolveShipmentContact(contacts, 'Primary'), {
      type: 'Primary',
      phone: '9876543210',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'Secondary'), {
      type: 'Secondary',
      phone: '9876543211',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'Customer'), {
      type: 'Customer',
      phone: '9876543212',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'WhatsApp'), {
      type: 'WhatsApp',
      phone: '9876543213',
    });
  });

  it('supports a shipment-only custom contact without changing saved contacts', () => {
    const before = { ...contacts };
    assert.deepEqual(resolveShipmentContact(contacts, 'Custom', '+91 91234 56789'), {
      type: 'Custom',
      phone: '9123456789',
    });
    assert.deepEqual(contacts, before);
  });

  it('rejects missing and malformed contacts', () => {
    assert.throws(
      () => resolveShipmentContact({ ...contacts, phoneSecondary: undefined }, 'Secondary'),
      /No secondary shipment contact number/,
    );
    assert.throws(() => normalizeShipmentContactPhone('12345'), /exactly 10 digits/);
  });

  it('only accepts supported contact types', () => {
    assert.equal(isShipmentContactType('Customer'), true);
    assert.equal(isShipmentContactType('Tertiary'), false);
    assert.equal(getShipmentContactValue(contacts, 'WhatsApp'), contacts.phoneWhatsApp);
  });
});

