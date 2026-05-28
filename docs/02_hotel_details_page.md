# Document 02: Hotel Ordering Platform - Hotel Details Page UI & Functionality

This document details the user interface, interactive components, operational rules, state management, and backend endpoints for the individual Hotel Details view.

---

## 1. Page Layout & Wireframe
The Hotel Details page provides detailed information about a selected hotel, including operational status, delivery availability, location maps, menu search/filters, and item quantity selection.

```
+-------------------------------------------------------------------------+
| [Header - Reused from Doc 01]                                           |
+-------------------------------------------------------------------------+
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                        [Hotel Banner Image]                       |  |
|  |                                                                   |  |
|  |  Grand Palace Hotel                           [Status: Open Now]  |  | -> Hero Area
|  |  Place: Central Avenue, Suite 10              Rating: ★ 4.7       |  |
|  |  Tel: +1234567890                             [View on Google Map]|  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +----------------------------------+  +-----------------------------+  |
|  | [Menu Category Tabs]             |  | [Delivery Availability Box] |  |
|  | Starters | Mains | Drinks | Custom|  | (x) Home Delivery is NOT    |  | -> Delivery Info
|  |                                  |  |     available. Self-Pickup  |  |    & Tab Panel
|  | Search Menu: [ Search items... ] |  |     Only.                   |  |
|  +----------------------------------+  +-----------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | +-----------------------+   +-----------------------------------+ |  |
|  | | [Item Image]          |   | [Item Image]                      | |  |
|  | | Spicy Paneer Tikka    |   | Classic Club Sandwich             | |  |
|  | | Price: $12.50         |   | Price: $9.00                      | |  | -> Item Grid
|  | | [Custom Order (1 hr)] |   | [Instant Item]                    | |  |
|  | | [-]  2  [+] [Add]     |   | [-]  1  [+] [Add]                 | |  |
|  | +-----------------------+   +-----------------------------------+ |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+
| [Footer - Reused from Doc 01]                                           |
+-------------------------------------------------------------------------+
```

---

## 2. Interactive Component Specifications

### A. Hotel Hero & Banner Section
- **Visuals**: A full-bleed responsive banner image with overlay text for high legibility.
- **Google Maps Integration Link**:
  - Anchored button with the maps icon.
  - Clicking this opens the verified Google Maps URL set by the distributor in a new tab (`target="_blank"`).
- **Status Indicator Badge**:
  - Dynamically colored: Green background for `Open`, Red background for `Closed`.
  - Calculated on the frontend using the hotel's `opening_time` and `closing_time` fields against local time.

### B. Delivery Availability Notification Box
- **Rule Verification**: If the hotel's field `has_delivery` is false, render an alert box with high contrast:
  - Text: `"⚠️ Home Delivery is NOT available for this hotel. All items must be collected via Self-Pickup."`
  - Style: Warning theme (soft amber background with dark amber text).
  - If `has_delivery` is true:
    - Text: `"✓ Home Delivery is available for this hotel. (Delivery charges apply)."`
    - Style: Success theme (soft green background with dark green text).

### C. Menu Search & Category Tabs
- **Sticky Menu Navigation**: Category tabs stick below the main header on scroll (`position: sticky; top: var(--header-height)`).
- **Category Filter**:
  - Clicking a category tab scrolls the grid directly to that section (Anchor scrolling with `behavior: 'smooth'`).
  - Categories are dynamically generated based on the active items configured by the distributor.
- **Menu Search**:
  - Text input filtering items in real-time on the client side (case-insensitive substring match).

### D. Food Item Card (`<FoodItemCard />`)
- **Visuals**: Split layout with image on the left/top, title, description, badge, price, and actions on the right/bottom.
- **Instant vs. Custom/Pre-Order Badges**:
  - **Instant Items**: Default items ready within standard kitchen time.
  - **Custom Orders**: Labeled with a distinct warning badge: `"On-Order: Requires X hour(s) preparation time"`.
- **Quantity Selector Component**:
  - Plus/Minus buttons updating local state.
  - "Add to Cart" button: Adds the item with selected quantity to the global `useCartStore` state.
  - If the item is already in the cart, replace the button with an active quantity counter (`[-] Qty [+]`) to prevent double additions.

---

## 3. UX Micro-Animations & Responsive Standards
- **Category Smooth Transition**: Active tab uses CSS transition for background slide movement.
- **Cart Add Bounce**: Trigger a spring/bounce animation on the cart badge in the header whenever an item is added.
- **Responsive Layout**: On mobile viewports, the Delivery Box shifts to stack below the Hero section, and the Menu Items grid collapses to a single-column listing.

---

## 4. Frontend State & Backend API Schema

### Zustand Store: `useActiveHotelStore` & `useCartStore`
```typescript
interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  preparation_time_hours: number;
}

interface CartStore {
  cartItems: CartItem[];
  hotelId: number | null; // Ensures orders cannot mix items from different hotels
  addToCart: (item: CartItem, hotelId: number) => void;
  removeFromCart: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
}
```

### Backend API Integration
- **Endpoint 1: Hotel Info**
  - Path: `/api/hotels/:id/`
  - Method: `GET`
  - Response:
    ```json
    {
      "id": 1,
      "name": "Grand Palace Hotel",
      "place": "Central Avenue, Suite 10",
      "contact_number": "+1234567890",
      "google_map_url": "https://maps.google.com/?q=Grand+Palace",
      "banner_image": "https://cdn.platform.com/images/hotels/1.jpg",
      "rating": 4.7,
      "has_delivery": false,
      "opening_time": "08:00:00",
      "closing_time": "22:00:00"
    }
    ```

- **Endpoint 2: Menu Items**
  - Path: `/api/hotels/:id/menu/`
  - Method: `GET`
  - Response:
    ```json
    [
      {
        "id": 101,
        "name": "Spicy Paneer Tikka",
        "description": "Cottage cheese cubes marinated in spices, grilled in tandoor.",
        "price": 12.50,
        "category": "Starters",
        "image": "https://cdn.platform.com/images/items/paneer.jpg",
        "is_custom_order": true,
        "preparation_time_hours": 1.0,
        "is_available": true
      }
    ]
    ```

---

## 5. Next Steps
We will proceed to **Document 03: Hotel Order Scheduling Page UI & Functionality**. This handles dates selection, time grids, advance booking lead times, and special instructions. Say "Next" to continue.
