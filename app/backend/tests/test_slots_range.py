"""
Tests for slots range endpoint
"""
import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

# Mock FastAPI testing setup
@pytest.fixture
def mock_current_user():
    return {
        "sub": "user-123",
        "tenant_id": "tenant-456",
        "role": "admin"
    }

@pytest.fixture
def mock_slots_data():
    return [
        {
            'id': 'slot-1',
            'tenant_id': 'tenant-456',
            'date': date.today(),
            'start_time': '08:00:00',
            'end_time': '09:00:00',
            'capacity': 20.0,
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Test slot',
            'booked_quantity': 5.0,
            'restrictions_data': []
        },
        {
            'id': 'slot-2',
            'tenant_id': 'tenant-456', 
            'date': date.today() + timedelta(days=1),
            'start_time': '10:00:00',
            'end_time': '11:00:00',
            'capacity': 15.0,
            'resource_unit': 'tons',
            'blackout': True,
            'notes': 'Maintenance',
            'booked_quantity': 0.0,
            'restrictions_data': [{'grower_id': 'grower-1', 'cultivar_id': None}]
        }
    ]

@patch('app.backend.routers.slots.execute_query')
@patch('app.backend.routers.slots.get_current_user')
async def test_range_basic_ok(mock_get_user, mock_execute, mock_current_user, mock_slots_data):
    """Test basic range query returns slots for multiple days"""
    mock_get_user.return_value = mock_current_user
    mock_execute.return_value = mock_slots_data
    
    # This would be actual FastAPI test client call
    # For now, testing the logic directly
    from app.backend.routers.slots import get_slots_range
    
    start_date = date.today().strftime('%Y-%m-%d')
    end_date = (date.today() + timedelta(days=2)).strftime('%Y-%m-%d')
    
    result = await get_slots_range(start_date, end_date, mock_current_user)
    
    assert len(result) == 2
    assert result[0].id == 'slot-1'
    assert result[1].id == 'slot-2'
    assert result[0].usage['capacity'] == 20.0
    assert result[0].usage['booked'] == 5.0
    assert result[0].usage['remaining'] == 15.0

@patch('app.backend.routers.slots.execute_query') 
@patch('app.backend.routers.slots.get_current_user')
async def test_range_tenant_scoping(mock_get_user, mock_execute, mock_current_user):
    """Test range query only returns tenant's slots"""
    mock_get_user.return_value = mock_current_user
    mock_execute.return_value = []  # No slots for this tenant
    
    from app.backend.routers.slots import get_slots_range
    
    start_date = date.today().strftime('%Y-%m-%d')
    end_date = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    result = await get_slots_range(start_date, end_date, mock_current_user)
    
    # Verify tenant_id was used in query
    mock_execute.assert_called_once()
    call_args = mock_execute.call_args[0]
    assert 'tenant-456' in str(call_args[1])  # Check UUID was passed
    assert len(result) == 0

async def test_range_span_limit():
    """Test >14 days returns 400 error"""
    from app.backend.routers.slots import get_slots_range
    from fastapi import HTTPException
    
    mock_user = {"tenant_id": "tenant-456"}
    start_date = date.today().strftime('%Y-%m-%d')
    end_date = (date.today() + timedelta(days=15)).strftime('%Y-%m-%d')  # 15 days
    
    with pytest.raises(HTTPException) as exc_info:
        await get_slots_range(start_date, end_date, mock_user)
    
    assert exc_info.value.status_code == 400
    assert "cannot exceed 14 days" in exc_info.value.detail

async def test_range_invalid_dates():
    """Test start > end returns 400 error"""
    from app.backend.routers.slots import get_slots_range
    from fastapi import HTTPException
    
    mock_user = {"tenant_id": "tenant-456"}
    start_date = (date.today() + timedelta(days=5)).strftime('%Y-%m-%d')
    end_date = date.today().strftime('%Y-%m-%d')  # end before start
    
    with pytest.raises(HTTPException) as exc_info:
        await get_slots_range(start_date, end_date, mock_user)
    
    assert exc_info.value.status_code == 400
    assert "start_date must be <= end_date" in exc_info.value.detail

async def test_range_invalid_date_format():
    """Test invalid date format returns 400 error"""
    from app.backend.routers.slots import get_slots_range
    from fastapi import HTTPException
    
    mock_user = {"tenant_id": "tenant-456"}
    
    with pytest.raises(HTTPException) as exc_info:
        await get_slots_range("invalid-date", "2025-08-13", mock_user)
    
    assert exc_info.value.status_code == 400
    assert "Invalid date format" in exc_info.value.detail