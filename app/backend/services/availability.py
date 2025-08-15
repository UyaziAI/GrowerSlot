"""
Next Available Slots Service

Deterministic logic for finding eligible slots after a given datetime,
respecting capacity, restrictions, and advance notice.
"""
import asyncpg
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import pytz


class AvailableSlot(BaseModel):
    slot_id: str
    date: str  # ISO date format
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format
    remaining: int
    notes: Optional[str] = None


async def find_next_available_slots(
    tenant_id: str,
    from_datetime: str,
    db_pool: asyncpg.Pool,
    grower_id: Optional[str] = None,
    cultivar_id: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Find next available slots after from_datetime for the tenant.
    
    Args:
        tenant_id: Tenant identifier
        from_datetime: ISO datetime string with timezone (e.g., '2025-08-15T08:00:00+02:00')
        grower_id: Optional grower filter for restrictions
        cultivar_id: Optional cultivar filter for restrictions  
        limit: Maximum number of slots to return
        db_pool: Database connection pool
        
    Returns:
        Dictionary with 'slots' list and 'total' count
    """

    
    # Parse the ISO datetime string
    try:
        from_dt = datetime.fromisoformat(from_datetime.replace('Z', '+00:00'))
        # Convert to Africa/Johannesburg timezone for consistent filtering
        johannesburg_tz = pytz.timezone('Africa/Johannesburg')
        if from_dt.tzinfo is None:
            from_dt = johannesburg_tz.localize(from_dt)
        else:
            from_dt = from_dt.astimezone(johannesburg_tz)
    except ValueError as e:
        raise ValueError(f"Invalid datetime format: {from_datetime}. Use ISO format like '2025-08-15T08:00:00+02:00'")
    
    async with db_pool.acquire() as conn:
        # Base query to find future slots with capacity calculations
        base_query = """
            SELECT 
                s.id as slot_id,
                s.date,
                s.start_time,
                s.end_time,
                s.capacity,
                s.notes,
                COALESCE(SUM(b.quantity), 0) as booked_quantity
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id 
            WHERE s.tenant_id = $1
                AND s.blackout = false
                AND (s.date > $2 OR (s.date = $2 AND s.start_time >= $3))
        """
        
        params = [tenant_id, from_dt.date(), from_dt.time()]
        param_count = 3
        
        # Apply grower restrictions if provided
        if grower_id:
            # Check if there are any restrictions that would block this grower
            restriction_query = """
                AND NOT EXISTS (
                    SELECT 1 FROM slot_restrictions sr 
                    WHERE sr.slot_id = s.id 
                    AND sr.restriction_type = 'grower_allowlist'
                    AND $%s != ANY(sr.allowed_values::text[])
                )
            """
            base_query += restriction_query % (param_count + 1)
            params.append(grower_id)
            param_count += 1
        
        # Apply cultivar restrictions if provided
        if cultivar_id:
            # Check if there are any restrictions that would block this cultivar
            restriction_query = """
                AND NOT EXISTS (
                    SELECT 1 FROM slot_restrictions sr 
                    WHERE sr.slot_id = s.id 
                    AND sr.restriction_type = 'cultivar_allowlist'
                    AND $%s != ANY(sr.allowed_values::text[])
                )
            """
            base_query += restriction_query % (param_count + 1)
            params.append(cultivar_id)
            param_count += 1
        
        # TODO: Add advance notice enforcement when per-slot advance_notice_min is implemented
        # For now, treating advance_notice_min as 0 as specified
        
        # Complete the query with grouping, having, and ordering
        final_query = base_query + """
            GROUP BY s.id, s.date, s.start_time, s.end_time, s.capacity, s.notes
            HAVING s.capacity - COALESCE(SUM(b.quantity), 0) > 0
            ORDER BY s.date, s.start_time
            LIMIT $%s
        """ % (param_count + 1)
        
        params.append(limit)
        
        # Execute the query
        rows = await conn.fetch(final_query, *params)
        
        # Convert results to response format
        slots = []
        for row in rows:
            remaining = row['capacity'] - row['booked_quantity']
            slot = AvailableSlot(
                slot_id=str(row['slot_id']),
                date=row['date'].isoformat(),
                start_time=row['start_time'].strftime('%H:%M'),
                end_time=row['end_time'].strftime('%H:%M'),
                remaining=remaining,
                notes=row['notes']
            )
            slots.append(slot.dict())
        
        return {
            'slots': slots,
            'total': len(slots)
        }