"""
Slots router - handles slot management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from datetime import datetime, date, time, timedelta
from typing import List, Optional
from decimal import Decimal
import uuid

from ..db import execute_query, execute_one, execute_transaction
from ..security import get_current_user, require_role
from ..schemas import SlotResponse, SlotUpdate, BulkSlotCreate, SlotsRangeRequest, ApplyTemplateRequest, ApplyTemplateResult

router = APIRouter()

@router.get("", response_model=List[SlotResponse])
async def get_slots(
    date_filter: Optional[str] = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user)
):
    """Get slots for a specific date with usage information"""
    tenant_id = current_user["tenant_id"]
    
    if date_filter:
        query = """
            SELECT s.id, s.tenant_id, s.date, s.start_time, s.end_time,
                   s.capacity, s.resource_unit, s.blackout, s.notes,
                   COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) as booked_quantity
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id AND b.status = 'confirmed'
            WHERE s.tenant_id = $1 AND s.date = $2
            GROUP BY s.id, s.tenant_id, s.date, s.start_time, s.end_time,
                     s.capacity, s.resource_unit, s.blackout, s.notes
            ORDER BY s.start_time
        """
        slots = await execute_query(query, uuid.UUID(tenant_id), date_filter)
    else:
        query = """
            SELECT s.id, s.tenant_id, s.date, s.start_time, s.end_time,
                   s.capacity, s.resource_unit, s.blackout, s.notes,
                   COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) as booked_quantity
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id AND b.status = 'confirmed'
            WHERE s.tenant_id = $1 AND s.date >= CURRENT_DATE
            GROUP BY s.id, s.tenant_id, s.date, s.start_time, s.end_time,
                     s.capacity, s.resource_unit, s.blackout, s.notes
            ORDER BY s.date, s.start_time
        """
        slots = await execute_query(query, uuid.UUID(tenant_id))
    
    result = []
    for slot in slots:
        booked = float(slot['booked_quantity']) if slot['booked_quantity'] else 0
        capacity = float(slot['capacity'])
        
        result.append(SlotResponse(
            id=str(slot['id']),
            tenant_id=str(slot['tenant_id']),
            date=slot['date'],
            start_time=slot['start_time'],
            end_time=slot['end_time'],
            capacity=slot['capacity'],
            resource_unit=slot['resource_unit'],
            blackout=slot['blackout'],
            notes=slot['notes'],
            usage={
                "capacity": capacity,
                "booked": booked,
                "remaining": capacity - booked
            }
        ))
    
    return result

@router.post("/bulk")
async def bulk_create_slots(
    bulk_request: BulkSlotCreate,
    current_user: dict = Depends(require_role("admin"))
):
    """Create multiple slots for a date range"""
    tenant_id = current_user["tenant_id"]
    
    slots_created = 0
    current_date = bulk_request.start_date
    
    queries = []
    
    while current_date <= bulk_request.end_date:
        # Generate time slots for this date
        current_time = datetime.combine(current_date, bulk_request.start_time)
        end_datetime = datetime.combine(current_date, bulk_request.end_time)
        
        while current_time + timedelta(hours=bulk_request.slot_duration) <= end_datetime:
            slot_end_time = current_time + timedelta(hours=bulk_request.slot_duration)
            
            query = """
                INSERT INTO slots (tenant_id, date, start_time, end_time, capacity, notes, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (tenant_id, date, start_time) DO NOTHING
            """
            args = (
                uuid.UUID(tenant_id),
                current_date,
                current_time.time(),
                slot_end_time.time(),
                bulk_request.capacity,
                bulk_request.notes,
                uuid.UUID(current_user["sub"])
            )
            queries.append((query, args))
            
            current_time = slot_end_time
            slots_created += 1
        
        current_date += timedelta(days=1)
    
    # Execute all queries in a transaction
    await execute_transaction(queries)
    
    return {"count": slots_created, "message": f"Created {slots_created} slots"}

@router.patch("/{slot_id}", response_model=SlotResponse)
async def update_slot(
    slot_id: str,
    updates: SlotUpdate,
    current_user: dict = Depends(require_role("admin"))
):
    """Update a specific slot"""
    tenant_id = current_user["tenant_id"]
    
    # Build dynamic update query
    update_fields = []
    values = []
    param_count = 1
    
    if updates.capacity is not None:
        update_fields.append(f"capacity = ${param_count}")
        values.append(updates.capacity)
        param_count += 1
    
    if updates.blackout is not None:
        update_fields.append(f"blackout = ${param_count}")
        values.append(updates.blackout)
        param_count += 1
    
    if updates.notes is not None:
        update_fields.append(f"notes = ${param_count}")
        values.append(updates.notes)
        param_count += 1
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.extend([uuid.UUID(slot_id), uuid.UUID(tenant_id)])
    
    query = f"""
        UPDATE slots 
        SET {', '.join(update_fields)}
        WHERE id = ${param_count} AND tenant_id = ${param_count + 1}
        RETURNING id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes
    """
    
    updated_slot = await execute_one(query, *values)
    
    if not updated_slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    return SlotResponse(
        id=str(updated_slot['id']),
        tenant_id=str(updated_slot['tenant_id']),
        date=updated_slot['date'],
        start_time=updated_slot['start_time'],
        end_time=updated_slot['end_time'],
        capacity=updated_slot['capacity'],
        resource_unit=updated_slot['resource_unit'],
        blackout=updated_slot['blackout'],
        notes=updated_slot['notes']
    )

@router.get("/range", response_model=List[SlotResponse])
async def get_slots_range(
    start_date: str = Query(description="Start date YYYY-MM-DD"),
    end_date: str = Query(description="End date YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user)
):
    """Get slots for a date range (max 14 days) with usage information"""
    try:
        # Validate dates
        start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        if start_date_obj > end_date_obj:
            raise HTTPException(status_code=400, detail="start_date must be <= end_date")
        
        date_diff = (end_date_obj - start_date_obj).days
        if date_diff > 14:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 14 days")
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    tenant_id = current_user["tenant_id"]
    
    # Query slots for date range with usage information and restrictions
    query = """
        SELECT s.id, s.tenant_id, s.date, s.start_time, s.end_time,
               s.capacity, s.resource_unit, s.blackout, s.notes,
               COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) as booked_quantity,
               COALESCE(
                   JSON_AGG(
                       DISTINCT JSONB_BUILD_OBJECT(
                           'grower_id', sr.allowed_grower_id,
                           'cultivar_id', sr.allowed_cultivar_id
                       )
                   ) FILTER (WHERE sr.id IS NOT NULL), 
                   '[]'::json
               ) as restrictions_data
        FROM slots s
        LEFT JOIN bookings b ON s.id = b.slot_id AND b.status = 'confirmed'
        LEFT JOIN slot_restrictions sr ON s.id = sr.slot_id
        WHERE s.tenant_id = $1 AND s.date BETWEEN $2 AND $3
        GROUP BY s.id, s.tenant_id, s.date, s.start_time, s.end_time,
                 s.capacity, s.resource_unit, s.blackout, s.notes
        ORDER BY s.date, s.start_time
    """
    
    slots = await execute_query(query, uuid.UUID(tenant_id), start_date_obj, end_date_obj)
    
    result = []
    for slot in slots:
        booked = float(slot['booked_quantity']) if slot['booked_quantity'] else 0
        capacity = float(slot['capacity'])
        
        # Process restrictions data
        restrictions = {"growers": [], "cultivars": []}
        if slot['restrictions_data'] and slot['restrictions_data'] != [{}]:
            for restriction in slot['restrictions_data']:
                if restriction.get('grower_id'):
                    restrictions["growers"].append(str(restriction['grower_id']))
                if restriction.get('cultivar_id'):
                    restrictions["cultivars"].append(str(restriction['cultivar_id']))
        
        result.append(SlotResponse(
            id=str(slot['id']),
            tenant_id=str(slot['tenant_id']),
            date=slot['date'],
            start_time=slot['start_time'],
            end_time=slot['end_time'],
            capacity=slot['capacity'],
            resource_unit=slot['resource_unit'],
            blackout=slot['blackout'],
            notes=slot['notes'],
            restrictions=restrictions if restrictions["growers"] or restrictions["cultivars"] else None,
            usage={
                "capacity": capacity,
                "booked": booked,
                "remaining": capacity - booked
            }
        ))
    
    return result

@router.get("/{slot_id}/usage")
async def get_slot_usage(
    slot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get usage information for a specific slot"""
    tenant_id = current_user["tenant_id"]
    
    query = """
        SELECT s.capacity,
               COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) as booked
        FROM slots s
        LEFT JOIN bookings b ON s.id = b.slot_id
        WHERE s.id = $1 AND s.tenant_id = $2
        GROUP BY s.capacity
    """
    
    result = await execute_one(query, uuid.UUID(slot_id), uuid.UUID(tenant_id))
    
    if not result:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    capacity = float(result['capacity'])
    booked = float(result['booked']) if result['booked'] else 0
    
    return {
        "capacity": capacity,
        "booked": booked,
        "remaining": capacity - booked
    }

@router.post("/apply-template", response_model=ApplyTemplateResult)
def apply_template_stub(body: ApplyTemplateRequest):
    # scaffold only: no generation, no writes
    return ApplyTemplateResult()