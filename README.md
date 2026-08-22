# Hotel Express — Hotel Ordering Platform

A full-stack ordering platform that connects diners with neighbourhood hotels and food
distributors. Customers browse verified kitchens, schedule delivery or pickup slots around
kitchen lead times, and pay offline. Distributors run their kitchen from a workspace with a
live order queue, menu CRUD, logistics rules, staff sub-accounts and sales analytics.
Administrators verify listings, answer support tickets and hold the platform kill switch.

Built to the 21-part specification in [`docs/`](docs/).

---

## Live demo

**<https://ukiaf11.github.io/Hotel-Web/>**

The published SPA runs against a **built-in demo backend**: a complete in-browser
implementation of the same REST API, seeded with six hotels, menus, order history, staff and
support tickets, and persisted in `localStorage`. Nothing is shared between visitors, so you can
change anything — there is a **Reset demo data** button in the footer.

Sign in with any of these:

| Role | Email | Password |
|---|---|---|
| Customer | `jane@hotelexpress.dev` | `Customer1` |
| Distributor (hotel owner) | `royal@hotelexpress.dev` | `Distributor1` |
| Manager / Cook / Courier | `alice@` / `bob@` / `charlie@hotelexpress.dev` | `Staff12345` |
| Platform admin | `admin@hotelexpress.dev` | `Admin1234` |

Point `VITE_API_URL` at a deployed Django instance and the exact same UI talks to the real API
instead — the demo layer is bypassed entirely.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 · TypeScript · Vite · React Router v7 · Zustand · vanilla CSS with custom properties |
| Backend | Django 6 · django-ninja · PyJWT · PostgreSQL (SQLite for local dev) · Celery + Redis |
| Tooling | `uv` for Python, npm for Node, multi-stage Docker, GitHub Actions |

Charts, PDFs (invoices and sales reports), icons and the map picker are all hand-rolled — there
are no chart, icon or PDF dependencies in the frontend bundle.

---

## Order notification email

Placing an order sends two messages immediately: a **kitchen ticket to the distributor**
(full food list plus the customer's name, phone, email and delivery address) and a
**confirmation to the customer**. Both have HTML and plain-text parts.

| Runtime | How it sends |
|---|---|
| Django backend | `EmailMultiAlternatives` over SMTP, queued on Celery, scheduled on transaction commit. With no `EMAIL_HOST` set it falls back to the console backend, so it works in development with no credentials. |
| Demo backend (the published site) | A browser cannot speak SMTP, so the same two messages are composed and sent through **EmailJS** when `VITE_EMAILJS_*` is configured; otherwise each one is recorded in the in-app outbox at **`/outbox`** so the behaviour stays visible and inspectable. |

Sending is best-effort on both sides — a mail outage is logged and swallowed, never
allowed to fail an order that has already been placed.

Configure it with `EMAIL_HOST` and friends in [`backend/.env.example`](backend/.env.example)
(Gmail app password, Brevo and Resend are all documented there) or `VITE_EMAILJS_*` in
[`frontend/.env.example`](frontend/.env.example). Toggles: `ORDER_EMAILS_ENABLED`,
`ORDER_EMAIL_TO_DISTRIBUTOR`, `ORDER_EMAIL_TO_CUSTOMER`.

---

## Repository layout

```
Hotel-Web/
├── backend/                 Django project (uv-managed)
│   ├── config/              settings, urls, api.py root router, celery
│   ├── apps/
│   │   ├── authentication/  custom user, roles, JWT, addresses, staff sub-accounts
│   │   ├── hotels/          hotel profile, public feed, logistics, delivery slots
│   │   ├── menu/            categories and food items
│   │   ├── orders/          orders, order items, reviews, queue, analytics, invoices
│   │   ├── notifications/   notification feed, order email + Celery task
│   │   ├── support/         FAQs and support tickets
│   │   └── console/         admin console + global site configuration
│   ├── templates/email/     HTML + text order email templates
│   └── tests/               45 integration tests
├── frontend/                React SPA
│   └── src/
│       ├── components/      shared UI primitives, header/footer, charts, map picker
│       ├── features/        auth · customer · distributor · admin · support screens
│       ├── services/        API client + the in-browser demo backend
│       ├── store/           Zustand stores
│       └── styles/          design tokens, primitives, page layouts
├── docs/                    the 21-part specification
├── docker-compose.yml       Postgres + Redis + web + celery worker
└── render.yaml              one-click Django deploy on Render's free tier
```

---

## Local development

### Backend

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py seed_demo      # six hotels, menus, orders, staff, FAQs
uv run python manage.py runserver
```

API root: <http://localhost:8000/api/v1/> · interactive docs: <http://localhost:8000/api/v1/docs>

### Frontend

```bash
cd frontend
npm install
npm run dev            # demo backend, no server needed
```

To use the Django API instead, create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
```

### Everything at once (Docker)

```bash
docker compose up --build
```

Brings up Postgres, Redis, the Django API on `:8000` (migrated and seeded), and a Celery worker.

---

## Tests and checks

```bash
cd backend  && uv run python manage.py test          # 33 integration tests
cd frontend && npm run lint && npm run build         # eslint + tsc + production build
```

CI runs both on every push, plus `makemigrations --check`, `check --deploy` and a Docker build.

---

## Deployment

- **Frontend** — any static host. `frontend/vercel.json` sets the SPA rewrite and asset caching.
- **Backend** — `render.yaml` provisions a free Render web service plus a free Postgres database
  from the multi-stage `backend/Dockerfile`. `entrypoint.sh` migrates, collects static files and
  optionally seeds demo data on boot.

After deploying the API, set `VITE_API_URL` on the frontend host and redeploy to switch the SPA
from the demo backend to the live one.

---

## Feature coverage

Every document in `docs/` is implemented:

| Doc | Feature | Where |
|---|---|---|
| 01 | Home feed, debounced search, filter pills, active-order banner | `features/customer/HomePage.tsx` |
| 02 | Hotel details, delivery availability notice, sticky categories, cart | `features/customer/HotelDetailsPage.tsx` |
| 03 | Calendar, 30-minute slot grid, kitchen lead-time lockout | `features/customer/SchedulePage.tsx` |
| 04 | Split checkout, delivery/pickup, map pin, offline payment, auth gate | `features/customer/CheckoutPage.tsx` |
| 05 | Status stepper, ETA, call/directions, polling, cancel window | `features/customer/TrackOrderPage.tsx` |
| 06 | Dismissible auth modal, role selection, live validation, redirects | `features/auth/AuthModal.tsx` |
| 07 | Profile, address book CRUD with coordinates, password change | `features/customer/ProfilePage.tsx` |
| 08 | History filters, re-order, PDF invoices, review modal | `features/customer/OrderHistoryPage.tsx` |
| 09 | KPI cards, online toggle, incoming alerts with chime, 7-day chart | `features/distributor/DashboardPage.tsx` |
| 10 | Identity form, hours validation, drag-and-drop media, map pin | `features/distributor/HotelProfilePage.tsx` |
| 11 | Menu CRUD, categories, stock toggle, pre-order lead time | `features/distributor/MenuPage.tsx` |
| 12 | Delivery toggle, fee matrix, radius slider, slot blocks | `features/distributor/DeliveryPage.tsx` |
| 13 | Four-lane kanban, state machine, reject reasons, thermal receipt | `features/distributor/QueuePage.tsx` |
| 14 | Range filters, SVG charts, sortable top items, CSV/PDF export | `features/distributor/ReportsPage.tsx` |
| 15 | Staff CRUD, suspend switch, role permission matrix + guards | `features/distributor/StaffPage.tsx` |
| 16 | Notification drawer, toasts, WebAudio chime settings | `components/NotificationDrawer.tsx` |
| 17 | FAQ search/accordion, ticket form, threaded ticket tracker | `features/support/HelpPage.tsx` |
| 18 | Verification queue, ticket inbox with replies, maintenance mode | `features/admin/AdminPage.tsx` |
| 19 | HSL token system, primitives, motion, light + dark themes | `src/styles/` |
| 20 | Models, django-ninja routers, Docker, compose, CI/CD | `backend/` |
