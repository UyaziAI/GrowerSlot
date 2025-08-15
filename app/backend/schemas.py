"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date, time
from decimal import Decimal
import uuid

# Auth schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    tenant_id: str
    grower_id: Optional[str] = None

# Slot schemas
class SlotCreate(BaseModel):
    date: date
    start_time: time
    end_time: time
    capacity: Decimal
    resource_unit: str = "tons"
    notes: Optional[str] = None

class SlotUpdate(BaseModel):
    capacity: Optional[Decimal] = None
    blackout: Optional[bool] = None
    notes: Optional[str] = None

class SlotResponse(BaseModel):
    id: str
    tenant_id: str
    date: date
    start_time: time
    end_time: time
    capacity: Decimal
    resource_unit: str
    blackout: bool
    notes: Optional[str]
    restrictions: Optional[Dict[str, List[str]]] = None
    usage: Optional[Dict[str, Any]] = None

class BulkSlotCreate(BaseModel):
    start_date: date
    end_date: date
    start_time: time
    end_time: time
    slot_duration: int = Field(ge=1, description="Duration in hours")
    capacity: Decimal
    notes: Optional[str] = None

class SlotsRangeRequest(BaseModel):
    start_date: date = Field(description="Start date for range query")
    end_date: date = Field(description="End date for range query")
    
    def model_validate(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")
        
        date_diff = (self.end_date - self.start_date).days
        if date_diff > 14:
            raise ValueError("Date range cannot exceed 14 days")
        
        return self

# Booking schemas
class BookingCreate(BaseModel):
    slot_id: str
    grower_id: str
    cultivar_id: Optional[str] = None
    quantity: Decimal

class BookingResponse(BaseModel):
    id: str
    slot_id: str
    tenant_id: str
    grower_id: str
    cultivar_id: Optional[str]
    quantity: Decimal
    status: str
    created_at: datetime
    # Include slot and grower details
    slot: Optional[SlotResponse] = None
    grower_name: Optional[str] = None
    cultivar_name: Optional[str] = None

# Restriction schemas
class RestrictionApply(BaseModel):
    date: Optional[date] = None
    slot_id: Optional[str] = None
    grower_ids: Optional[List[str]] = None
    cultivar_ids: Optional[List[str]] = None
    note: Optional[str] = None

# Logistics schemas
class ConsignmentCreate(BaseModel):
    booking_id: str
    consignment_number: str
    supplier_id: str
    transporter_id: Optional[str] = None
    expected_quantity: Decimal

class ConsignmentResponse(BaseModel):
    id: str
    booking_id: str
    tenant_id: str
    consignment_number: str
    supplier_id: str
    transporter_id: Optional[str]
    expected_quantity: Decimal
    actual_quantity: Optional[Decimal]
    status: str
    created_at: datetime
    latest_checkpoint: Optional[Dict[str, Any]] = None

class CheckpointCreate(BaseModel):
    type: str
    payload: Dict[str, Any] = {}

class CheckpointResponse(BaseModel):
    id: str
    consignment_id: str
    type: str
    timestamp: datetime
    payload: Dict[str, Any]
    created_by: Optional[str]

# Template schemas
class TemplateIn(BaseModel):
    name: str
    description: Optional[str] = None
    config: Dict[str, Any]
    active_from: Optional[str] = None   # YYYY-MM-DD
    active_to: Optional[str] = None

class TemplateOut(TemplateIn):
    id: str
    tenant_id: str

class ApplyTemplateRequest(BaseModel):
    template_id: str
    start_date: str
    end_date: str
    mode: Literal["preview", "publish"]

class ApplyTemplateResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    samples: Dict[str, List[Dict[str, Any]]] = Field(default_factory=lambda: {"create":[], "update":[], "skip":[]})

# Event schemas
class DomainEvent(BaseModel):
    event_type: str
    aggregate_id: str
    payload: Dict[str, Any]
    tenant_id: str