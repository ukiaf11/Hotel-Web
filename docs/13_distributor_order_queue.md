# Document 13: Hotel Ordering Platform - Distributor Order Queue UI & Functionality

This document details the user interface, pipeline column flows, receipt printing formats, prepare-dispatch controllers, state stores, and backend endpoints for the Distributor's Order Queue.

---

## 1. Page Layout & Wireframe
The Active Order Queue is structured as a kanban board with 4 operational lanes corresponding to order preparation stages. Cards display order data and action controls.

```
+-------------------------------------------------------------------------+
| [Header - Reused from Doc 09]                                           |
+-------------------------------------------------------------------------+
|                                                                         |
|  Active Order Queue                                                     |
|                                                                         |
|  +------------------+  +------------------+  +------------------+  +--+ |
|  | Incoming (1)     |  | Preparing (2)    |  | Dispatch/Ready (1|  |Co| |
|  | +--------------+ |  | +--------------+ |  | +--------------+ |  |lo| | -> Kanban Columns
|  | | Order #1043  | |  | | Order #1032  | |  | | Order #1012  | |  |um| |
|  | | Buyer: Jane  | |  | | Qty: 3 items | |  | | Type: Pickup | |  |n4| |
|  | | [Acc]  [Rej] | |  | | [Mark Ready] | |  | | [Complete]   | |  |  | |
|  | +--------------+ |  | +--------------+ |  | +--------------+ |  |  | |
|  +------------------+  +------------------+  +------------------+  +--+ |
|                                                                         |
+-------------------------------------------------------------------------+
| [Footer - Reused from Doc 01]                                           |
+-------------------------------------------------------------------------+
```

---

## 2. Interactive Component Specifications

### A. Kanban Column Structure
- **Lanes**:
  1. **Incoming (Pending)**: Displays newly placed orders. Alerts staff via audio chime until handled.
  2. **Preparing**: Displays orders accepted and sent to the kitchen.
  3. **Dispatched / Ready**: Shows orders awaiting courier delivery or customer counter pickup.
  4. **Completed / Cancelled**: Log of closed transactions.
- **Card Sorting**: Cards are sorted chronologically by requested time slot to prioritize upcoming orders.

### B. Action Controls per Order Card (`<OrderQueueCard />`)
- **Incoming Action Buttons**:
  - `Accept`: Transitions status to `Accepted`, stops sound chime, and slides card to the `Preparing` column.
  - `Reject`: Displays a dismissible popup to select/write a rejection reason (e.g. "Kitchen busy", "Ingredient out of stock"), which triggers a cancellation alert to the customer.
- **Preparing Action Button**:
  - `Mark Ready`: Transitions status to `ready_for_pickup` or `out_for_delivery` depending on the delivery mode chosen by the customer.
- **Dispatch Action Button**:
  - `Complete`: Finalizes the order. Records that offline payment has been collected (Cash on Delivery or Counter payment).
- **Print Receipt Button**:
  - Triggers a print modal formatted for thermal receipt printers (80mm width standard) using CSS printing page styles.

---

## 3. Receipt Print Styling Rules
```css
@media print {
  body * {
    visibility: hidden;
  }
  #thermal-receipt, #thermal-receipt * {
    visibility: visible;
  }
  #thermal-receipt {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }
}
```

---

## 4. Frontend State & Backend API Schema

### Zustand Store: `useDistributorQueueStore`
Holds current lanes arrays:
```typescript
interface OrderCardData {
  id: number;
  customer_name: string;
  customer_phone: string;
  items: { name: string; quantity: number }[];
  delivery_type: 'delivery' | 'pickup';
  address: string;
  scheduled_time: string;
  total_price: number;
  status: string;
}

interface DistributorQueueStore {
  incoming: OrderCardData[];
  preparing: OrderCardData[];
  ready: OrderCardData[];
  completed: OrderCardData[];
  fetchQueue: () => Promise<void>;
  updateOrderStatus: (id: number, status: string, reason?: string) => Promise<void>;
}
```

### Backend API Integration
- **Endpoint 1: Load Queue**
  - Path: `/api/distributor/orders/`
  - Method: `GET`
  - Response: Array of `OrderCardData` blocks categorized by status.

- **Endpoint 2: Status Update Action**
  - Path: `/api/distributor/orders/:id/update-status/`
  - Method: `POST`
  - Request Body: `{ "status": "accepted", "rejection_reason": "" }`
  - Response: `{ "success": true }`

---

## 5. Next Steps
We will proceed to **Document 14: Distributor Sales Reports UI & Functionality**. This covers sales dashboards, peak hours analytics, menu performance ratings, and PDF data exports.
