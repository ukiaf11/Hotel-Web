# Hotel Express — React SPA

React 19 + TypeScript + Vite. Routing with React Router v7, state with Zustand, styling with
vanilla CSS custom properties (design tokens from
[`../docs/19_ui_ux_design_system.md`](../docs/19_ui_ux_design_system.md)).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint
```

## Demo backend

`src/services/api.ts` reads `VITE_API_URL`:

- **empty** → every request is served by `src/services/demo/`, an in-browser implementation of the
  same REST API with seeded data persisted to `localStorage`. This is how the public demo runs.
- **set** → requests go to the Django API over HTTP with a bearer token.

The demo layer implements ~50 routes with the same payloads, validation and error codes as Django,
including PDF invoices and CSV/PDF report exports (generated client-side by `demo/pdf.ts`).

## Structure

```
src/
├── components/   Button, Input, Modal, Toggle, Card, Toasts, Header, Footer,
│                 NotificationDrawer, SalesChart, MapPicker, ProtectedRoute
├── features/
│   ├── auth/         sign-in / sign-up modal with role selection
│   ├── customer/     home, hotel details, scheduling, checkout, tracking, history, profile
│   ├── distributor/  dashboard, hotel profile, menu, delivery, queue, reports, staff
│   ├── admin/        verification queue, ticket inbox, global settings
│   └── support/      help centre
├── hooks/        useSyncedState
├── lib/          types, formatting, validation
├── services/     API client, error types, demo backend
├── store/        auth, cart, hotels, orders, profile, distributor, notifications, support, admin, ui
└── styles/       variables.css · components.css · app.css
```

## Notes

- Every screen has loading skeletons, empty states and error states.
- Light and dark themes; the toggle lives in the header and persists to `localStorage`.
- `prefers-reduced-motion` is respected throughout.
- Distributor route access follows the doc 15 permission matrix via `ProtectedRoute`.
