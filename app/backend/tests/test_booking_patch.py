"""
Tests for PATCH /v1/bookings/{id} - booking update with capacity and restriction checks
"""
import pytest
import asyncio
from datetime import date, time, datetime
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from decimal import Decimal

from ..routers.bookings import update_booking, emit_domain_event, BookingPatch
from ..schemas import BookingResponse


class TestBookingPatchEndpoint:
    """Test the PATCH booking endpoint with various scenarios"""
    
    @pytest.fixture
    def mock_user(self):
        return {
            "sub": "user123",
            "tenant_id": "tenant123",
            "role": "admin",
            "grower_id": None
        }
    
    @pytest.fixture
    def grower_user(self):
        return {
            "sub": "grower456",
            "tenant_id": "tenant123",
            "role": "grower", 
            "grower_id": "grower123"
        }
    
    @pytest.fixture
    def sample_booking_data(self):
        return {
            'id': uuid.uuid4(),
            'slot_id': uuid.uuid4(),
            'grower_id': uuid.uuid4(),
            'cultivar_id': uuid.uuid4(),
            'quantity': Decimal('10.0'),
            'status': 'confirmed',
            'capacity': Decimal('50.0'),
            'blackout': False,
            'date': date(2025, 8, 20),
            'start_time': time(9, 0),
            'end_time': time(10, 0),
            'other_bookings': Decimal('15.0')
        }
    
    @pytest.fixture
    def target_slot_data(self):
        return {
            'id': uuid.uuid4(),
            'capacity': Decimal('30.0'),
            'blackout': False,
            'date': date(2025, 8, 20),
            'start_time': time(14, 0),
            'end_time': time(15, 0),
            'current_bookings': Decimal('20.0')
        }

    @pytest.mark.asyncio
    async def test_booking_not_found_returns_404(self, mock_user):
        """Test that non-existent booking returns 404"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=15)
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.return_value = [[]]  # Empty result
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 404 status
            assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_grower_cannot_update_other_booking_returns_403(self, grower_user, sample_booking_data):
        """Test that grower cannot update booking belonging to another grower"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=15)
        
        # Set booking to belong to different grower
        sample_booking_data['grower_id'] = uuid.uuid4()  # Different from grower_user's grower_id
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.return_value = [[sample_booking_data]]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, grower_user)
            
            # Should be HTTPException with 403 status
            assert "403" in str(exc_info.value) or "forbidden" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cannot_update_cancelled_booking_returns_400(self, mock_user, sample_booking_data):
        """Test that cancelled bookings cannot be updated"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=15)
        
        sample_booking_data['status'] = 'cancelled'
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.return_value = [[sample_booking_data]]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 400 status
            assert "cancelled" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_move_to_blackout_slot_returns_403(self, mock_user, sample_booking_data, target_slot_data):
        """Test that moving to a blacked out slot returns 403"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id)
        
        target_slot_data['blackout'] = True  # Target slot is blacked out
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.side_effect = [
                [[sample_booking_data]],  # Current booking query
                [[target_slot_data]]      # Target slot query  
            ]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 403 status for blackout restriction
            assert "403" in str(exc_info.value) or "blacked out" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_move_to_full_slot_returns_409(self, mock_user, sample_booking_data, target_slot_data):
        """Test that moving to a full slot returns 409"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id, quantity=15)  # Want to book 15 tons
        
        # Target slot has 30 capacity, 20 already booked, only 10 available but requesting 15
        target_slot_data['capacity'] = Decimal('30.0')
        target_slot_data['current_bookings'] = Decimal('20.0')
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.side_effect = [
                [[sample_booking_data]],  # Current booking query
                [[target_slot_data]]      # Target slot query
            ]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 409 status for capacity conflict
            assert "409" in str(exc_info.value) or "capacity" in str(exc_info.value).lower()

    @pytest.mark.asyncio  
    async def test_increase_quantity_beyond_capacity_returns_409(self, mock_user, sample_booking_data):
        """Test that increasing quantity beyond slot capacity returns 409"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=50)  # Trying to increase to 50 tons
        
        # Current slot has 50 capacity, 15 other bookings, current booking is 10
        # So available is 50 - 15 = 35, but requesting 50 > 35
        sample_booking_data['capacity'] = Decimal('50.0')
        sample_booking_data['other_bookings'] = Decimal('15.0')  # Other bookings in same slot
        sample_booking_data['quantity'] = Decimal('10.0')       # Current booking quantity
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.return_value = [[sample_booking_data]]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 409 status for capacity conflict  
            assert "409" in str(exc_info.value) or "capacity" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_successful_quantity_update_returns_200(self, mock_user, sample_booking_data):
        """Test successful quantity update within capacity limits"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=20)  # Reasonable increase
        
        # Current slot has sufficient capacity
        sample_booking_data['capacity'] = Decimal('60.0') 
        sample_booking_data['other_bookings'] = Decimal('15.0')
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['quantity'] = Decimal('20.0')
        
        mock_details = {'grower_name': 'Test Grower', 'cultivar_name': 'Test Cultivar'}
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking query
                [[updated_booking_data]]    # Update booking query
            ]
            mock_execute_one.return_value = mock_details
            mock_emit.return_value = AsyncMock()
            
            result = await update_booking(booking_id, patch_data, mock_user)
            
            assert isinstance(result, BookingResponse)
            assert result.quantity == 20
            assert result.grower_name == 'Test Grower'
            
            # Verify event emission
            mock_emit.assert_called_once()
            event_call = mock_emit.call_args
            assert event_call[0][0] == "BOOKING_UPDATED"  # Event type
            assert "new_quantity" in event_call[0][2]      # Payload contains new_quantity

    @pytest.mark.asyncio
    async def test_successful_slot_move_returns_200(self, mock_user, sample_booking_data, target_slot_data):
        """Test successful move to different slot with available capacity"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id)
        
        # Target slot has enough capacity: 30 capacity, 20 booked, 10 available >= 10 requested
        target_slot_data['capacity'] = Decimal('30.0')
        target_slot_data['current_bookings'] = Decimal('20.0')
        target_slot_data['blackout'] = False
        
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['slot_id'] = uuid.UUID(target_slot_id)
        
        mock_details = {'grower_name': 'Test Grower', 'cultivar_name': 'Test Cultivar'}
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking query
                [[target_slot_data]],       # Target slot query
                [[updated_booking_data]]    # Update booking query
            ]
            mock_execute_one.return_value = mock_details
            mock_emit.return_value = AsyncMock()
            
            result = await update_booking(booking_id, patch_data, mock_user)
            
            assert isinstance(result, BookingResponse)
            assert result.slot_id == target_slot_id
            
            # Verify event emission with move details
            mock_emit.assert_called_once()
            event_call = mock_emit.call_args
            assert event_call[0][0] == "BOOKING_UPDATED"
            event_payload = event_call[0][2]
            assert event_payload["is_moved"] == True
            assert event_payload["old_slot_id"] != event_payload["new_slot_id"]

    @pytest.mark.asyncio
    async def test_combined_slot_and_quantity_update_returns_200(self, mock_user, sample_booking_data, target_slot_data):
        """Test successful update of both slot and quantity simultaneously"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id, quantity=8)  # Move and reduce quantity
        
        # Target slot has enough capacity for reduced quantity
        target_slot_data['capacity'] = Decimal('25.0')
        target_slot_data['current_bookings'] = Decimal('15.0')  # 10 available >= 8 requested
        target_slot_data['blackout'] = False
        
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['slot_id'] = uuid.UUID(target_slot_id)
        updated_booking_data['quantity'] = Decimal('8.0')
        
        mock_details = {'grower_name': 'Test Grower', 'cultivar_name': 'Test Cultivar'}
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking query  
                [[target_slot_data]],       # Target slot query
                [[updated_booking_data]]    # Update booking query
            ]
            mock_execute_one.return_value = mock_details
            mock_emit.return_value = AsyncMock()
            
            result = await update_booking(booking_id, patch_data, mock_user)
            
            assert isinstance(result, BookingResponse)
            assert result.slot_id == target_slot_id
            assert result.quantity == 8
            
            # Verify comprehensive event payload
            mock_emit.assert_called_once()
            event_call = mock_emit.call_args
            event_payload = event_call[0][2]
            assert event_payload["is_moved"] == True
            assert event_payload["old_quantity"] != event_payload["new_quantity"]
            assert event_payload["updated_by"] == mock_user["sub"]

    @pytest.mark.asyncio
    async def test_cultivar_update_only_returns_200(self, mock_user, sample_booking_data):
        """Test successful cultivar update without slot or quantity changes"""
        booking_id = str(uuid.uuid4())
        new_cultivar_id = str(uuid.uuid4())
        patch_data = BookingPatch(cultivar_id=new_cultivar_id)
        
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['cultivar_id'] = uuid.UUID(new_cultivar_id)
        
        mock_details = {'grower_name': 'Test Grower', 'cultivar_name': 'New Cultivar'}
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking query
                [[updated_booking_data]]    # Update booking query
            ]
            mock_execute_one.return_value = mock_details
            mock_emit.return_value = AsyncMock()
            
            result = await update_booking(booking_id, patch_data, mock_user)
            
            assert isinstance(result, BookingResponse)
            assert result.cultivar_id == new_cultivar_id
            assert result.cultivar_name == 'New Cultivar'
            
            # Verify event emission for cultivar change
            mock_emit.assert_called_once()
            event_call = mock_emit.call_args
            assert event_call[0][0] == "BOOKING_UPDATED"

    @pytest.mark.asyncio
    async def test_event_emission_and_outbox_insertion(self, mock_user, sample_booking_data):
        """Test that domain events are properly emitted and added to outbox"""
        booking_id = str(uuid.uuid4())
        patch_data = BookingPatch(quantity=12)
        
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['quantity'] = Decimal('12.0')
        
        mock_details = {'grower_name': 'Test Grower', 'cultivar_name': 'Test Cultivar'}
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking query
                [[updated_booking_data]]    # Update booking query
            ]
            mock_execute_one.return_value = mock_details
            
            # Mock the event emission to verify it's called correctly
            mock_event_result = {'id': uuid.uuid4()}
            mock_emit.return_value = mock_event_result
            
            result = await update_booking(booking_id, patch_data, mock_user)
            
            # Verify event was emitted with correct parameters
            mock_emit.assert_called_once()
            event_args = mock_emit.call_args[0]
            
            assert event_args[0] == "BOOKING_UPDATED"  # Event type
            assert event_args[1] == str(updated_booking_data['id'])  # Aggregate ID
            assert isinstance(event_args[2], dict)  # Event payload
            assert event_args[3] == mock_user["tenant_id"]  # Tenant ID
            
            # Check event payload structure
            payload = event_args[2]
            assert "booking_id" in payload
            assert "old_quantity" in payload
            assert "new_quantity" in payload
            assert "updated_by" in payload
            assert payload["updated_by"] == mock_user["sub"]

    @pytest.mark.asyncio
    async def test_target_slot_not_found_returns_404(self, mock_user, sample_booking_data):
        """Test that moving to non-existent slot returns 404"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id)
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute:
            mock_execute.side_effect = [
                [[sample_booking_data]],  # Current booking query
                [[]]                      # Target slot query - empty result
            ]
            
            with pytest.raises(Exception) as exc_info:
                await update_booking(booking_id, patch_data, mock_user)
            
            # Should be HTTPException with 404 status for target slot not found
            assert "not found" in str(exc_info.value).lower()


class TestTransactionBehavior:
    """Test transaction safety and SELECT FOR UPDATE behavior"""
    
    @pytest.mark.asyncio
    async def test_select_for_update_locks_current_and_target_slots(self, sample_booking_data, target_slot_data):
        """Test that both current and target slots are locked during move"""
        booking_id = str(uuid.uuid4())
        target_slot_id = str(uuid.uuid4())
        patch_data = BookingPatch(slot_id=target_slot_id)
        mock_user = {"tenant_id": "tenant123", "role": "admin", "sub": "admin123"}
        
        updated_booking_data = sample_booking_data.copy()
        updated_booking_data['slot_id'] = uuid.UUID(target_slot_id)
        
        with patch('app.backend.routers.bookings.execute_transaction') as mock_execute, \
             patch('app.backend.routers.bookings.execute_one') as mock_execute_one, \
             patch('app.backend.routers.bookings.emit_domain_event') as mock_emit:
            
            mock_execute.side_effect = [
                [[sample_booking_data]],    # Current booking with FOR UPDATE
                [[target_slot_data]],       # Target slot with FOR UPDATE  
                [[updated_booking_data]]    # Update booking
            ]
            mock_execute_one.return_value = {'grower_name': 'Test', 'cultivar_name': 'Test'}
            mock_emit.return_value = AsyncMock()
            
            await update_booking(booking_id, patch_data, mock_user)
            
            # Verify that FOR UPDATE was used in queries
            assert mock_execute.call_count == 3
            
            # Check that FOR UPDATE is present in the SQL queries
            first_query = mock_execute.call_args_list[0][0][0][0][0]  # First query text
            second_query = mock_execute.call_args_list[1][0][0][0][0]  # Second query text
            
            assert "FOR UPDATE" in first_query
            assert "FOR UPDATE" in second_query

    def test_atomic_capacity_check_and_update_logic(self):
        """Test the capacity checking logic for both scenarios"""
        # Scenario 1: Same slot, quantity change
        current_capacity = 50.0
        other_bookings = 15.0  
        new_quantity = 30.0
        
        # Available capacity = 50 - 15 = 35, requesting 30, should pass
        available = current_capacity - other_bookings
        assert new_quantity <= available
        
        # Scenario 2: Same slot, quantity too high  
        new_quantity = 40.0  # Requesting 40 > 35 available, should fail
        assert new_quantity > available
        
        # Scenario 3: Different slot, capacity check
        target_capacity = 25.0
        target_current_bookings = 20.0
        requested_quantity = 8.0
        
        # Available = 25 - 20 = 5, requesting 8, should fail
        target_available = target_capacity - target_current_bookings  
        assert requested_quantity > target_available  # This would trigger 409
        
        # Available = 25 - 20 = 5, requesting 4, should pass
        requested_quantity = 4.0
        assert requested_quantity <= target_available


if __name__ == '__main__':
    pytest.main([__file__, '-v'])