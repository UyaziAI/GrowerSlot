"""
Tests for Next Available Slots Finder (B11)

Comprehensive tests for deterministic endpoint that returns first N eligible slots
after from_datetime respecting capacity, restrictions, and advance notice.
"""
import pytest
import asyncio
from datetime import datetime, date, time, timedelta
from backend.services.availability import find_next_available_slots
from backend.db import init_db, get_db_pool


@pytest.fixture
async def db_setup():
    """Setup test database connection and clean slate"""
    await init_db()
    pool = get_db_pool()
    
    # Clean up test data
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM bookings WHERE tenant_id = 'test-next-avail'")
        await conn.execute("DELETE FROM slot_restrictions WHERE slot_id IN (SELECT id FROM slots WHERE tenant_id = 'test-next-avail')")
        await conn.execute("DELETE FROM slots WHERE tenant_id = 'test-next-avail'")
        
        yield pool
        
        # Clean up after tests
        await conn.execute("DELETE FROM bookings WHERE tenant_id = 'test-next-avail'")
        await conn.execute("DELETE FROM slot_restrictions WHERE slot_id IN (SELECT id FROM slots WHERE tenant_id = 'test-next-avail')")
        await conn.execute("DELETE FROM slots WHERE tenant_id = 'test-next-avail'")


@pytest.mark.asyncio
async def test_returns_empty_when_no_capacity(db_setup):
    """Test returns empty list with total=0 when no remaining capacity"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    # Create a slot with full bookings (no remaining capacity)
    async with pool.acquire() as conn:
        # Create slot
        slot_result = await conn.fetchrow("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Full slot')
            RETURNING id
        """, tenant_id, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
        
        slot_id = slot_result['id']
        
        # Create booking that fills capacity
        await conn.execute("""
            INSERT INTO bookings (id, tenant_id, slot_id, grower_id, quantity, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'grower-1', $3, 'confirmed', NOW())
        """, tenant_id, slot_id, 50)
    
    # Test - should return empty since no remaining capacity
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    assert result['slots'] == []
    assert result['total'] == 0


@pytest.mark.asyncio
async def test_respects_cultivar_restrictions(db_setup):
    """Test respects cultivar allow-list restrictions"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create two slots
        slot1_result = await conn.fetchrow("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Restricted slot')
            RETURNING id
        """, tenant_id, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
        
        slot2_result = await conn.fetchrow("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Open slot')
            RETURNING id
        """, tenant_id, date(2025, 8, 20), time(11, 0), time(12, 0), 40)
        
        slot1_id = slot1_result['id']
        slot2_id = slot2_result['id']
        
        # Add cultivar restriction to first slot (only allows 'macadamia-a')
        await conn.execute("""
            INSERT INTO slot_restrictions (id, slot_id, restriction_type, allowed_values, notes)
            VALUES (gen_random_uuid(), $1, 'cultivar_allowlist', $2, 'Only macadamia-a allowed')
        """, slot1_id, ['macadamia-a'])
    
    # Test with cultivar not in allow-list - should only get unrestricted slot
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        cultivar_id='macadamia-b',  # Not in allow-list
        limit=10
    )
    
    assert len(result['slots']) == 1
    assert result['total'] == 1
    assert result['slots'][0]['notes'] == 'Open slot'
    assert result['slots'][0]['start_time'] == '11:00'
    
    # Test with cultivar in allow-list - should get both slots
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        cultivar_id='macadamia-a',  # In allow-list
        limit=10
    )
    
    assert len(result['slots']) == 2
    assert result['total'] == 2


@pytest.mark.asyncio
async def test_respects_grower_restrictions(db_setup):
    """Test respects grower allow-list restrictions"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create slot with grower restriction
        slot_result = await conn.fetchrow("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'VIP slot')
            RETURNING id
        """, tenant_id, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
        
        slot_id = slot_result['id']
        
        # Add grower restriction (only allows 'premium-grower')
        await conn.execute("""
            INSERT INTO slot_restrictions (id, slot_id, restriction_type, allowed_values, notes)
            VALUES (gen_random_uuid(), $1, 'grower_allowlist', $2, 'VIP growers only')
        """, slot_id, ['premium-grower'])
    
    # Test with grower not in allow-list - should get no slots
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        grower_id='regular-grower',  # Not in allow-list
        limit=10
    )
    
    assert result['slots'] == []
    assert result['total'] == 0
    
    # Test with grower in allow-list - should get the slot
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        grower_id='premium-grower',  # In allow-list
        limit=10
    )
    
    assert len(result['slots']) == 1
    assert result['total'] == 1
    assert result['slots'][0]['notes'] == 'VIP slot'


@pytest.mark.asyncio
async def test_skips_blackout_slots(db_setup):
    """Test excludes blackout=true slots"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create normal slot
        await conn.execute("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Available slot')
        """, tenant_id, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
        
        # Create blackout slot
        await conn.execute("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', true, 'Maintenance blackout')
        """, tenant_id, date(2025, 8, 20), time(11, 0), time(12, 0), 40)
    
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    # Should only return the non-blackout slot
    assert len(result['slots']) == 1
    assert result['total'] == 1
    assert result['slots'][0]['notes'] == 'Available slot'


@pytest.mark.asyncio
async def test_orders_properly_and_honors_limit(db_setup):
    """Test orders by date/time and respects limit parameter"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create slots in mixed order
        slots_data = [
            (date(2025, 8, 22), time(10, 0), time(11, 0), 'Third chronologically'),
            (date(2025, 8, 20), time(15, 0), time(16, 0), 'Second chronologically'),
            (date(2025, 8, 20), time(9, 0), time(10, 0), 'First chronologically'),
            (date(2025, 8, 25), time(8, 0), time(9, 0), 'Fourth chronologically'),
        ]
        
        for slot_date, start_time, end_time, notes in slots_data:
            await conn.execute("""
                INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, $6)
            """, tenant_id, slot_date, start_time, end_time, 30, notes)
    
    # Test ordering with no limit
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    assert len(result['slots']) == 4
    assert result['total'] == 4
    
    # Check proper chronological ordering
    expected_order = [
        'First chronologically',   # 2025-08-20 09:00
        'Second chronologically',  # 2025-08-20 15:00
        'Third chronologically',   # 2025-08-22 10:00
        'Fourth chronologically'   # 2025-08-25 08:00
    ]
    
    actual_order = [slot['notes'] for slot in result['slots']]
    assert actual_order == expected_order
    
    # Test limit enforcement
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=2
    )
    
    assert len(result['slots']) == 2
    assert result['total'] == 2
    assert result['slots'][0]['notes'] == 'First chronologically'
    assert result['slots'][1]['notes'] == 'Second chronologically'


@pytest.mark.asyncio
async def test_calculates_remaining_capacity_correctly(db_setup):
    """Test properly calculates remaining = capacity - SUM(bookings.quantity)"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create slot with capacity 100
        slot_result = await conn.fetchrow("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Partial booking slot')
            RETURNING id
        """, tenant_id, date(2025, 8, 20), time(9, 0), time(10, 0), 100)
        
        slot_id = slot_result['id']
        
        # Create partial bookings totaling 70
        await conn.execute("""
            INSERT INTO bookings (id, tenant_id, slot_id, grower_id, quantity, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'grower-1', $3, 'confirmed', NOW())
        """, tenant_id, slot_id, 30)
        
        await conn.execute("""
            INSERT INTO bookings (id, tenant_id, slot_id, grower_id, quantity, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'grower-2', $3, 'confirmed', NOW())
        """, tenant_id, slot_id, 40)
    
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    assert len(result['slots']) == 1
    assert result['total'] == 1
    
    slot = result['slots'][0]
    assert slot['remaining'] == 30  # 100 - 70
    assert slot['notes'] == 'Partial booking slot'


@pytest.mark.asyncio
async def test_filters_future_slots_from_datetime(db_setup):
    """Test only includes slots >= from_datetime"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create slots before and after the from_datetime
        past_slots = [
            (date(2025, 8, 14), time(9, 0), time(10, 0), 'Past date'),
            (date(2025, 8, 15), time(7, 0), time(8, 0), 'Same date, past time'),
        ]
        
        future_slots = [
            (date(2025, 8, 15), time(8, 0), time(9, 0), 'Same date, exact time'),
            (date(2025, 8, 15), time(9, 0), time(10, 0), 'Same date, future time'),
            (date(2025, 8, 16), time(7, 0), time(8, 0), 'Future date'),
        ]
        
        all_slots = past_slots + future_slots
        
        for slot_date, start_time, end_time, notes in all_slots:
            await conn.execute("""
                INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, $6)
            """, tenant_id, slot_date, start_time, end_time, 50, notes)
    
    # Query from 2025-08-15 08:00:00
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    # Should only get slots at or after 08:00 on 2025-08-15
    assert len(result['slots']) == 3
    assert result['total'] == 3
    
    returned_notes = [slot['notes'] for slot in result['slots']]
    expected_notes = ['Same date, exact time', 'Same date, future time', 'Future date']
    assert returned_notes == expected_notes


@pytest.mark.asyncio
async def test_invalid_datetime_format_raises_error(db_setup):
    """Test invalid datetime format raises ValueError"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    with pytest.raises(ValueError, match="Invalid datetime format"):
        await find_next_available_slots(
            tenant_id=tenant_id,
            from_datetime='invalid-datetime',
            db_pool=pool,
            limit=10
        )


@pytest.mark.asyncio
async def test_handles_timezone_aware_datetime(db_setup):
    """Test properly handles timezone-aware ISO datetime strings"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create slot for today at 10:00 
        await conn.execute("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'TZ test slot')
        """, tenant_id, date(2025, 8, 15), time(10, 0), time(11, 0), 50)
    
    # Test different timezone formats
    tz_formats = [
        '2025-08-15T08:00:00+02:00',  # UTC+2
        '2025-08-15T06:00:00Z',       # UTC (Z format)
        '2025-08-15T06:00:00+00:00',  # UTC explicit
    ]
    
    for tz_format in tz_formats:
        result = await find_next_available_slots(
            tenant_id=tenant_id,
            from_datetime=tz_format,
            db_pool=pool,
            limit=10
        )
        
        # All should find the 10:00 slot (after 08:00 local time)
        assert len(result['slots']) == 1
        assert result['slots'][0]['notes'] == 'TZ test slot'


@pytest.mark.asyncio
async def test_only_includes_remaining_greater_than_zero(db_setup):
    """Test HAVING clause ensures remaining capacity > 0"""
    pool = db_setup
    tenant_id = 'test-next-avail'
    
    async with pool.acquire() as conn:
        # Create three slots with different booking levels
        slot_ids = []
        for i, (capacity, notes) in enumerate([(50, 'Full slot'), (50, 'Partial slot'), (50, 'Empty slot')]):
            slot_result = await conn.fetchrow("""
                INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, $6)
                RETURNING id
            """, tenant_id, date(2025, 8, 20), time(9 + i, 0), time(10 + i, 0), capacity, notes)
            slot_ids.append(slot_result['id'])
        
        # Full slot: exactly at capacity
        await conn.execute("""
            INSERT INTO bookings (id, tenant_id, slot_id, grower_id, quantity, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'grower-1', $3, 'confirmed', NOW())
        """, tenant_id, slot_ids[0], 50)
        
        # Partial slot: 20 remaining
        await conn.execute("""
            INSERT INTO bookings (id, tenant_id, slot_id, grower_id, quantity, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'grower-1', $3, 'confirmed', NOW())
        """, tenant_id, slot_ids[1], 30)
        
        # Empty slot: no bookings (50 remaining)
    
    result = await find_next_available_slots(
        tenant_id=tenant_id,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    # Should only return slots with remaining > 0
    assert len(result['slots']) == 2
    assert result['total'] == 2
    
    notes = [slot['notes'] for slot in result['slots']]
    remaining = [slot['remaining'] for slot in result['slots']]
    
    assert 'Partial slot' in notes
    assert 'Empty slot' in notes
    assert 'Full slot' not in notes
    assert 20 in remaining
    assert 50 in remaining


@pytest.mark.asyncio
async def test_tenant_isolation(db_setup):
    """Test results are isolated by tenant_id"""
    pool = db_setup
    tenant1 = 'test-next-avail'
    tenant2 = 'other-tenant'
    
    async with pool.acquire() as conn:
        # Create slots for both tenants
        await conn.execute("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Tenant1 slot')
        """, tenant1, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
        
        await conn.execute("""
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'tons', false, 'Tenant2 slot')
        """, tenant2, date(2025, 8, 20), time(9, 0), time(10, 0), 50)
    
    # Query for tenant1 should only get tenant1 slots
    result = await find_next_available_slots(
        tenant_id=tenant1,
        from_datetime='2025-08-15T08:00:00+02:00',
        db_pool=pool,
        limit=10
    )
    
    assert len(result['slots']) == 1
    assert result['total'] == 1
    assert result['slots'][0]['notes'] == 'Tenant1 slot'
    
    # Clean up tenant2 data
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM slots WHERE tenant_id = $1", tenant2)