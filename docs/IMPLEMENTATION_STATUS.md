# Implementation status

Audit date: **2026-08-21**.

## Audit result

The repository contained only scaffolding: the Vite starter template on the frontend
(`App.tsx` was the counter demo) and bare `django-admin startproject` output on the backend
with **zero apps, models, endpoints or migrations**. `react-router`, `zustand` and
`django-ninja` were not wired up at all. Every feature in `docs/01`–`docs/20` was missing.

Everything below has since been built and verified.

## Phase 0 — Foundations
- [x] Frontend deps: `react-router-dom` v7, `zustand`
- [x] Backend wiring: django-ninja root router, CORS, JWT, WhiteNoise, env-driven settings
- [x] Design-system CSS — `variables.css`, `components.css`, `app.css` (doc 19)
- [x] Shared component library — Button, Input, Select, TextArea, Modal, Card, Toggle, Badge, Pills, Toasts, Skeleton, EmptyState, Stars, QuantityStepper, Alert, ConfirmDialog, MapPicker, SalesChart
- [x] API service layer with real-HTTP ⇄ in-browser demo backend switch (`VITE_API_URL`)

## Phase 1 — Backend (doc 20)
- [x] `apps/authentication` — custom email `User` with six roles, `Address`, JWT login/register/refresh, four auth guards
- [x] `apps/hotels` — `Hotel` model, public feed with five filters, distributor profile, logistics, slot generation
- [x] `apps/menu` — `MenuCategory` + `FoodItem` CRUD, stock toggle, pre-order lead time
- [x] `apps/orders` — `Order`/`OrderItem`/`Review`, pricing, geo radius, lead-time guard, status machine, cancel window, PDF invoices
- [x] `apps/notifications` — feed and mark-read
- [x] `apps/support` — FAQs, tickets, threaded replies
- [x] `apps/console` — verification queue, ticket inbox, `SiteConfig` maintenance switch
- [x] Distributor analytics — KPIs, 7-day trend, sales reports, CSV + PDF export
- [x] Staff sub-accounts with the doc 15 permission matrix enforced server-side
- [x] `seed_demo` management command, migrations, **33 integration tests**

## Phase 2 — Customer frontend (docs 01–08)
- [x] 01 Home feed — sticky header, hero search (300 ms debounce), filter pills, hotel grid, active-order banner, footer
- [x] 02 Hotel details — hero, delivery-availability box, sticky category tabs, menu search, item cards, cart bounce
- [x] 03 Scheduling — 14-day calendar, 30-minute slot grid, lead-time lockout with explainer, instructions
- [x] 04 Cart & checkout — delivery/pickup segmented control, saved addresses, map pin, offline-payment panel, auth gate
- [x] 05 Order success & tracking — 5-stage stepper, ETA, call/directions, cancel window, 10 s polling
- [x] 06 Auth modal — tabs, role selector, on-blur validation, password strength, redirect logic, checkout-gate warning
- [x] 07 Profile dashboard — personal info, address book CRUD with coordinates, password change
- [x] 08 Order history — filters, search, re-order with cart-overwrite prompt, PDF invoice, review modal

## Phase 3 — Distributor frontend (docs 09–15)
- [x] 09 Dashboard — online toggle, animated KPI cards, incoming alerts with WebAudio chime, 7-day chart
- [x] 10 Hotel profile — identity form, hours validation, drag-and-drop uploader with progress, map pin
- [x] 11 Menu manager — category bar with delete, item modal, stock switch (optimistic), pre-order config
- [x] 12 Delivery settings — enable toggle with collapse, fees, radius slider, slot blocks
- [x] 13 Order queue — four-lane kanban, accept/reject with reasons, ready/complete, 80 mm thermal receipt printing
- [x] 14 Sales reports — range presets + custom, SVG line chart, sortable top-items table, CSV/PDF export
- [x] 15 Staff management — table, modal CRUD, suspend switch, role matrix, route guards

## Phase 4 — System frontend (docs 16–18)
- [x] 16 Notification centre — sliding drawer, toasts, volume/tone settings with preview
- [x] 17 Help & support — FAQ search + accordion, ticket form linked to orders, threaded tracker
- [x] 18 Admin console — verification queue with map check, ticket inbox with replies, maintenance mode

## Phase 5 — UI/UX pass
- [x] Light + dark themes on a single token set, persisted and system-aware
- [x] Motion: spring modals, card lift, pulsing status rings, cart-badge bounce, count-up KPIs
- [x] Accessibility: skip link, focus-visible rings, ARIA roles/labels, keyboard-navigable cards and dialogs, `prefers-reduced-motion`
- [x] Responsive at 360 / 768 / 1280 with mobile nav, stacking grids, horizontal-scroll kanban
- [x] Skeletons, empty states and error states on every screen

## Phase 6 — Ship
- [x] Multi-stage `Dockerfile`, `entrypoint.sh`, `docker-compose.yml`, `render.yaml`
- [x] GitHub Actions CI — backend tests, migration check, deploy check, frontend lint/build, Docker build
- [x] `vercel.json`, production build, deployed live

## Verification performed

| Check | Result |
|---|---|
| Django integration tests | 33 passed |
| `manage.py check --deploy` | no issues |
| Demo backend API suite (headless) | 40 assertions passed |
| Every route rendered in jsdom for anonymous, customer, distributor, cook and admin | all passed |
| `npm run lint` / `tsc -b` / `vite build` | clean |
| Generated invoice PDF parsed with `pdftotext` | valid |
