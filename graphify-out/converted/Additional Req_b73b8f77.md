<!-- converted from Additional Req.docx -->

Order Management System – Additional Requirements
Order Creation Module
A Partially Paid Amount field is required in the Order Creation Form.
User should be able to enter the amount already paid by the customer.
The system should automatically deduct the paid amount from the total order value and display the Final Payable Amount.
Orders with partial payments should be highlighted in green color throughout the system for easy identification.
A Clone Order feature is required.
If a customer places a repeat order, users should be able to duplicate an existing order and create a new order from it without entering all details again.

Packing & Label Queue
Add Select All and Multi-Select Checkbox functionality for bulk operations on orders/products.
Manifest label size should be 4 x 6 inches.

Shipment Management
A Call Placed Notification status should be available for shipments where the courier has contacted the customer.
For XpressBees shipments, the system should fetch and display the FE (Field Executive) Number whenever available.
While creating a shipment, users should be able to select the Primary Contact Number from a dropdown if multiple numbers are available for the customer.
Create a dedicated All Shipments menu.
Users should be able to search shipments globally using:
Customer Name
Mobile Number
Order ID
AWB Number
Pincode
Any other relevant shipment details

NDR (Non-Delivery Report) Management
Create a dedicated NDR Menu containing all undelivered shipments.
Under NDR, create a sub-menu called NDR Working Sheet.
Users should be able to transfer selected undelivered shipments from NDR to the NDR Working Sheet.
Add an NDR action dropdown with the following options:
Arranged
Arranged for Tomorrow
Future Delivery
If Future Delivery is selected, a Delivery Date field should appear and become mandatory.

OFD (Out for Delivery) Management
Create a dedicated OFD Working Sheet menu.
Under OFD Working Sheet, create a sub-menu called All OFD.
OFD orders should be assignable to specific team members, such as:
Person 1 (e.g., Vinay)
Person 2
Person 3
Users should be able to:
Distribute OFD shipments person-wise.
Reassign any order from one person to another.
Transfer an OFD shipment directly to NDR whenever required.

General Workflow Requirements
Order ownership and assignment tracking should be maintained.
Every reassignment should be recorded in the order history/logs.
Search and filtering should be available across all major modules (Orders, Shipments, OFD, NDR, and Working Sheets).
