"""
Bookings router - handles booking creation and management with transactional safety
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional
import uuid
from decimal import Decimal

from ..db import execute_query, execute_one, execute_transaction
from ..security import get_current_user
from ..schemas import BookingCreate, BookingResponse, DomainEvent

router = APIRouter()

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