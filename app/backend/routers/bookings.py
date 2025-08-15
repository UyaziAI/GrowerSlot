"""
Bookings router - handles booking creation and management with transactional safety
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
from typing import List, Optional
import uuid
from decimal import Decimal

from ..db import execute_query, execute_one, execute_transaction
from ..security import get_current_user
from ..schemas import BookingCreate, BookingResponse, DomainEvent

router = APIRouter()

class BookingPatch(BaseModel):
    slot_id: Optional[str] = None
    quantity: Optional[int] = None
    cultivar_id: Optional[str] = None

async def emit_domain_event(event_type: str, aggregate_id: str, payload: dict, tenant_id: str):
    """Emit a domain event and add to outbox for webhook delivery"""
    # Insert domain event
    event_query = """
        INSERT INTO domain_events (event_type, aggregate_id, payload, tenant_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    """
    
    event = await execute_one(
        event_query,
        event_type,
        uuid.UUID(aggregate_id),
        payload,
        uuid.UUID(tenant_id)
    )
    
    # Add to outbox for webhook delivery (if webhook_url configured)
    # For now, we'll just log the event - webhook delivery can be implemented later
    return event

@router.post("", response_model=BookingResponse)
async def create_booking(
    booking_request: BookingCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new booking with transactional capacity checking"""
    tenant_id = current_user["tenant_id"]
    user_role = current_user["role"]
    user_grower_id = current_user.get("grower_id")
    
    # For grower users, ensure they can only book for themselves
    if user_role == "grower" and user_grower_id != booking_request.grower_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Growers can only book for themselves"
        )
    
    # Atomic booking with capacity check using SELECT FOR UPDATE
    try:
        # Start transaction and lock the slot
        capacity_check_query = """
            SELECT s.capacity,
                   COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) AS booked,
                   s.blackout, s.date, s.start_time, s.end_time
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id
            WHERE s.id = $1 AND s.tenant_id = $2
            GROUP BY s.id, s.capacity, s.blackout, s.date, s.start_time, s.end_time
            FOR UPDATE
        """
        
        create_booking_query = """
            INSERT INTO bookings (slot_id, tenant_id, grower_id, cultivar_id, quantity)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, slot_id, tenant_id, grower_id, cultivar_id, quantity, status, created_at
        """
        
        # Execute in transaction
        queries = [
            (capacity_check_query, [uuid.UUID(booking_request.slot_id), uuid.UUID(tenant_id)]),
        ]
        
        results = await execute_transaction(queries)
        slot_info = results[0][0] if results[0] else None
        
        if not slot_info:
            raise HTTPException(status_code=404, detail="Slot not found")
        
        if slot_info['blackout']:
            raise HTTPException(status_code=403, detail="Slot is blacked out")
        
        capacity = float(slot_info['capacity'])
        booked = float(slot_info['booked']) if slot_info['booked'] else 0
        requested_quantity = float(booking_request.quantity)
        
        if (booked + requested_quantity) > capacity:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient capacity. Available: {capacity - booked}, Requested: {requested_quantity}"
            )
        
        # Create the booking
        booking_queries = [
            (create_booking_query, [
                uuid.UUID(booking_request.slot_id),
                uuid.UUID(tenant_id),
                uuid.UUID(booking_request.grower_id),
                uuid.UUID(booking_request.cultivar_id) if booking_request.cultivar_id else None,
                booking_request.quantity
            ])
        ]
        
        booking_results = await execute_transaction(booking_queries)
        new_booking = booking_results[0][0]
        
        # Emit domain event
        event_payload = {
            "booking_id": str(new_booking['id']),
            "slot_id": str(new_booking['slot_id']),
            "grower_id": str(new_booking['grower_id']),
            "quantity": float(new_booking['quantity']),
            "slot_date": slot_info['date'].isoformat(),
            "slot_time": slot_info['start_time'].strftime('%H:%M')
        }
        
        await emit_domain_event(
            "BOOKING_CREATED",
            str(new_booking['id']),
            event_payload,
            tenant_id
        )
        
        # Get additional details for response
        details_query = """
            SELECT g.name as grower_name, c.name as cultivar_name
            FROM growers g
            LEFT JOIN cultivars c ON c.id = $2
            WHERE g.id = $1
        """
        details = await execute_one(
            details_query,
            new_booking['grower_id'],
            new_booking['cultivar_id']
        )
        
        return BookingResponse(
            id=str(new_booking['id']),
            slot_id=str(new_booking['slot_id']),
            tenant_id=str(new_booking['tenant_id']),
            grower_id=str(new_booking['grower_id']),
            cultivar_id=str(new_booking['cultivar_id']) if new_booking['cultivar_id'] else None,
            quantity=new_booking['quantity'],
            status=new_booking['status'],
            created_at=new_booking['created_at'],
            grower_name=details['grower_name'] if details else None,
            cultivar_name=details['cultivar_name'] if details else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")

@router.get("", response_model=List[BookingResponse])
async def get_bookings(
    date_filter: Optional[str] = Query(None, alias="date"),
    grower_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get bookings with optional filters"""
    tenant_id = current_user["tenant_id"]
    user_role = current_user["role"]
    user_grower_id = current_user.get("grower_id")
    
    base_query = """
        SELECT b.id, b.slot_id, b.tenant_id, b.grower_id, b.cultivar_id,
               b.quantity, b.status, b.created_at,
               g.name as grower_name, c.name as cultivar_name,
               s.date, s.start_time, s.end_time
        FROM bookings b
        JOIN growers g ON b.grower_id = g.id
        JOIN slots s ON b.slot_id = s.id
        LEFT JOIN cultivars c ON b.cultivar_id = c.id
        WHERE b.tenant_id = $1
    """
    
    params = [uuid.UUID(tenant_id)]
    param_count = 2
    
    # Growers can only see their own bookings
    if user_role == "grower" and user_grower_id:
        base_query += f" AND b.grower_id = ${param_count}"
        params.append(uuid.UUID(user_grower_id))
        param_count += 1
    elif grower_id:  # Admin filtering by grower
        base_query += f" AND b.grower_id = ${param_count}"
        params.append(uuid.UUID(grower_id))
        param_count += 1
    
    if date_filter:
        base_query += f" AND s.date = ${param_count}"
        params.append(date_filter)
        param_count += 1
    
    base_query += " ORDER BY s.date DESC, s.start_time DESC"
    
    bookings = await execute_query(base_query, *params)
    
    return [
        BookingResponse(
            id=str(booking['id']),
            slot_id=str(booking['slot_id']),
            tenant_id=str(booking['tenant_id']),
            grower_id=str(booking['grower_id']),
            cultivar_id=str(booking['cultivar_id']) if booking['cultivar_id'] else None,
            quantity=booking['quantity'],
            status=booking['status'],
            created_at=booking['created_at'],
            grower_name=booking['grower_name'],
            cultivar_name=booking['cultivar_name']
        )
        for booking in bookings
    ]

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a booking (soft delete - change status)"""
    tenant_id = current_user["tenant_id"]
    user_role = current_user["role"]
    user_grower_id = current_user.get("grower_id")
    
    # Check if booking exists and user has permission
    check_query = """
        SELECT b.id, b.grower_id, b.status
        FROM bookings b
        WHERE b.id = $1 AND b.tenant_id = $2
    """
    
    booking = await execute_one(check_query, uuid.UUID(booking_id), uuid.UUID(tenant_id))
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking['status'] == 'cancelled':
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
    
    # Growers can only cancel their own bookings
    if user_role == "grower" and user_grower_id != str(booking['grower_id']):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bookings"
        )
    
    # Cancel the booking
    cancel_query = """
        UPDATE bookings
        SET status = 'cancelled'
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
    """
    
    result = await execute_one(cancel_query, uuid.UUID(booking_id), uuid.UUID(tenant_id))
    
    if result:
        # Emit domain event
        await emit_domain_event(
            "BOOKING_CANCELLED",
            booking_id,
            {"booking_id": booking_id, "cancelled_by": current_user["sub"]},
            tenant_id
        )
        
        return {"message": "Booking cancelled successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to cancel booking")

@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    booking_update: BookingPatch,
    current_user: dict = Depends(get_current_user)
):
    """Update a booking with capacity and restriction checks"""
    tenant_id = current_user["tenant_id"]
    user_role = current_user["role"]
    user_grower_id = current_user.get("grower_id")
    
    try:
        # Start transaction and get current booking with slot info
        get_current_booking_query = """
            SELECT b.id, b.slot_id, b.grower_id, b.cultivar_id, b.quantity, b.status,
                   s.capacity, s.blackout, s.date, s.start_time, s.end_time,
                   COALESCE(SUM(CASE WHEN b2.status = 'confirmed' AND b2.id != b.id THEN b2.quantity ELSE 0 END), 0) as other_bookings
            FROM bookings b
            JOIN slots s ON b.slot_id = s.id
            LEFT JOIN bookings b2 ON s.id = b2.slot_id
            WHERE b.id = $1 AND b.tenant_id = $2
            GROUP BY b.id, b.slot_id, b.grower_id, b.cultivar_id, b.quantity, b.status,
                     s.capacity, s.blackout, s.date, s.start_time, s.end_time
            FOR UPDATE
        """
        
        # If moving to different slot, also lock the target slot
        target_slot_query = """
            SELECT s.id, s.capacity, s.blackout, s.date, s.start_time, s.end_time,
                   COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.quantity ELSE 0 END), 0) as current_bookings
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id
            WHERE s.id = $1 AND s.tenant_id = $2
            GROUP BY s.id, s.capacity, s.blackout, s.date, s.start_time, s.end_time
            FOR UPDATE
        """
        
        # Execute first query to get current booking
        queries = [
            (get_current_booking_query, [uuid.UUID(booking_id), uuid.UUID(tenant_id)])
        ]
        
        results = await execute_transaction(queries)
        current_booking = results[0][0] if results[0] else None
        
        if not current_booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Authorization: growers can only update their own bookings
        if user_role == "grower" and user_grower_id != str(current_booking['grower_id']):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own bookings"
            )
        
        if current_booking['status'] == 'cancelled':
            raise HTTPException(status_code=400, detail="Cannot update cancelled booking")
        
        # Prepare update values, keeping current values if not provided
        new_slot_id = booking_update.slot_id or str(current_booking['slot_id'])
        new_quantity = booking_update.quantity or current_booking['quantity']
        new_cultivar_id = booking_update.cultivar_id or current_booking['cultivar_id']
        
        target_slot_info = None
        is_moving_slots = new_slot_id != str(current_booking['slot_id'])
        
        # If moving to different slot, get target slot info with lock
        if is_moving_slots:
            target_queries = [
                (target_slot_query, [uuid.UUID(new_slot_id), uuid.UUID(tenant_id)])
            ]
            
            target_results = await execute_transaction(target_queries)
            target_slot_info = target_results[0][0] if target_results[0] else None
            
            if not target_slot_info:
                raise HTTPException(status_code=404, detail="Target slot not found")
            
            # Check for restrictions on target slot (403 error)
            if target_slot_info['blackout']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot move to blacked out slot"
                )
            
            # Check capacity constraints on target slot (409 error)
            target_capacity = float(target_slot_info['capacity'])
            target_current_bookings = float(target_slot_info['current_bookings'])
            requested_quantity = float(new_quantity)
            
            if (target_current_bookings + requested_quantity) > target_capacity:
                available = target_capacity - target_current_bookings
                raise HTTPException(
                    status_code=409,
                    detail=f"Target slot at capacity. Available: {available}, Requested: {requested_quantity}"
                )
        
        else:
            # Not moving slots, but check capacity if quantity changed
            if new_quantity != current_booking['quantity']:
                current_capacity = float(current_booking['capacity'])
                other_bookings = float(current_booking['other_bookings'])
                requested_quantity = float(new_quantity)
                
                if (other_bookings + requested_quantity) > current_capacity:
                    available = current_capacity - other_bookings
                    raise HTTPException(
                        status_code=409,
                        detail=f"Insufficient capacity. Available: {available}, Requested: {requested_quantity}"
                    )
        
        # Update the booking
        update_booking_query = """
            UPDATE bookings
            SET slot_id = $2, quantity = $3, cultivar_id = $4
            WHERE id = $1 AND tenant_id = $5
            RETURNING id, slot_id, tenant_id, grower_id, cultivar_id, quantity, status, created_at
        """
        
        update_queries = [
            (update_booking_query, [
                uuid.UUID(booking_id),
                uuid.UUID(new_slot_id),
                new_quantity,
                uuid.UUID(new_cultivar_id) if new_cultivar_id else None,
                uuid.UUID(tenant_id)
            ])
        ]
        
        update_results = await execute_transaction(update_queries)
        updated_booking = update_results[0][0]
        
        # Emit BOOKING_UPDATED domain event
        slot_info_for_event = target_slot_info if is_moving_slots else current_booking
        
        event_payload = {
            "booking_id": str(updated_booking['id']),
            "old_slot_id": str(current_booking['slot_id']),
            "new_slot_id": str(updated_booking['slot_id']),
            "old_quantity": float(current_booking['quantity']),
            "new_quantity": float(updated_booking['quantity']),
            "updated_by": current_user["sub"],
            "is_moved": is_moving_slots,
            "slot_date": slot_info_for_event['date'].isoformat(),
            "slot_time": slot_info_for_event['start_time'].strftime('%H:%M')
        }
        
        await emit_domain_event(
            "BOOKING_UPDATED",
            str(updated_booking['id']),
            event_payload,
            tenant_id
        )
        
        # Get additional details for response
        details_query = """
            SELECT g.name as grower_name, c.name as cultivar_name
            FROM growers g
            LEFT JOIN cultivars c ON c.id = $2
            WHERE g.id = $1
        """
        
        details = await execute_one(
            details_query,
            updated_booking['grower_id'],
            updated_booking['cultivar_id']
        )
        
        return BookingResponse(
            id=str(updated_booking['id']),
            slot_id=str(updated_booking['slot_id']),
            tenant_id=str(updated_booking['tenant_id']),
            grower_id=str(updated_booking['grower_id']),
            cultivar_id=str(updated_booking['cultivar_id']) if updated_booking['cultivar_id'] else None,
            quantity=updated_booking['quantity'],
            status=updated_booking['status'],
            created_at=updated_booking['created_at'],
            grower_name=details['grower_name'] if details else None,
            cultivar_name=details['cultivar_name'] if details else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Booking update failed: {str(e)}")