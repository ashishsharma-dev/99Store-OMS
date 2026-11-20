import assert from 'node:assert/strict';
import test from 'node:test';
import { appendDeliveryAgentRemarks, extractDeliveryAgentDetails } from '../src/lib/deliveryAgent';

test('extracts Shadowfax OFD rider details', () => {
  const result = extractDeliveryAgentDetails({
    status: 'Out For Delivery',
    rider_name: 'Ravi Kumar',
    rider_contact: '9876543210',
    recipient_info: { recipient_contact: '9123456789' },
  });

  assert.deepEqual(result, { name: 'Ravi Kumar', phone: '9876543210' });
});

test('extracts the virtual number from a masked rider contact object', () => {
  const result = extractDeliveryAgentDetails({
    masked_rider_contact: { virtual_number: '+91 87654-32109', pin: '1234' },
  });

  assert.equal(result.phone, '8765432109');
});

test('does not treat consignee or recipient numbers as rider details', () => {
  const result = extractDeliveryAgentDetails({
    consignee: { phone: '9876543210' },
    recipient_info: { recipient_contact: '8765432109' },
  });

  assert.deepEqual(result, { phone: undefined, name: undefined });
});

test('supports account-specific XpressBees FE fields without scanning unrelated phones', () => {
  const payload = [{
    CurrentShipmentStatus: {
      FEName: 'Delivery Associate',
      FEMobile: '919876543210',
    },
  }];

  assert.deepEqual(extractDeliveryAgentDetails(payload), {
    name: 'Delivery Associate',
    phone: '9876543210',
  });
  assert.equal(
    appendDeliveryAgentRemarks('Out for delivery.', payload),
    'Out for delivery. (Rider: Delivery Associate, Phone: 9876543210)'
  );
});
