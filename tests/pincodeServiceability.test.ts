import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkCourierServiceability } from '../src/lib/utils';

describe('pincode serviceability & courier reassignment safeguards', () => {
  test('does not falsely reject valid Indian pincodes starting with 7 for DTDC', () => {
    // 700001 is Kolkata, 751001 is Bhubaneswar, 781001 is Guwahati
    assert.equal(checkCourierServiceability('700001', 'DTDC'), true);
    assert.equal(checkCourierServiceability('751001', 'DTDC'), true);
    assert.equal(checkCourierServiceability('781001', 'DTDC'), true);
  });

  test('does not falsely reject valid Indian pincodes starting with 5 for Delhivery', () => {
    // 560001 is Bangalore, 500001 is Hyderabad, 520001 is Vijayawada
    assert.equal(checkCourierServiceability('560001', 'Delhivery'), true);
    assert.equal(checkCourierServiceability('500001', 'Delhivery'), true);
    assert.equal(checkCourierServiceability('520001', 'Delhivery'), true);
  });

  test('returns null for couriers requiring live booking verification', () => {
    assert.equal(checkCourierServiceability('110001', 'XpressBees'), null);
    assert.equal(checkCourierServiceability('110001', 'XpressBees Air'), null);
    assert.equal(checkCourierServiceability('110001', 'XpressBees Surface'), null);
    assert.equal(checkCourierServiceability('110001', 'Shadowfax'), null);
    assert.equal(checkCourierServiceability('110001', 'Velocity'), null);
  });

  test('rejects malformed or invalid pincodes', () => {
    assert.equal(checkCourierServiceability('', 'DTDC'), false);
    assert.equal(checkCourierServiceability('12345', 'DTDC'), false);
    assert.equal(checkCourierServiceability('1234567', 'DTDC'), false);
    assert.equal(checkCourierServiceability('ABCDEF', 'DTDC'), false);
    assert.equal(checkCourierServiceability('012345', 'DTDC'), false);
  });
});
