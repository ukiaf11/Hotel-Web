# Document 01: Hotel Ordering Platform - Home Feed Page UI & Functionality

This document details the user interface, interaction flows, responsive layouts, state variables, and backend API endpoints for the main Home Feed page.

---

## 1. Page Layout & Wireframe
The Home Feed is the entry point for buyers. It features a sticky header, a hero/search section, quick-filter tabs, a dynamic hotel listing grid, an active orders panel, and a structured footer.

```
+-------------------------------------------------------------------------+
| [Logo]   Home   Profile   Help   Active Orders(2)      [Login / Sign Up]| -> Header (Sticky)
+-------------------------------------------------------------------------+
|                                                                         |
|                Find the Best Hotels & Meals Near You                    | -> Hero Section
|             [ Search hotels, cuisines, or locations...        ] [Search] |
|                                                                         |
+-------------------------------------------------------------------------+
|  [Tabs: All | Fast Delivery | Top Rated | Delivery Available | Open Now]| -> Filter Tabs
+-------------------------------------------------------------------------+
|                                                                         |
|  +--------------------+  +--------------------+  +--------------------+ |
|  | [Hotel Image]      |  | [Hotel Image]      |  | [Hotel Image]      | |
|  | Royal Palace       |  | Green Valley Dine  |  | Ocean Breeze Inn   | |
|  | Place: Downtown    |  | Place: West Side   |  | Place: Coastal Rd  | | -> Hotels Grid
|  | Tel: +123456789    |  | Tel: +198765432    |  | Tel: +144556677    | |
|  | [View Map]         |  | [View Map]         |  | [View Map]         | |
|  +--------------------+  +--------------------+  +--------------------+ |
|                                                                         |
+-------------------------------------------------------------------------+
|  [Active Orders Bar: Order #1043 preparing - Click to Track]            | -> Floating Tracker
+-------------------------------------------------------------------------+
| Links: About | Support | Terms | Become a Distributor                   | -> Footer
+-------------------------------------------------------------------------+
```

---

## 2. Interactive Component Specifications

### A. Header Component (`<Header />`)
- **Visuals**: Modern blurred background (CSS: `backdrop-filter: blur(12px)`) with transparent HSL colors, sticky position at the top (`z-index: 1000`).
- **Brand Logo**: Dynamic scale animation on hover.
- **Nav Links**:
  - `Home`: Active state styled with a subtle bottom underline gradient.
  - `Profile`: Direct path to user profile (if logged in) or triggers the authentication modal (if anonymous).
  - `Active Orders`: Floating badge showing number of active orders.
  - `Login/Register Button`: Glassmorphism design button, transitions to solid accent color on hover.

### B. Search & Filter Bar Component (`<SearchFilters />`)
- **Search Input**:
  - Input field with debounced query state (300ms delay before triggering API call).
  - Clean/Clear icon (appears when characters > 0).
- **Filter Tabs**:
  - Interactive pill buttons with transition effects on selection.
  - Options:
    1. **All**: Default state showing all active hotels.
    2. **Fast Delivery**: Filters hotels offering home delivery with an average delivery duration < 30 minutes.
    3. **Top Rated**: Sorts hotels by rating descending (minimum rating 4.0).
    4. **Delivery Available**: Filters out hotels where the distributor has home delivery toggled off.
    5. **Open Now**: Filters hotels based on operational hours compared to system local time.

### C. Hotel Card Component (`<HotelCard />`)
- **Card Wrapper**: Card element with hover scale effect (`transform: translateY(-4px)`) and smooth shadow transition.
- **Banner Image**: High-resolution image. Uses a loading skeleton state while fetching image URLs.
- **Hotel Metadata**:
  - **Hotel Name**: Large, semantic header text.
  - **Place**: Text showing location tag.
  - **Contact Number**: Clickable element (`tel:` link) for mobile users.
  - **Google Map Link**: Inline button with custom icon, linking directly to coordinates or location search in a new tab (`target="_blank"`).
- **Navigation Click**: Clicking anywhere on the card container (except the direct Google Maps link or phone number) executes a router navigation to `/hotels/:id`.

### D. Active Orders Floating Panel (`<ActiveOrdersBanner />`)
- **Behavior**: Appears slides up from the bottom-right corner when `activeOrdersStore` contains pending/preparing orders.
- **Micro-animation**: Pulsating status dot (Green for Dispatched, Orange for Preparing/Pending).
- **Action**: Clicking on the banner directs the user to `/orders/track/:id`.

---

## 3. UX Micro-Animations & Responsive Grid Standards

### CSS Micro-Animations
```css
/* Card Hover Effect */
.hotel-card {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), 
              box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.hotel-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
}

/* Skeleton Loading Pulsate */
@keyframes skeleton-pulsate {
  0% { background-color: var(--color-bg-light-gray); }
  50% { background-color: var(--color-bg-medium-gray); }
  100% { background-color: var(--color-bg-light-gray); }
}
.skeleton-loader {
  animation: skeleton-pulsate 1.5s infinite ease-in-out;
}
```

### Grid Layout Breakpoints
- **Mobile** (`max-width: 600px`): Single-column layout (`grid-template-columns: 1fr`).
- **Tablet** (`max-width: 1024px`): Two-column layout (`grid-template-columns: repeat(2, 1fr)`).
- **Desktop** (`min-width: 1025px`): Three-column or four-column layout (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`).

---

## 4. State Management & API Integration

### Zustand Store: `useHotelStore`
Tracks search, filters, loading states, and fetched hotels:
```typescript
interface Hotel {
  id: number;
  name: string;
  place: string;
  contact_number: string;
  google_map_url: string;
  banner_image: string;
  rating: number;
  has_delivery: boolean;
  is_open: boolean;
}

interface HotelStore {
  hotels: Hotel[];
  isLoading: boolean;
  searchQuery: string;
  activeFilter: string;
  fetchHotels: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
}
```

### Backend Endpoint Integration
- **Endpoint**: `/api/hotels/`
- **Method**: `GET`
- **Query Parameters**:
  - `search`: string (filters by name, place)
  - `filter_type`: `all` | `delivery` | `top_rated` | `open_now`
- **Response Format (JSON)**:
  ```json
  [
    {
      "id": 1,
      "name": "Grand Palace Hotel",
      "place": "Central Avenue",
      "contact_number": "+1234567890",
      "google_map_url": "https://maps.google.com/?q=Grand+Palace+Hotel",
      "banner_image": "https://cdn.platform.com/images/hotels/1.jpg",
      "rating": 4.7,
      "has_delivery": true,
      "is_open": true
    }
  ]
  ```

---

## 5. Next Steps
We will proceed to **Document 02: Hotel Details Page UI & Functionality**, which specifies the detailed view for a single hotel, its menu categorization, items configuration, and delivery option verification. Let me know when you are ready to proceed.
