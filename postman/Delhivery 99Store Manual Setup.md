# Delhivery 99Store Collection Manual Setup

Use this file if the Postman VS Code extension fails to import the JSON collection.

## Create Collection

Create a new collection named `Delhivery 99Store Collection`.

## Collection Authorization

- Type: `API Key`
- Key: `Authorization`
- Value: `Token {{delhivery_token}}`
- Add to: `Header`

## Collection Pre-request Script

```javascript
pm.request.headers.upsert({ key: 'Authorization', value: 'Token ' + pm.environment.get('delhivery_token') });
pm.request.headers.upsert({ key: 'Accept', value: 'application/json' });
```

## Environment

Create an environment named `Delhivery 99Store Local` with these variables:

| Variable | Initial Value |
| --- | --- |
| `staging_base_url` | `https://staging-express.delhivery.com` |
| `delhivery_token` | `` |
| `delhivery_client_name` | `` |
| `pickup_location` | `` |
| `destination_pincode` | `110001` |
| `pickup_date` | `2026-05-31` |
| `waybill` | `` |
| `order_id` | `TEST-ORDER-001` |

## Request 1

- Name: `01 - Pincode Serviceability`
- Method: `GET`
- URL: `{{staging_base_url}}/c/api/pin-codes/json/?filter_codes={{destination_pincode}}`

Headers:

- `Content-Type: application/json`
- `Authorization: Token {{delhivery_token}}`

Tests:

```javascript
pm.test('Status is 200', function () { pm.response.to.have.status(200); });
```

## Request 2

- Name: `02 - Fetch Waybill / AWB`
- Method: `GET`
- URL: `{{staging_base_url}}/waybill/api/fetch/json/?token={{delhivery_token}}&cl={{delhivery_client_name}}&client_name={{delhivery_client_name}}`

Headers:

- `Accept: application/json`

Tests:

```javascript
pm.test('Status is 200', function () { pm.response.to.have.status(200); });
const text = pm.response.text();
try {
  const json = pm.response.json();
  const awb = json.waybill || json.wbn || json.awb || json.awb_number || json.waybill_number || json.response || null;
  if (awb && typeof awb === 'string') pm.environment.set('waybill', awb);
} catch (e) {
  const match = text.match(/\d{6,}/);
  if (match) pm.environment.set('waybill', match[0]);
}
```

## Request 3

- Name: `03 - Create Shipment / Manifest`
- Method: `POST`
- URL: `{{staging_base_url}}/api/cmu/create.json`

Headers:

- `Content-Type: application/x-www-form-urlencoded`
- `Authorization: Token {{delhivery_token}}`

Body:

- Type: `x-www-form-urlencoded`
- Key `format` = `json`
- Key `data` =

```json
{
  "shipments": [
    {
      "client": "{{delhivery_client_name}}",
      "name": "Test Customer",
      "add": "Test Address, Test Area",
      "pin": "{{destination_pincode}}",
      "city": "New Delhi",
      "state": "Delhi",
      "country": "India",
      "phone": "9999999999",
      "order": "{{order_id}}",
      "payment_mode": "Pre-paid",
      "products_desc": "Test Product",
      "cod_amount": 0,
      "total_amount": 499,
      "quantity": "1",
      "shipment_mode": "Surface",
      "pickup_location": {
        "name": "{{pickup_location}}"
      }
    }
  ]
}
```

If `{{waybill}}` is empty, do not include the `waybill` key at all. Delhivery can generate it during order creation.

Tests:

```javascript
pm.test('Status is 200 or 201', function () { pm.expect([200, 201]).to.include(pm.response.code); });
```

## Request 4

- Name: `04 - Track Shipment`
- Method: `GET`
- URL: `{{staging_base_url}}/api/v1/packages/json/?token={{delhivery_token}}&waybill={{waybill}}`

Headers:

- `Accept: application/json`

## Request 5

- Name: `05 - Generate Packing Slip / Label`
- Method: `GET`
- URL: `{{staging_base_url}}/api/p/packing_slip?wbns={{waybill}}`

Headers:

- `Authorization: Token {{delhivery_token}}`
- `Accept: application/json`

## Request 6

- Name: `06 - Pickup Request`
- Method: `POST`
- URL: `{{staging_base_url}}/fm/request/new/`

Headers:

- `Content-Type: application/json`
- `Authorization: Token {{delhivery_token}}`
- `Accept: application/json`

Body:

- Type: `raw`
- Language: `JSON`

```json
{
  "pickup_time": "16:00:00",
  "pickup_date": "{{pickup_date}}",
  "pickup_location": "{{pickup_location}}",
  "expected_package_count": 1
}
```

## Recommended Run Order

1. `01 - Pincode Serviceability`
2. `02 - Fetch Waybill / AWB`
3. `03 - Create Shipment / Manifest`
4. `04 - Track Shipment`
5. `05 - Generate Packing Slip / Label`
6. `06 - Pickup Request`
