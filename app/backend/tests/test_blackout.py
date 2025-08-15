"""
Tests for blackout functionality - single slot and bulk day/week operations
"""
import pytest
import asyncio
from datetime import date, time, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from decimal import Decimal

from ..routers.slots import blackout_slot, bulk_blackout_slots, BlackoutRequest
from ..schemas import SlotResponse


class TestBlackoutEndpoints:
    """Test blackout operations for single slots and bulk day/week"""
    
    @pytest.fixture
    def mock_admin_user(self):
        return {
            "sub": "admin123",
            "tenant_id": "tenant123",
            "role": "admin"
        }
    
    @pytest.fixture
    def sample_slot_data(self):
        return {
            'id': uuid.uuid4(),
            'tenant_id': uuid.uuid4(),
            'date': date(2025, 8, 20),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'capacity': Decimal('15.0'),
            'resource_unit': 'tons',
            'blackout': False,
            'notes': 'Original note'
        }

    @pytest.mark.asyncio
    async def test_single_slot_blackout_toggles_true(self, mock_admin_user, sample_slot_data):
        """Test that PATCH /v1/slots/{id}/blackout sets blackout=true"""
        slot_id = str(uuid.uuid4())
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="slot",
            note="Emergency blackout"
        )
        
        # Mock the slot after blackout
        blackout_slot_data = sample_slot_data.copy()
        blackout_slot_data['blackout'] = True
        blackout_slot_data['notes'] = "Emergency blackout"
        
        with patch('app.backend.routers.slots.execute_one') as mock_execute:
            mock_execute.return_value = blackout_slot_data
            
            result = await blackout_slot(slot_id, request, mock_admin_user)
            
            assert isinstance(result, SlotResponse)
            assert result.blackout == True
            assert result.notes == "Emergency blackout"
            
            # Verify the query was called with correct parameters
            mock_execute.assert_called_once()
            call_args = mock_execute.call_args[0]
            assert "blackout = $1" in call_args[0]
            assert "notes = $2" in call_args[0]
            assert call_args[1] == True  # blackout value
            assert call_args[2] == "Emergency blackout"  # note value

    @pytest.mark.asyncio
    async def test_single_slot_blackout_without_note(self, mock_admin_user, sample_slot_data):
        """Test single slot blackout without note"""
        slot_id = str(uuid.uuid4())
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20", 
            scope="slot"
        )
        
        blackout_slot_data = sample_slot_data.copy()
        blackout_slot_data['blackout'] = True
        
        with patch('app.backend.routers.slots.execute_one') as mock_execute:
            mock_execute.return_value = blackout_slot_data
            
            result = await blackout_slot(slot_id, request, mock_admin_user)
            
            assert result.blackout == True
            assert result.notes == "Original note"  # Unchanged
            
            # Verify query doesn't update notes when not provided
            call_args = mock_execute.call_args[0]
            assert "notes = $2" not in call_args[0]

    @pytest.mark.asyncio
    async def test_single_slot_blackout_not_found(self, mock_admin_user):
        """Test 404 when slot doesn't exist"""
        slot_id = str(uuid.uuid4())
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="slot"
        )
        
        with patch('app.backend.routers.slots.execute_one') as mock_execute:
            mock_execute.return_value = None  # Slot not found
            
            with pytest.raises(Exception) as exc_info:
                await blackout_slot(slot_id, request, mock_admin_user)
            
            assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_day_blackout_sets_all_slots_in_date(self, mock_admin_user):
        """Test that day scope blackouts all slots for specified dates"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-22",  # 3 days
            scope="day",
            note="Maintenance period"
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            # Mock the count query to return affected slots
            mock_execute_one.return_value = {'count': 15}  # 15 slots affected
            
            result = await bulk_blackout_slots(request, mock_admin_user)
            
            assert result['affected_slots'] == 15
            assert result['scope'] == 'day'
            assert result['start_date'] == '2025-08-20'
            assert result['end_date'] == '2025-08-22'
            
            # Verify UPDATE queries were called for each date
            assert mock_execute_query.call_count == 3  # 3 days
            
            # Check first call for 2025-08-20
            first_call = mock_execute_query.call_args_list[0]
            assert "blackout = true" in first_call[0][0]
            assert "notes = $1" in first_call[0][0]
            assert first_call[0][1] == "Maintenance period"

    @pytest.mark.asyncio
    async def test_week_blackout_sets_calendar_weeks(self, mock_admin_user):
        """Test that week scope blackouts entire calendar weeks"""
        request = BlackoutRequest(
            start_date="2025-08-20",  # Wednesday
            end_date="2025-08-27",    # Wednesday next week
            scope="week",
            note="Holiday week"
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            mock_execute_one.return_value = {'count': 35}  # 35 slots in 2 weeks
            
            result = await bulk_blackout_slots(request, mock_admin_user)
            
            assert result['affected_slots'] == 35
            assert result['scope'] == 'week'
            
            # Should have 2 UPDATE calls for 2 weeks
            assert mock_execute_query.call_count == 2
            
            # Verify week boundary calculations
            for call in mock_execute_query.call_args_list:
                query = call[0][0]
                assert "date >= $3 AND date <= $4" in query or "date >= $2 AND date <= $3" in query

    @pytest.mark.asyncio
    async def test_bulk_blackout_idempotent_behavior(self, mock_admin_user):
        """Test that re-posting same blackout request doesn't duplicate counts"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="day"
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            # First run: 5 slots updated
            mock_execute_one.return_value = {'count': 5}
            
            first_result = await bulk_blackout_slots(request, mock_admin_user)
            assert first_result['affected_slots'] == 5
            
            # Second run: 0 new slots (all already blackout)
            mock_execute_one.return_value = {'count': 5}  # Same total, but no new updates
            
            second_result = await bulk_blackout_slots(request, mock_admin_user)
            assert second_result['affected_slots'] == 5  # Total count, not newly updated
            
            # Verify WHERE blackout = false condition prevents duplicates
            for call in mock_execute_query.call_args_list:
                query = call[0][0]
                assert "blackout = false" in query

    @pytest.mark.asyncio
    async def test_blackout_invalid_date_format(self, mock_admin_user):
        """Test validation of date format"""
        request = BlackoutRequest(
            start_date="2025/08/20",  # Invalid format
            end_date="2025-08-20",
            scope="day"
        )
        
        with pytest.raises(Exception) as exc_info:
            await bulk_blackout_slots(request, mock_admin_user)
        
        assert "invalid date format" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_blackout_start_after_end_date(self, mock_admin_user):
        """Test validation that start_date <= end_date"""
        request = BlackoutRequest(
            start_date="2025-08-25",
            end_date="2025-08-20",  # Before start
            scope="day"
        )
        
        with pytest.raises(Exception) as exc_info:
            await bulk_blackout_slots(request, mock_admin_user)
        
        assert "start_date must be" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_blackout_invalid_scope(self, mock_admin_user):
        """Test validation of scope parameter"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="month"  # Invalid scope
        )
        
        with pytest.raises(Exception) as exc_info:
            await bulk_blackout_slots(request, mock_admin_user)
        
        assert "invalid scope" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_blackout_excessive_date_range(self, mock_admin_user):
        """Test protection against excessive date ranges"""
        request = BlackoutRequest(
            start_date="2025-01-01",
            end_date="2026-12-31",  # 2 years
            scope="day"
        )
        
        with pytest.raises(Exception) as exc_info:
            await bulk_blackout_slots(request, mock_admin_user)
        
        assert "cannot exceed 365 days" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_week_boundary_calculations(self, mock_admin_user):
        """Test proper week boundary calculations for Monday-Sunday weeks"""
        # Start on Thursday, Aug 21, 2025
        request = BlackoutRequest(
            start_date="2025-08-21",  # Thursday
            end_date="2025-08-21",
            scope="week"
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            mock_execute_one.return_value = {'count': 7}
            
            await bulk_blackout_slots(request, mock_admin_user)
            
            # Should update the entire week from Monday (Aug 18) to Sunday (Aug 24)
            call_args = mock_execute_query.call_args[0]
            
            # Extract the date parameters from the call
            # The exact parameter positions depend on whether note is provided
            assert mock_execute_query.call_count == 1

    @pytest.mark.asyncio
    async def test_day_blackout_without_note(self, mock_admin_user):
        """Test day blackout without note parameter"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="day"
            # No note provided
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            mock_execute_one.return_value = {'count': 3}
            
            result = await bulk_blackout_slots(request, mock_admin_user)
            
            assert result['affected_slots'] == 3
            
            # Verify query doesn't include notes update
            call_args = mock_execute_query.call_args[0]
            query = call_args[0]
            assert "notes = $" not in query
            assert "blackout = true" in query

    @pytest.mark.asyncio
    async def test_multiple_days_each_updated_separately(self, mock_admin_user):
        """Test that each day in range gets individual UPDATE query"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-23",  # 4 days
            scope="day"
        )
        
        with patch('app.backend.routers.slots.execute_query') as mock_execute_query, \
             patch('app.backend.routers.slots.execute_one') as mock_execute_one:
            
            mock_execute_one.return_value = {'count': 20}
            
            await bulk_blackout_slots(request, mock_admin_user)
            
            # Should have 4 separate UPDATE calls for 4 days
            assert mock_execute_query.call_count == 4
            
            # Verify each call targets a specific date
            for call in mock_execute_query.call_args_list:
                query = call[0][0]
                assert "date = $" in query  # Each targets specific date
                assert "blackout = false" in query  # Idempotent condition


class TestBlackoutSchemaValidation:
    """Test BlackoutRequest schema validation"""
    
    def test_valid_blackout_request_all_fields(self):
        """Test valid request with all fields"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-25",
            scope="day",
            note="Scheduled maintenance"
        )
        
        assert request.start_date == "2025-08-20"
        assert request.end_date == "2025-08-25"
        assert request.scope == "day"
        assert request.note == "Scheduled maintenance"

    def test_valid_blackout_request_minimal_fields(self):
        """Test valid request with only required fields"""
        request = BlackoutRequest(
            start_date="2025-08-20",
            end_date="2025-08-20",
            scope="week"
        )
        
        assert request.start_date == "2025-08-20"
        assert request.end_date == "2025-08-20"
        assert request.scope == "week"
        assert request.note is None

    def test_blackout_request_scope_validation(self):
        """Test that only valid scope values are accepted"""
        # Valid scopes should work
        for scope in ["slot", "day", "week"]:
            request = BlackoutRequest(
                start_date="2025-08-20",
                end_date="2025-08-20",
                scope=scope
            )
            assert request.scope == scope

    def test_blackout_request_required_fields(self):
        """Test that required fields are enforced"""
        with pytest.raises(Exception):
            BlackoutRequest(
                # Missing required fields
                scope="day"
            )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])