"""
Template Services - Apply Template Preview and Slot Planning
"""
from datetime import date, datetime, timedelta, time
from typing import Dict, List, Any
import asyncpg
from zoneinfo import ZoneInfo


async def plan_slots(
    tenant_id: str, 
    template: dict, 
    start_date: date, 
    end_date: date, 
    tz: str = 'Africa/Johannesburg'
) -> List[Dict]:
    """
    Generate desired slots for each day using template configuration.
    
    Args:
        tenant_id: Tenant identifier
        template: Template configuration with weekdays, slot_length_min, exceptions
        start_date: Start date for slot generation
        end_date: End date for slot generation
        tz: Timezone for slot generation
        
    Returns:
        List of desired slot dictionaries with date, start_time, end_time, capacity, etc.
    """
    desired_slots = []
    
    # Parse template configuration
    weekdays_config = template.get('weekdays', {})
    slot_length_min = template.get('slot_length_min', 30)
    exceptions = template.get('exceptions', [])
    default_capacity = template.get('default_capacity', 10)
    default_resource_unit = template.get('default_resource_unit', 'tons')
    default_notes = template.get('default_notes', '')
    
    # Create timezone object
    timezone = ZoneInfo(tz)
    
    # Generate slots for each day in range
    current_date = start_date
    while current_date <= end_date:
        # Check for blackout exceptions first
        is_blackout_day = False
        day_overrides = {}
        
        for exception in exceptions:
            if exception.get('date') == current_date.isoformat():
                if exception.get('type') == 'blackout':
                    is_blackout_day = True
                    break
                elif exception.get('type') == 'override':
                    day_overrides = exception
                    break
        
        # Skip blackout days
        if is_blackout_day:
            current_date += timedelta(days=1)
            continue
        
        # Get day of week (Monday=0, Sunday=6)
        weekday_name = current_date.strftime('%a').lower()  # mon, tue, wed, etc.
        
        # Use override config if available, otherwise use weekday config
        if day_overrides:
            day_config = day_overrides
        else:
            day_config = weekdays_config.get(weekday_name, {})
        
        # Skip if no configuration for this day
        if not day_config or not day_config.get('enabled', True):
            current_date += timedelta(days=1)
            continue
        
        # Generate time slots for the day
        start_time_str = day_config.get('start_time', '08:00')
        end_time_str = day_config.get('end_time', '17:00')
        capacity = day_config.get('capacity', default_capacity)
        resource_unit = day_config.get('resource_unit', default_resource_unit)
        notes = day_config.get('notes', default_notes)
        
        # Parse start and end times
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
        end_time = datetime.strptime(end_time_str, '%H:%M').time()
        
        # Generate slots based on slot_length_min
        current_time = datetime.combine(current_date, start_time)
        end_datetime = datetime.combine(current_date, end_time)
        
        while current_time < end_datetime:
            slot_end_time = current_time + timedelta(minutes=slot_length_min)
            
            # Don't exceed day end time
            if slot_end_time.time() > end_time:
                break
            
            desired_slots.append({
                'date': current_date.isoformat(),
                'start_time': current_time.time().strftime('%H:%M'),
                'end_time': slot_end_time.time().strftime('%H:%M'),
                'capacity': capacity,
                'resource_unit': resource_unit,
                'notes': notes,
                'blackout': False
            })
            
            current_time = slot_end_time
        
        current_date += timedelta(days=1)
    
    return desired_slots


async def diff_against_db(
    tenant_id: str, 
    desired: List[Dict],
    db_pool: asyncpg.Pool
) -> Dict[str, List[Dict]]:
    """
    Compare desired slots against existing database slots and classify changes.
    
    Args:
        tenant_id: Tenant identifier
        desired: List of desired slot configurations
        db_pool: Database connection pool
        
    Returns:
        Dictionary with 'create', 'update', 'skip' lists
    """
    if not desired:
        return {'create': [], 'update': [], 'skip': []}
    
    # Extract date range from desired slots
    dates = [slot['date'] for slot in desired]
    start_date = min(dates)
    end_date = max(dates)
    
    # Fetch existing slots in date range
    async with db_pool.acquire() as conn:
        existing_rows = await conn.fetch("""
            SELECT id, date, start_time, end_time, capacity, resource_unit, blackout, notes
            FROM slots
            WHERE tenant_id = $1 AND date BETWEEN $2 AND $3
        """, tenant_id, start_date, end_date)
    
    # Convert existing slots to lookup dictionary
    existing_slots = {}
    for row in existing_rows:
        key = (
            row['date'].isoformat(),
            row['start_time'].strftime('%H:%M'),
            row['end_time'].strftime('%H:%M')
        )
        existing_slots[key] = {
            'id': row['id'],
            'date': row['date'].isoformat(),
            'start_time': row['start_time'].strftime('%H:%M'),
            'end_time': row['end_time'].strftime('%H:%M'),
            'capacity': row['capacity'],
            'resource_unit': row['resource_unit'],
            'blackout': row['blackout'],
            'notes': row['notes'] or ''
        }
    
    create_list = []
    update_list = []
    skip_list = []
    
    # Classify each desired slot
    for desired_slot in desired:
        key = (
            desired_slot['date'],
            desired_slot['start_time'],
            desired_slot['end_time']
        )
        
        if key in existing_slots:
            existing_slot = existing_slots[key]
            
            # Check if any fields differ
            needs_update = (
                existing_slot['capacity'] != desired_slot['capacity'] or
                existing_slot['resource_unit'] != desired_slot['resource_unit'] or
                existing_slot['blackout'] != desired_slot['blackout'] or
                existing_slot['notes'] != desired_slot['notes']
            )
            
            if needs_update:
                update_item = desired_slot.copy()
                update_item['id'] = existing_slot['id']
                update_list.append(update_item)
            else:
                skip_list.append(desired_slot)
        else:
            create_list.append(desired_slot)
    
    return {
        'create': create_list,
        'update': update_list,
        'skip': skip_list
    }


async def publish_plan(
    tenant_id: str,
    plan: List[Dict],
    db_pool: asyncpg.Pool
) -> Dict[str, int]:
    """
    Persist plan idempotently in a single transaction using update-then-insert pattern.
    
    Args:
        tenant_id: Tenant identifier
        plan: List of planned slot dictionaries
        db_pool: Database connection pool
        
    Returns:
        Dictionary with created, updated, skipped counts
    """
    if not plan:
        return {'created': 0, 'updated': 0, 'skipped': 0}
    
    created_count = 0
    updated_count = 0
    
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            for slot in plan:
                # First attempt UPDATE
                update_query = """
                    UPDATE slots
                    SET capacity = $5, resource_unit = $6, blackout = $7, notes = $8
                    WHERE tenant_id = $1 AND date = $2 AND start_time = $3 AND end_time = $4
                """
                
                update_result = await conn.execute(
                    update_query,
                    tenant_id,
                    slot['date'],
                    slot['start_time'],
                    slot['end_time'],
                    slot['capacity'],
                    slot['resource_unit'],
                    slot['blackout'],
                    slot['notes']
                )
                
                # Extract row count from result string like "UPDATE 1" or "UPDATE 0"
                rows_updated = int(update_result.split()[-1])
                
                if rows_updated == 0:
                    # No existing row found, perform INSERT
                    insert_query = """
                        INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
                        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
                    """
                    
                    await conn.execute(
                        insert_query,
                        tenant_id,
                        slot['date'],
                        slot['start_time'],
                        slot['end_time'],
                        slot['capacity'],
                        slot['resource_unit'],
                        slot['blackout'],
                        slot['notes']
                    )
                    created_count += 1
                else:
                    updated_count += 1
    
    # Calculate skipped count
    total_planned = len(plan)
    skipped_count = total_planned - (created_count + updated_count)
    
    return {
        'created': created_count,
        'updated': updated_count,
        'skipped': skipped_count
    }