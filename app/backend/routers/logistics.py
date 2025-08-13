"""
Logistics router - handles consignments and checkpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import uuid
from datetime import datetime

from ..db import execute_query, execute_one, execute_transaction
from ..security import get_current_user, require_role
from ..schemas import ConsignmentCreate, ConsignmentResponse, CheckpointCreate, CheckpointResponse

router = APIRouter()

@router.post("/consignments", response_model=ConsignmentResponse)
async def create_consignment(
    consignment: ConsignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a consignment from a booking"""
    tenant_id = current_user["tenant_id"]
    
    # Verify booking exists and belongs to tenant
    booking_query = """
        SELECT b.id, b.grower_id, b.quantity
        FROM bookings b
        WHERE b.id = $1 AND b.tenant_id = $2 AND b.status = 'confirmed'
    """
    
    booking = await execute_one(booking_query, uuid.UUID(consignment.booking_id), uuid.UUID(tenant_id))
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not confirmed")
    
    # Create consignment
    create_query = """
        INSERT INTO consignments (booking_id, tenant_id, consignment_number, supplier_id, 
                                transporter_id, expected_quantity)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, booking_id, tenant_id, consignment_number, supplier_id, 
                  transporter_id, expected_quantity, actual_quantity, status, created_at
    """
    
    new_consignment = await execute_one(
        create_query,
        uuid.UUID(consignment.booking_id),
        uuid.UUID(tenant_id),
        consignment.consignment_number,
        uuid.UUID(consignment.supplier_id),
        uuid.UUID(consignment.transporter_id) if consignment.transporter_id else None,
        consignment.expected_quantity
    )
    
    return ConsignmentResponse(
        id=str(new_consignment['id']),
        booking_id=str(new_consignment['booking_id']),
        tenant_id=str(new_consignment['tenant_id']),
        consignment_number=new_consignment['consignment_number'],
        supplier_id=str(new_consignment['supplier_id']),
        transporter_id=str(new_consignment['transporter_id']) if new_consignment['transporter_id'] else None,
        expected_quantity=new_consignment['expected_quantity'],
        actual_quantity=new_consignment['actual_quantity'],
        status=new_consignment['status'],
        created_at=new_consignment['created_at']
    )

@router.get("/consignments", response_model=List[ConsignmentResponse])
async def get_consignments(
    date_filter: Optional[str] = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user)
):
    """Get consignments with latest checkpoint"""
    tenant_id = current_user["tenant_id"]
    user_role = current_user["role"]
    user_grower_id = current_user.get("grower_id")
    
    base_query = """
        SELECT c.id, c.booking_id, c.tenant_id, c.consignment_number, c.supplier_id,
               c.transporter_id, c.expected_quantity, c.actual_quantity, c.status, c.created_at,
               latest_cp.type as latest_checkpoint_type,
               latest_cp.timestamp as latest_checkpoint_time,
               latest_cp.payload as latest_checkpoint_payload
        FROM consignments c
        JOIN bookings b ON c.booking_id = b.id
        JOIN slots s ON b.slot_id = s.id
        LEFT JOIN LATERAL (
            SELECT type, timestamp, payload
            FROM checkpoints cp
            WHERE cp.consignment_id = c.id
            ORDER BY cp.timestamp DESC
            LIMIT 1
        ) latest_cp ON true
        WHERE c.tenant_id = $1
    """
    
    params = [uuid.UUID(tenant_id)]
    param_count = 2
    
    # Growers can only see their own consignments
    if user_role == "grower" and user_grower_id:
        base_query += f" AND b.grower_id = ${param_count}"
        params.append(uuid.UUID(user_grower_id))
        param_count += 1
    
    if date_filter:
        base_query += f" AND s.date = ${param_count}"
        params.append(date_filter)
        param_count += 1
    
    base_query += " ORDER BY c.created_at DESC"
    
    consignments = await execute_query(base_query, *params)
    
    result = []
    for consignment in consignments:
        latest_checkpoint = None
        if consignment['latest_checkpoint_type']:
            latest_checkpoint = {
                "type": consignment['latest_checkpoint_type'],
                "timestamp": consignment['latest_checkpoint_time'].isoformat(),
                "payload": consignment['latest_checkpoint_payload']
            }
        
        result.append(ConsignmentResponse(
            id=str(consignment['id']),
            booking_id=str(consignment['booking_id']),
            tenant_id=str(consignment['tenant_id']),
            consignment_number=consignment['consignment_number'],
            supplier_id=str(consignment['supplier_id']),
            transporter_id=str(consignment['transporter_id']) if consignment['transporter_id'] else None,
            expected_quantity=consignment['expected_quantity'],
            actual_quantity=consignment['actual_quantity'],
            status=consignment['status'],
            created_at=consignment['created_at'],
            latest_checkpoint=latest_checkpoint
        ))
    
    return result

@router.post("/consignments/{consignment_id}/checkpoints", response_model=CheckpointResponse)
async def create_checkpoint(
    consignment_id: str,
    checkpoint: CheckpointCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a checkpoint for a consignment"""
    tenant_id = current_user["tenant_id"]
    
    # Verify consignment exists and belongs to tenant
    consignment_query = """
        SELECT c.id FROM consignments c
        WHERE c.id = $1 AND c.tenant_id = $2
    """
    
    consignment_exists = await execute_one(
        consignment_query, 
        uuid.UUID(consignment_id), 
        uuid.UUID(tenant_id)
    )
    
    if not consignment_exists:
        raise HTTPException(status_code=404, detail="Consignment not found")
    
    # Create checkpoint
    create_query = """
        INSERT INTO checkpoints (consignment_id, type, payload, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, consignment_id, type, timestamp, payload, created_by
    """
    
    new_checkpoint = await execute_one(
        create_query,
        uuid.UUID(consignment_id),
        checkpoint.type,
        checkpoint.payload,
        uuid.UUID(current_user["sub"])
    )
    
    # Update consignment status based on checkpoint type
    status_updates = {
        "gate_in": "in_transit",
        "weigh": "in_transit", 
        "quality_check": "in_transit",
        "delivered": "delivered",
        "rejected": "rejected"
    }
    
    if checkpoint.type in status_updates:
        update_query = """
            UPDATE consignments 
            SET status = $1
            WHERE id = $2
        """
        await execute_one(update_query, status_updates[checkpoint.type], uuid.UUID(consignment_id))
    
    return CheckpointResponse(
        id=str(new_checkpoint['id']),
        consignment_id=str(new_checkpoint['consignment_id']),
        type=new_checkpoint['type'],
        timestamp=new_checkpoint['timestamp'],
        payload=new_checkpoint['payload'],
        created_by=str(new_checkpoint['created_by']) if new_checkpoint['created_by'] else None
    )