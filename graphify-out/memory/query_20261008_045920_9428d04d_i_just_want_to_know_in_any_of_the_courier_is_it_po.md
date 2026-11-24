---
type: "query"
date: "2026-10-08T04:59:20.330079+00:00"
question: "I just want to know in any of the courier is it possibile that a used awb can be assigned to the new parcel whn generating awb?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["bookOrderCourierShipment()", "takeXpressBeesAwb()", "addXpressBeesAwbs()", "bookShadowfaxOrder()", "courierHelper.ts"]
---

# Q: I just want to know in any of the courier is it possibile that a used awb can be assigned to the new parcel whn generating awb?

## Answer

Expanded from original query via graph vocab: [awb, awbs, assignment, courier, shipment, shipments, order, orders, generate, dtdc, shadowfax, velocity]. In the normal generated-AWB flow, a used AWB should not be assigned to a new parcel: booking is claimed per order, an existing AWB is returned for the same order without a second booking, concurrent generation for that order is blocked, and any AWB returned by a courier is compared with AWBs on other orders. A collision is rejected and the order is marked Reconciliation Required. However, the guarantee is not absolute. XpressBees has the clearest residual risk because its replenished AWB pool is deduplicated only against numbers currently in the pool, not against historical AWBs already assigned to orders. Also, the final cross-order collision check and save are not protected by a database-level unique index on awb, so two different concurrent bookings returning the same AWB could theoretically pass the check before either is saved. DTDC, Delhivery, and Shadowfax rely on courier-generated identifiers and then use the same local collision check; Shadowfax deliberately returns an existing AWB when the same client_order_id was already created, which is safe for retries but could surface an old AWB if an order ID were improperly reused. Therefore: unlikely and usually blocked, but technically possible, especially via the XpressBees pool or an exceptional race; add a unique normalized AWB index/reservation plus a used-AWB history check for a hard guarantee.

## Outcome

- Signal: useful

## Source Nodes

- bookOrderCourierShipment()
- takeXpressBeesAwb()
- addXpressBeesAwbs()
- bookShadowfaxOrder()
- courierHelper.ts