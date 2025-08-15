"""
Tests for Apply Template Publish Transaction and Idempotency
"""
import pytest
import asyncpg
from datetime import date, time
from app.backend.services.templates import publish_plan
from app.backend.db import init_db, get_db_pool


@pytest.fixture
async def db_setup():
    """Setup test database connection"""
    await init_db()
    pool = get_db_pool()
    async with pool.acquire() as conn:
        # Clean up existing test data
        await conn.execute("DELETE FROM slots WHERE tenant_id = 'test-tenant-publish'")
        yield pool
        # Clean up after test
        await conn.execute("DELETE FROM slots WHERE tenant_id = 'test-tenant-publish'")


@pytest.mark.asyncio
async def test_first_publish_creates_slots(db_setup):
    """Test first publish creates new slots"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    desired_slots = [
        {
            'date': date(2025, 8, 20),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 50,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Morning slot'
        },
        {
            'date': date(2025, 8, 20),
            'start_time': time(11, 0),
            'end_time': time(12, 0),
            'capacity': 40,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Midday slot'
        }
    ]
    
    # First publish should create all slots
    result = await publish_plan(tenant_id, desired_slots, pool)
    
    assert result['created'] == 2
    assert result['updated'] == 0
    assert result['skipped'] == 0
    
    # Verify slots were actually created in database
    async with pool.acquire() as conn:
        slots = await conn.fetch("""
            SELECT date, start_time, end_time, capacity, notes
            FROM slots 
            WHERE tenant_id = $1 
            ORDER BY start_time
        """, tenant_id)
        
        assert len(slots) == 2
        assert slots[0]['capacity'] == 50
        assert slots[0]['notes'] == 'Morning slot'
        assert slots[1]['capacity'] == 40
        assert slots[1]['notes'] == 'Midday slot'


@pytest.mark.asyncio
async def test_second_identical_publish_is_idempotent(db_setup):
    """Test second identical publish creates=0, updated=0, skipped=0 due to idempotency"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    desired_slots = [
        {
            'date': date(2025, 8, 21),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 50,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Morning slot'
        }
    ]
    
    # First publish
    result1 = await publish_plan(tenant_id, desired_slots, pool)
    assert result1['created'] == 1
    assert result1['updated'] == 0
    
    # Second identical publish - should be idempotent
    result2 = await publish_plan(tenant_id, desired_slots, pool)
    assert result2['created'] == 0
    assert result2['updated'] == 0  # No actual changes, so no update needed
    assert result2['skipped'] == 0
    
    # Total slots should still be 1
    async with pool.acquire() as conn:
        slot_count = await conn.fetchval("""
            SELECT COUNT(*) FROM slots WHERE tenant_id = $1
        """, tenant_id)
        assert slot_count == 1


@pytest.mark.asyncio
async def test_publish_with_changes_updates_existing(db_setup):
    """Test publish with different values updates existing slots"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    # Initial slots
    initial_slots = [
        {
            'date': date(2025, 8, 22),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 50,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Original notes'
        }
    ]
    
    # Publish initial slots
    result1 = await publish_plan(tenant_id, initial_slots, pool)
    assert result1['created'] == 1
    
    # Modified slots with different capacity and notes
    modified_slots = [
        {
            'date': date(2025, 8, 22),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 75,  # Changed capacity
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Updated notes'  # Changed notes
        }
    ]
    
    # Publish modified slots
    result2 = await publish_plan(tenant_id, modified_slots, pool)
    assert result2['created'] == 0
    assert result2['updated'] == 1
    assert result2['skipped'] == 0
    
    # Verify changes were applied
    async with pool.acquire() as conn:
        slot = await conn.fetchrow("""
            SELECT capacity, notes FROM slots 
            WHERE tenant_id = $1 AND date = $2 AND start_time = $3
        """, tenant_id, date(2025, 8, 22), time(9, 0))
        
        assert slot['capacity'] == 75
        assert slot['notes'] == 'Updated notes'


@pytest.mark.asyncio
async def test_transaction_rollback_on_error(db_setup):
    """Test transaction rolls back completely on error - no partial writes"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    # Create one valid slot first
    valid_slot = {
        'date': date(2025, 8, 23),
        'start_time': time(9, 0),
        'end_time': time(10, 0),
        'capacity': 50,
        'resource_unit': 'tons',
        'blackout': False,
        'notes': 'Valid slot'
    }
    
    await publish_plan(tenant_id, [valid_slot], pool)
    
    # Verify initial state
    async with pool.acquire() as conn:
        initial_count = await conn.fetchval("""
            SELECT COUNT(*) FROM slots WHERE tenant_id = $1
        """, tenant_id)
        assert initial_count == 1
    
    # Now try to publish with an invalid slot that will cause error
    slots_with_error = [
        {
            'date': date(2025, 8, 23),
            'start_time': time(11, 0),
            'end_time': time(12, 0),
            'capacity': 60,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Should be created'
        },
        {
            'date': None,  # Invalid date to force error
            'start_time': time(13, 0),
            'end_time': time(14, 0),
            'capacity': 70,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Should cause error'
        }
    ]
    
    # Publish should fail due to invalid date
    with pytest.raises(Exception):  # asyncpg will raise an exception for NULL date
        await publish_plan(tenant_id, slots_with_error, pool)
    
    # Verify no partial writes occurred - should still have only 1 slot
    async with pool.acquire() as conn:
        final_count = await conn.fetchval("""
            SELECT COUNT(*) FROM slots WHERE tenant_id = $1
        """, tenant_id)
        assert final_count == 1  # No new slots were created due to rollback


@pytest.mark.asyncio 
async def test_mixed_create_update_operations(db_setup):
    """Test publish with mix of create and update operations"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    # Create some initial slots
    initial_slots = [
        {
            'date': date(2025, 8, 24),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 50,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Existing slot'
        }
    ]
    
    await publish_plan(tenant_id, initial_slots, pool)
    
    # Mix of update existing + create new
    mixed_slots = [
        {
            'date': date(2025, 8, 24),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': 75,  # Update existing
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Updated existing slot'
        },
        {
            'date': date(2025, 8, 24),
            'start_time': time(11, 0),
            'end_time': time(12, 0),
            'capacity': 40,  # Create new
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'New slot'
        }
    ]
    
    result = await publish_plan(tenant_id, mixed_slots, pool)
    
    assert result['created'] == 1  # New 11:00 slot
    assert result['updated'] == 1  # Updated 9:00 slot
    assert result['skipped'] == 0
    
    # Verify final state
    async with pool.acquire() as conn:
        slots = await conn.fetch("""
            SELECT start_time, capacity, notes FROM slots 
            WHERE tenant_id = $1 AND date = $2
            ORDER BY start_time
        """, tenant_id, date(2025, 8, 24))
        
        assert len(slots) == 2
        assert slots[0]['capacity'] == 75  # Updated
        assert slots[0]['notes'] == 'Updated existing slot'
        assert slots[1]['capacity'] == 40   # Created
        assert slots[1]['notes'] == 'New slot'


@pytest.mark.asyncio
async def test_empty_slots_list_returns_zero_counts(db_setup):
    """Test publish with empty list returns all zero counts"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    result = await publish_plan(tenant_id, [], pool)
    
    assert result['created'] == 0
    assert result['updated'] == 0
    assert result['skipped'] == 0


@pytest.mark.asyncio
async def test_idempotency_assertion_with_large_batch(db_setup):
    """Test idempotency with larger batch of slots"""
    tenant_id = 'test-tenant-publish'
    pool = db_setup
    
    # Generate 10 slots for the same day
    large_batch = []
    for hour in range(8, 18):  # 8 AM to 5 PM
        large_batch.append({
            'date': date(2025, 8, 25),
            'start_time': time(hour, 0),
            'end_time': time(hour + 1, 0),
            'capacity': 50 + hour,  # Varying capacity
            'resource_unit': 'tons',
            'blackout': False,
            'notes': f'Slot {hour}:00'
        })
    
    # First publish - should create all 10
    result1 = await publish_plan(tenant_id, large_batch, pool)
    assert result1['created'] == 10
    assert result1['updated'] == 0
    assert result1['skipped'] == 0
    
    # Second identical publish - should be completely idempotent
    result2 = await publish_plan(tenant_id, large_batch, pool)
    assert result2['created'] == 0
    assert result2['updated'] == 0  # No changes needed
    assert result2['skipped'] == 0
    
    # Third publish with some changes - should update only changed ones
    large_batch[0]['capacity'] = 100  # Change first slot
    large_batch[5]['notes'] = 'Modified slot'  # Change sixth slot
    
    result3 = await publish_plan(tenant_id, large_batch, pool)
    assert result3['created'] == 0
    assert result3['updated'] == 2  # Only 2 slots changed
    assert result3['skipped'] == 0
    
    # Verify total count is still 10
    async with pool.acquire() as conn:
        final_count = await conn.fetchval("""
            SELECT COUNT(*) FROM slots WHERE tenant_id = $1
        """, tenant_id)
        assert final_count == 10