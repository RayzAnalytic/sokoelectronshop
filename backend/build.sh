#!/usr/bin/env bash
set -o errexit

echo "── Installing dependencies ──"
pip install -r requirements.txt

echo "── Collecting static files ──"
python manage.py collectstatic --no-input

echo "── Running migrations ──"
python manage.py migrate

echo "── Creating superuser (idempotent) ──"
python manage.py createsuperuser --no-input || echo "Superuser already exists — skipping."

echo "── Build complete ──"