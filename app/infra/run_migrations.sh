#!/bin/bash

# Migration runner for Grower Slot App
# Runs all SQL migration files in order

set -e

# Default to development if no environment specified
DATABASE_URL=${DATABASE_URL:-$1}

if [ -z "$DATABASE_URL" ]; then
  echo "Usage: $0 [DATABASE_URL]"
  echo "Or set DATABASE_URL environment variable"
  exit 1
fi

echo "Running migrations against database..."

# Run core migrations
echo "Running 001_init.sql..."
psql "$DATABASE_URL" -f app/infra/001_init.sql

echo "Running 002_seed.sql..."
psql "$DATABASE_URL" -f app/infra/002_seed.sql

# Run extensibility migrations
echo "Running 101_parties_products.sql..."
psql "$DATABASE_URL" -f app/infra/101_parties_products.sql

echo "Running 102_logistics.sql..."
psql "$DATABASE_URL" -f app/infra/102_logistics.sql

echo "Running 103_events_rules.sql..."
psql "$DATABASE_URL" -f app/infra/103_events_rules.sql

echo "All migrations completed successfully!"