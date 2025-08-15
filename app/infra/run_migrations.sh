#!/bin/bash

# Database migration runner for CI and local development
# Runs SQL migrations in sequence and sets up database schema

set -e

# Check required environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$PGHOST" ]; then
    echo "Error: DATABASE_URL or PGHOST environment variable required"
    exit 1
fi

# Set PostgreSQL connection parameters
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGDATABASE=${PGDATABASE:-grower_slot_test}

echo "Starting database migrations..."
echo "Target database: $PGDATABASE on $PGHOST:$PGPORT"

# Check database connection
echo "Testing database connection..."
if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; then
    echo "Error: Cannot connect to PostgreSQL database"
    exit 1
fi

# Function to run SQL file
run_migration() {
    local sql_file="$1"
    local filename=$(basename "$sql_file")
    
    echo "Running migration: $filename"
    
    if [ -f "$sql_file" ]; then
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$sql_file"
        if [ $? -eq 0 ]; then
            echo "✓ $filename completed successfully"
        else
            echo "✗ $filename failed"
            exit 1
        fi
    else
        echo "Warning: Migration file not found: $sql_file"
    fi
}

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Core migrations (MVP tables)
echo "Running core migrations..."
run_migration "$SCRIPT_DIR/001_init.sql"
run_migration "$SCRIPT_DIR/002_seed.sql"

# Extensibility migrations
echo "Running extensibility migrations..."
run_migration "$SCRIPT_DIR/101_parties_products.sql"
run_migration "$SCRIPT_DIR/102_logistics.sql"
run_migration "$SCRIPT_DIR/103_events_rules.sql"

# Audit system migrations
echo "Running audit system migrations..."
run_migration "$SCRIPT_DIR/104_audit_system.sql"

echo "All migrations completed successfully!"

# Verify key tables exist
echo "Verifying database schema..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

echo "Database migration verification complete!"