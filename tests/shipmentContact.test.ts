import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getShipmentContactValue,
  isDummyPhoneNumber,
  isShipmentContactType,
  normalizeShipmentContactPhone,
  resolveConsigneePhone,
  resolveShipmentContact,
} from '../src/lib/shipmentContact';

const contacts = {
  phonePrimary: '+91 98765 43210',
  phoneSecondary: '09876543211',
  phoneAdditional1: '9876543214',
  phoneAdditional2: '9876543215',
  phoneTertiary: '9876543212',
  phoneWhatsApp: '9876543213',
};

describe('shipment contact selection', () => {
  it('resolves each saved order contact', () => {
    assert.deepEqual(resolveShipmentContact(contacts, 'Primary'), {
      type: 'Primary',
      phone: '9876543210',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'Secondary'), {
      type: 'Secondary',
      phone: '9876543211',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'Additional 1'), {
      type: 'Additional 1',
      phone: '9876543214',
    });
    assert.deepEqual(resolveShipmentContact(contacts, 'Additional 2'), {
      type: 'Additional 2',
      phone: '9876543215',
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
    assert.equal(isShipmentContactType('Additional 1'), true);
    assert.equal(isShipmentContactType('Tertiary'), false);
    assert.equal(getShipmentContactValue(contacts, 'WhatsApp'), contacts.phoneWhatsApp);
  });

  it('detects dummy phone numbers correctly', () => {
    assert.equal(isDummyPhoneNumber('9876543210'), true);
    assert.equal(isDummyPhoneNumber('+91 9876543210'), true);
    assert.equal(isDummyPhoneNumber('9123456789'), true);
    assert.equal(isDummyPhoneNumber('9999999999'), true);
    assert.equal(isDummyPhoneNumber('0000000000'), true);
    assert.equal(isDummyPhoneNumber('9870123456'), false);
    assert.equal(isDummyPhoneNumber(undefined), false);
    assert.equal(isDummyPhoneNumber(null), false);
  });

  it('resolves consignee phone skipping dummy numbers and prioritizing customer phone', () => {
    // When primary and secondary are dummy numbers, it falls back to customer phoneTertiary
    const dummyOrder = {
      phonePrimary: '+91 9876543210',
      phoneSecondary: '+91 9123456789',
      phoneAdditional1: '',
      phoneAdditional2: '',
      phoneTertiary: '9870123456',
      phoneWhatsApp: '9870123457',
    };
    assert.equal(resolveConsigneePhone(dummyOrder), '9870123456');

    // When phoneOverride is provided and valid, it takes top precedence
    assert.equal(resolveConsigneePhone(dummyOrder, '9811223344'), '9811223344');

    // When phoneOverride is a dummy number, it ignores it and falls back to customer phone
    assert.equal(resolveConsigneePhone(dummyOrder, '9876543210'), '9870123456');

    // When shipmentContactPhone is set to a valid number, it takes precedence
    const orderWithShipmentContact = {
      ...dummyOrder,
      shipmentContactPhone: '9822334455',
    };
    assert.equal(resolveConsigneePhone(orderWithShipmentContact), '9822334455');

    // When shipmentContactPhone is a dummy number, it ignores it and falls back to phoneTertiary
    const orderWithDummyShipmentContact = {
      ...dummyOrder,
      shipmentContactPhone: '9999999999',
    };
    assert.equal(resolveConsigneePhone(orderWithDummyShipmentContact), '9870123456');
  });
});

