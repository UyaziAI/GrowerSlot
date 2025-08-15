#!/usr/bin/env python3
"""
Seed test data for E2E testing in CI environment
Creates minimal data required for admin calendar E2E tests
"""

import asyncio
import asyncpg
import os
import sys
from datetime import datetime, timedelta, time
import uuid

async def seed_database():
    """Seed the database with test data for E2E tests"""
    
    # Database connection
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Construct from individual components
        host = os.getenv('PGHOST', 'localhost')
        port = os.getenv('PGPORT', '5432')
        user = os.getenv('PGUSER', 'postgres')
        password = os.getenv('PGPASSWORD', 'postgres')
        database = os.getenv('PGDATABASE', 'grower_slot_test')
        database_url = f'postgresql://{user}:{password}@{host}:{port}/{database}'
    
    print(f"Connecting to database...")
    
    try:
        conn = await asyncpg.connect(database_url)
        print("✓ Database connection established")
        
        # Clear existing test data
        print("Clearing existing test data...")
        await conn.execute("DELETE FROM bookings")
        await conn.execute("DELETE FROM slot_restrictions")  
        await conn.execute("DELETE FROM slots")
        await conn.execute("DELETE FROM cultivars")
        await conn.execute("DELETE FROM growers")
        await conn.execute("DELETE FROM users")
        await conn.execute("DELETE FROM tenants")
        
        # Create test tenant
        tenant_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO tenants (id, name, timezone) 
            VALUES ($1, 'Test Packhouse', 'Africa/Johannesburg')
        """, tenant_id)
        print(f"✓ Created test tenant: {tenant_id}")
        
        # Create test users
        admin_id = str(uuid.uuid4())
        grower_user_id = str(uuid.uuid4())
        
        await conn.execute("""
            INSERT INTO users (id, tenant_id, email, password_hash, role, name) 
            VALUES 
                ($1, $2, 'admin@test.com', '$2b$10$test_hash_admin', 'admin', 'Test Admin'),
                ($3, $2, 'grower@test.com', '$2b$10$test_hash_grower', 'grower', 'Test Grower')
        """, admin_id, tenant_id, grower_user_id)
        print(f"✓ Created test users: admin and grower")
        
        # Create test growers
        grower_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO growers (id, tenant_id, name, contact) 
            VALUES ($1, $2, 'Lowveld Farms', 'contact@lowveld.com')
        """, grower_id, tenant_id)
        print(f"✓ Created test grower: {grower_id}")
        
        # Create test cultivars
        cultivar_ids = []
        cultivars = ['Beaumont', 'A4', 'Nelspruit']
        for cultivar_name in cultivars:
            cultivar_id = str(uuid.uuid4())
            cultivar_ids.append(cultivar_id)
            await conn.execute("""
                INSERT INTO cultivars (id, tenant_id, name) 
                VALUES ($1, $2, $3)
            """, cultivar_id, tenant_id, cultivar_name)
        print(f"✓ Created {len(cultivars)} test cultivars")
        
        # Create test slots for the next 7 days
        today = datetime.now().date()
        slot_count = 0
        
        for day_offset in range(7):
            slot_date = today + timedelta(days=day_offset)
            
            # Create 4 slots per day (8:00-12:00, 12:00-16:00, with morning/afternoon splits)
            time_slots = [
                ('08:00', '10:00'),
                ('10:00', '12:00'), 
                ('13:00', '15:00'),
                ('15:00', '17:00')
            ]
            
            for start_time_str, end_time_str in time_slots:
                slot_id = str(uuid.uuid4())
                
                # Some slots have restrictions or blackouts for testing
                blackout = day_offset == 6 and start_time_str == '15:00'  # Last slot of week 
                capacity = 15.0 if not blackout else 20.0
                
                await conn.execute("""
                    INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, blackout, notes, created_by) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, slot_id, tenant_id, slot_date, start_time_str, end_time_str, capacity, blackout, 
                    f"Test slot {start_time_str}-{end_time_str}", admin_id)
                
                slot_count += 1
                
                # Add some bookings to create realistic usage data
                if not blackout and day_offset < 5:  # Book some slots in the first 5 days
                    booking_id = str(uuid.uuid4())
                    quantity = 5.0 + (day_offset * 2)  # Varying quantities
                    
                    await conn.execute("""
                        INSERT INTO bookings (id, slot_id, tenant_id, grower_id, cultivar_id, quantity, status, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', NOW())
                    """, booking_id, slot_id, tenant_id, grower_id, cultivar_ids[0], quantity)
        
        print(f"✓ Created {slot_count} test slots with bookings")
        
        # Add some slot restrictions for testing
        restricted_slot = await conn.fetchrow("""
            SELECT id FROM slots 
            WHERE tenant_id = $1 AND blackout = false 
            LIMIT 1
        """, tenant_id)
        
        if restricted_slot:
            restriction_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO slot_restrictions (id, slot_id, allowed_grower_id)
                VALUES ($1, $2, $3)
            """, restriction_id, restricted_slot['id'], grower_id)
            print(f"✓ Added slot restriction for testing")
        
        # Create some domain events and audit log entries
        event_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO domain_events (id, tenant_id, event_type, aggregate_id, data, created_at)
            VALUES ($1, $2, 'SLOTS_BULK_CREATED', $3, $4, NOW())
        """, event_id, tenant_id, admin_id, '{"count": ' + str(slot_count) + ', "date_range": "7 days"}')
        
        audit_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, changes, timestamp)
            VALUES ($1, $2, $3, 'CREATE', 'slots', $4, $5, NOW())
        """, audit_id, tenant_id, admin_id, admin_id, '{"bulk_created": ' + str(slot_count) + '}')
        
        print(f"✓ Created audit trail entries")
        
        # Verify data counts
        slot_count_check = await conn.fetchval("SELECT COUNT(*) FROM slots WHERE tenant_id = $1", tenant_id)
        booking_count_check = await conn.fetchval("SELECT COUNT(*) FROM bookings WHERE tenant_id = $1", tenant_id)
        
        print(f"✓ Verification: {slot_count_check} slots, {booking_count_check} bookings created")
        print("✓ Test data seeding completed successfully!")
        
        await conn.close()
        
    except Exception as e:
        print(f"✗ Error seeding test data: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(seed_database())