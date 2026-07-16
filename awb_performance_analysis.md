# Bulk AWB Generation Performance Analysis & API Reference

This document explains how AWB (Air Waybill) generation works in the application, details the API request/response structures for each integration, and analyzes the bottlenecks causing high latency during bulk generations.

---

## 1. Why Bulk AWB Generation is Slow: The Core Bottlenecks

During bulk AWB generation, processing even 20–30 orders can take **1 to 2 minutes**. There are three main architectural reasons for this latency:

### Bottleneck A: Sequential Client-Side Execution (The `for` loop)
In the frontend dashboard ([packing/page.tsx](file:///c:/Users/OMK%20Developer/Downloads/99StoreOMSV2/src/app/dashboard/packing/page.tsx)), the bulk action processes orders **one by one** in a sequential loop:
```typescript
for (let i = 0; i < pendingAWB.length; i++) {
  const res = await fetch(`/api/orders/${order.id}`, { ... });
  // Waits for the order to finish before starting the next one!
}
```
If each order takes **3 seconds** to process, 30 orders will take **90 seconds**.

### Bottleneck B: Server Loopback Fetch Call
In the backend PATCH handler ([api/orders/[id]/route.ts](file:///c:/Users/OMK%20Developer/Downloads/99StoreOMSV2/src/app/api/orders/%5Bid%5D/route.ts)), when updating status to `Label Generated`, the server makes a loopback fetch call to **itself**:
```typescript
const courierRes = await fetch(`${baseUrl}/api/integrations/courier`, { ... });
```
This loopback request adds HTTP request/connection overhead, DNS resolution, and wastes server-side worker slots. In local development or single-threaded server execution, this can cause queuing and partial deadlocks.

### Bottleneck C: Compounding Network & Database Latency
Each order requires:
* Multiple reads and writes to a remote MongoDB Atlas database (fetching system settings, fetching the order, saving the order, writing API logs).
* **1 to 3 sequential external HTTP requests** to the third-party courier APIs. XpressBees new auth flow is the slowest because it calls **three separate external endpoints** (AWB series generation $\rightarrow$ Get AWB number $\rightarrow$ Manifest forward booking) one after the other.

---

## 2. API Responses & Lifecycle per Courier

Below is a breakdown of the external API calls, payloads, and responses occurring behind the scenes in the courier integration handler ([api/integrations/courier/route.ts](file:///c:/Users/OMK%20Developer/Downloads/99StoreOMSV2/src/app/api/integrations/courier/route.ts)).

### A. XpressBees (New Auth Flow)
*The most complex and slowest integration due to its multi-step sequential lifecycle.*

#### Step 1: Authentication (Cached)
* **URL**: `https://userauthapis.xbees.in/api/auth/generateToken`
* **Method**: `POST`
* **Request Payload**:
  ```json
  { "username": "email@example.com", "password": "...", "secretkey": "..." }
  ```
* **Response Payload**:
  ```json
  { "Token": "JWT_TOKEN_STRING" }
  ```
* *Optimized*: Token is cached in-memory for 12 hours.

#### Step 2: AWB Series Generation
* **URL**: `https://xbclientapi.xbees.in/POSTShipmentService.svc/AWBNumberSeriesGeneration`
* **Method**: `POST`
* **Headers**: `token: <token>`, `XBKey: <xbKey>`
* **Request Payload**:
  ```json
  {
    "BusinessUnit": "ECOM",
    "ServiceType": "FORWARD",
    "DeliveryType": "COD" or "PREPAID",
    "TokenNumber": "JWT_TOKEN",
    "Token": "JWT_TOKEN"
  }
  ```
* **Response Payload**:
  ```json
  {
    "ReturnCode": 100,
    "ReturnMessage": "SUCCESS",
    "BatchID": 5938491
  }
  ```

#### Step 3: Retrieve AWB Numbers
* **URL**: `https://xbclientapi.xbees.in/TrackingService.svc/GetAWBNumberGeneratedSeries`
* **Method**: `POST`
* **Headers**: `token: <token>`, `XBKey: <xbKey>`
* **Request Payload**:
  ```json
  {
    "BusinessUnit": "ECOM",
    "ServiceType": "FORWARD",
    "BatchID": 5938491,
    "TokenNumber": "JWT_TOKEN",
    "Token": "JWT_TOKEN"
  }
  ```
* **Response Payload**:
  ```json
  {
    "ReturnCode": 100,
    "ReturnMessage": "SUCCESS",
    "AWBNoSeries": ["XB193859203", "XB193859204"]
  }
  ```

#### Step 4: Forward Manifesting (Manifest Booking)
* **URL**: `https://apishipmentmanifestation.xbees.in/shipmentmanifestation/forward`
* **Method**: `POST`
* **Headers**: `token: <token>`, `xbkey: <xbKey>`
* **Request Payload**:
  ```json
  {
    "OrderNo": "ORD12345",
    "UniqueOrderNo": "yes",
    "ShippingCharges": 40,
    "Discount": 0,
    "CODCharges": 0,
    "PaymentType": "cod",
    "OrderType": "cod",
    "OrderAmount": 99,
    "DeclaredValue": 99,
    "PackageWeight": 500,
    "Quantity": 1,
    "RequestAutoPickup": "yes",
    "ServiceType": "NDD",
    "DropDetails": { "Addresses": [{ "Address": "...", "City": "...", "State": "...", "PinCode": "..." }], "ContactDetails": [{ "PhoneNo": "..." }] },
    "PickupDetails": { "PickupVendorCode": "...", "Addresses": [{ ... }], "ContactDetails": [{ ... }] },
    "RTODetails": { ... },
    "OrderItems": [{ "Name": "Product Name", "Qty": "1", "Price": 99, "SKU": "SKU001" }],
    "CollectableAmount": "99",
    "AirWayBillNO": "XB193859203",
    "BusinessAccountName": "Shivay Air"
  }
  ```
* **Response Payload**:
  ```json
  {
    "status": true,
    "message": "Manifest successfully generated",
    "ReturnCode": 100
  }
  ```

---

### B. Delhivery
*Uses 2 sequential external HTTP requests.*

#### Step 1: Fetch Waybill (AWB)
* **URL**: `https://track.delhivery.com/waybill/api/fetch/json/?token=<token>&cl=<clientName>&client_name=<clientName>`
* **Method**: `GET`
* **Response Payload**:
  ```json
  {
    "waybill": "99SDEL18392038"
  }
  ```

#### Step 2: Create CMU Manifest Shipment
* **URL**: `https://track.delhivery.com/api/cmu/create.json`
* **Method**: `POST`
* **Headers**: `Authorization: Token <token>`, `Content-Type: application/x-www-form-urlencoded`
* **Request Payload** (Form Urlencoded):
  `format=json&data={"shipments": [...], "pickup_location": {"name": "..."}}`
* **Response Payload**:
  ```json
  {
    "success": true,
    "packages": [
      {
        "status": "Success",
        "waybill": "99SDEL18392038",
        "client": "SOM ENTERPRISES"
      }
    ]
  }
  ```

---

### C. DTDC
*Highly efficient. Single external HTTP request.*

#### Step 1: Softdata Consignment Upload
* **URL**: `https://pxapi.dtdc.in/api/customer/integration/consignment/softdata`
* **Method**: `POST`
* **Headers**: `api-key: <apiKey>`
* **Request Payload**:
  ```json
  {
    "consignments": [
      {
        "customer_code": "UO4125",
        "service_type_id": "B2C PRIORITY",
        "load_type": "NON-DOCUMENT",
        "consignment_type": "Forward",
        "weight": "0.5",
        "declared_value": "99",
        "origin_details": { "name": "...", "phone": "...", "address_line_1": "...", "pincode": "..." },
        "destination_details": { "name": "...", "phone": "...", "address_line_1": "...", "pincode": "..." },
        "customer_reference_number": "ORD12345"
      }
    ]
  }
  ```
* **Response Payload**:
  ```json
  {
    "success": true,
    "status": "success",
    "data": {
      "consignments": [
        {
          "courier_partner_reference_number": "DTDC99827389",
          "reference_number": "DTDC99827389",
          "success": true
        }
      ]
    }
  }
  ```

---

### D. Velocity
*Single external Aggregator HTTP request.*

#### Step 1: Create Shipment
* **Request / Response Handled by Helper**: Called from [lib/velocity.ts](file:///c:/Users/OMK Developer/Downloads/99StoreOMSV2/src/lib/velocity.ts)
* **Response Payload**:
  ```json
  {
    "awb": "VEL100293882",
    "eta": "2026-07-19",
    "label_url": "https://label.velocity.in/labels/...",
    "shipment_id": "ship_98374920",
    "charge": 55.0
  }
  ```

---

## 3. Recommended Actions for Performance Optimization

To make bulk AWB generation blazing fast, we recommend three key changes:

### Recommendation 1: Parallelize Client-side Fetch Requests
Instead of processing sequentially in a `for` loop, trigger all fetch requests in parallel using `Promise.all` or process them in small parallel chunks (e.g. concurrent batches of 5). 

*Change in dashboard (Draft Example):*
```typescript
// Replace:
for (let i = 0; i < pendingAWB.length; i++) {
  await fetch(`/api/orders/${order.id}`, { ... });
}

// With a parallel/batch strategy:
const batchSize = 5;
for (let i = 0; i < pendingAWB.length; i += batchSize) {
  const batch = pendingAWB.slice(i, i + batchSize);
  await Promise.all(batch.map(order => 
    fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ... })
    })
  ));
}
```

### Recommendation 2: Eliminate the Loopback Server Call
Instead of calling `fetch(`${baseUrl}/api/integrations/courier`)` inside `api/orders/[id]/route.ts`, import the booking/logic functions directly into `[id]/route.ts` or refactor the courier route code into a shared backend controller/service helper. This completely removes the overhead of loopback HTTP requests.

### Recommendation 3: Implement True Batch API Endpoints
Create a dedicated bulk route `/api/orders/bulk-label` that accepts an array of order IDs. 
* This allows performing a single database query to fetch all orders (`$in: ids`).
* Parallelizes third-party courier requests on the server-side (which is faster and more reliable than the client-side browser doing it).
* Reduces database logging roundtrips.
