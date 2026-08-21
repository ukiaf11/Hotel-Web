#!/bin/sh
set -e

echo "Applying database migrations…"
python manage.py migrate --noinput

echo "Collecting static files…"
python manage.py collectstatic --noinput --clear

if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "Seeding demo data…"
  python manage.py seed_demo
fi

exec "$@"
