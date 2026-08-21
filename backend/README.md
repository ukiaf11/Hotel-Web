# Hotel Express — Django API

Type-hinted REST API built with **django-ninja**, managed with **uv**. Implements the schema and
endpoint map from [`../docs/20_backend_architecture.md`](../docs/20_backend_architecture.md).

## Quick start

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py seed_demo
uv run python manage.py runserver
```

- OpenAPI / Swagger UI: <http://localhost:8000/api/v1/docs>
- Django admin: <http://localhost:8000/admin/> (`admin@hotelexpress.dev` / `Admin1234` after seeding)

## Configuration

All settings are environment driven — see [`.env.example`](.env.example). With no `DATABASE_URL`
the project uses SQLite; with no `REDIS_URL` Celery tasks run eagerly in-process.

## Apps

| App | Responsibility |
|---|---|
| `authentication` | Custom email-based `User` with roles, JWT issuing/verification, addresses, distributor staff sub-accounts |
| `hotels` | Hotel profile, public feed with filters, operating hours, delivery slot generation, logistics settings |
| `menu` | Menu categories and food items, stock toggle, pre-order lead times |
| `orders` | Order lifecycle and state machine, pricing, geo radius checks, distributor queue, KPIs, sales reports, PDF invoices |
| `notifications` | Per-user notification feed |
| `support` | FAQs, support tickets and threaded replies |
| `console` | Admin verification queue, ticket inbox, global site configuration |

## Authorisation

`apps/authentication/jwt_auth.py` exposes four guards used across the routers:

| Guard | Who passes |
|---|---|
| `any_auth` | Any active authenticated account |
| `distributor_auth` | Hotel owner, manager, cook, courier |
| `manager_auth` | Hotel owner, manager |
| `admin_auth` | Platform admin |

Role scoping is enforced again inside handlers where the rule is finer than the guard — a courier,
for example, may only move an order to *out for delivery* or *completed*.

## Tests

```bash
uv run python manage.py test
```

33 integration tests covering the public feed, auth, the ordering guards (lead time, radius,
minimum order, delivery availability, scheduling horizon), the status machine, role permissions,
menu and logistics management, reporting exports, support and notifications.

## Deployment

`Dockerfile` is a two-stage build (uv-resolved virtualenv → slim runtime, non-root user).
`entrypoint.sh` migrates and collects static files on boot, and seeds demo data when
`SEED_DEMO_DATA=true`. `../render.yaml` deploys this image plus a free Postgres database.
