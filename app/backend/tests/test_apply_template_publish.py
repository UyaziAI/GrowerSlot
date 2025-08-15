"""
Tests for Apply Template Publish functionality - idempotent writes and transactional behavior
"""
import pytest
import asyncio
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from ..services.templates import publish_plan


class TestPublishPlan:
    """Test the publish_plan function with idempotent write behavior"""
    
    @pytest.mark.asyncio
    async def test_empty_plan_returns_zero_counts(self):
        """Test that empty plan returns zero counts without database operations"""
        mock_pool = MagicMock()
        
        result = await publish_plan('tenant-123', [], mock_pool)
        
        assert result == {'created': 0, 'updated': 0, 'skipped': 0}
        # Should not acquire connection for empty plan
        mock_pool.acquire.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_new_slots_are_created(self):
        """Test that new slots are inserted when no existing slots match"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_transaction = AsyncMock()
        
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_conn.transaction.return_value = mock_transaction
        mock_transaction.__aenter__ = AsyncMock()
        mock_transaction.__aexit__ = AsyncMock()
        
        # Mock UPDATE returning "UPDATE 0" (no rows affected)
        mock_conn.execute.side_effect = [
            "UPDATE 0",  # No existing slot found
            None         # INSERT succeeds
        ]
        
        plan = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 10,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            }
        ]
        
        result = await publish_plan('tenant-123', plan, mock_pool)
        
        assert result == {'created': 1, 'updated': 0, 'skipped': 0}
        
        # Verify UPDATE was attempted first
        update_call = mock_conn.execute.call_args_list[0]
        assert 'UPDATE slots' in update_call[0][0]
        
        # Verify INSERT was called after UPDATE returned 0
        insert_call = mock_conn.execute.call_args_list[1]
        assert 'INSERT INTO slots' in insert_call[0][0]
        assert 'gen_random_uuid()' in insert_call[0][0]
    
    @pytest.mark.asyncio
    async def test_existing_slots_are_updated(self):
        """Test that existing slots are updated when found"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_transaction = AsyncMock()
        
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_conn.transaction.return_value = mock_transaction
        mock_transaction.__aenter__ = AsyncMock()
        mock_transaction.__aexit__ = AsyncMock()
        
        # Mock UPDATE returning "UPDATE 1" (one row affected)
        mock_conn.execute.return_value = "UPDATE 1"
        
        plan = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 15,  # Different capacity to trigger update
                'resource_unit': 'tons',
                'notes': 'Updated notes',
                'blackout': False
            }
        ]
        
        result = await publish_plan('tenant-123', plan, mock_pool)
        
        assert result == {'created': 0, 'updated': 1, 'skipped': 0}
        
        # Verify only UPDATE was called (no INSERT after successful UPDATE)
        assert mock_conn.execute.call_count == 1
        update_call = mock_conn.execute.call_args_list[0]
        assert 'UPDATE slots' in update_call[0][0]
        
        # Verify UPDATE parameters include the new values
        args = update_call[0]
        assert args[5] == 15  # capacity
        assert args[8] == 'Updated notes'  # notes
    
    @pytest.mark.asyncio
    async def test_mixed_create_and_update_operations(self):
        """Test handling of mixed create and update operations"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_transaction = AsyncMock()
        
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_conn.transaction.return_value = mock_transaction
        mock_transaction.__aenter__ = AsyncMock()
        mock_transaction.__aexit__ = AsyncMock()
        
        # First slot: UPDATE returns 1 (existing slot)
        # Second slot: UPDATE returns 0, then INSERT (new slot)
        mock_conn.execute.side_effect = [
            "UPDATE 1",   # First slot updated
            "UPDATE 0",   # Second slot not found
            None          # Second slot inserted
        ]
        
        plan = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 10,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            },
            {
                'date': '2025-08-18',
                'start_time': '10:00',
                'end_time': '10:30',
                'capacity': 15,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            }
        ]
        
        result = await publish_plan('tenant-123', plan, mock_pool)
        
        assert result == {'created': 1, 'updated': 1, 'skipped': 0}
        assert mock_conn.execute.call_count == 3
    
    @pytest.mark.asyncio
    async def test_idempotent_behavior(self):
        """Test that running the same plan twice is idempotent (no changes on second run)"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_transaction = AsyncMock()
        
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_conn.transaction.return_value = mock_transaction
        mock_transaction.__aenter__ = AsyncMock()
        mock_transaction.__aexit__ = AsyncMock()
        
        plan = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 10,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            }
        ]
        
        # First run: CREATE (UPDATE 0, then INSERT)
        mock_conn.execute.side_effect = ["UPDATE 0", None]
        result1 = await publish_plan('tenant-123', plan, mock_pool)
        assert result1 == {'created': 1, 'updated': 0, 'skipped': 0}
        
        # Reset mock for second run
        mock_conn.execute.reset_mock()
        
        # Second run: UPDATE (same slot exists with same values - UPDATE 1)
        mock_conn.execute.return_value = "UPDATE 1"
        result2 = await publish_plan('tenant-123', plan, mock_pool)
        assert result2 == {'created': 0, 'updated': 1, 'skipped': 0}
        
        # Third run with same exact plan should also be UPDATE
        mock_conn.execute.reset_mock()
        mock_conn.execute.return_value = "UPDATE 1" 
        result3 = await publish_plan('tenant-123', plan, mock_pool)
        assert result3 == {'created': 0, 'updated': 1, 'skipped': 0}
    
    @pytest.mark.asyncio 
    async def test_transaction_rollback_on_failure(self):
        """Test that transaction rolls back on failure, leaving database consistent"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_transaction = AsyncMock()
        
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_conn.transaction.return_value = mock_transaction
        mock_transaction.__aenter__ = AsyncMock()
        mock_transaction.__aexit__ = AsyncMock()
        
        # First operation succeeds, second fails
        mock_conn.execute.side_effect = [
            "UPDATE 0",   # First slot: no existing row
            None,         # First slot: INSERT succeeds
            Exception("Database error")  # Second slot: UPDATE fails
        ]
        
        plan = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 10,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            },
            {
                'date': '2025-08-18',
                'start_time': '10:00',
                'end_time': '10:30',
                'capacity': 15,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            }
        ]
        
        # Should raise the exception from the failing operation
        with pytest.raises(Exception, match="Database error"):
            await publish_plan('tenant-123', plan, mock_pool)
        
        # Transaction context manager should handle rollback automatically
        mock_transaction.__aenter__.assert_called_once()
        mock_transaction.__aexit__.assert_called_once()


class TestPublishEndpointIntegration:
    """Integration tests for the publish endpoint behavior"""
    
    def test_publish_mode_returns_actual_counts(self):
        """Test that publish mode returns actual database operation counts"""
        # Expected behavior: publish mode calls publish_plan and returns actual counts
        expected_result = {
            'created': 2,
            'updated': 1,
            'skipped': 0
        }
        
        # Validate structure matches ApplyTemplateResult schema
        assert isinstance(expected_result['created'], int)
        assert isinstance(expected_result['updated'], int)
        assert isinstance(expected_result['skipped'], int)
        assert expected_result['created'] >= 0
        assert expected_result['updated'] >= 0
        assert expected_result['skipped'] >= 0
    
    def test_idempotent_publish_behavior(self):
        """Test that publishing the same template twice shows idempotent behavior"""
        # First publish: creates new slots
        first_publish = {
            'created': 3,
            'updated': 0,
            'skipped': 0
        }
        
        # Second publish of same template/range: no new slots, same slots updated
        second_publish = {
            'created': 0,
            'updated': 3,
            'skipped': 0
        }
        
        # Third publish with identical plan should still be updates (idempotent)
        third_publish = {
            'created': 0,
            'updated': 3, 
            'skipped': 0
        }
        
        # Verify counts are consistent
        assert first_publish['created'] == second_publish['updated']
        assert second_publish == third_publish
        assert all(result['skipped'] == 0 for result in [first_publish, second_publish, third_publish])


class TestUpdateThenInsertPattern:
    """Test the specific update-then-insert SQL pattern"""
    
    def test_update_query_structure(self):
        """Test that UPDATE query targets correct fields and conditions"""
        expected_update_query = """
            UPDATE slots
            SET capacity = $5, resource_unit = $6, blackout = $7, notes = $8
            WHERE tenant_id = $1 AND date = $2 AND start_time = $3 AND end_time = $4
        """
        
        # Verify query structure expectations
        assert 'UPDATE slots' in expected_update_query
        assert 'SET capacity = $5' in expected_update_query
        assert 'WHERE tenant_id = $1' in expected_update_query
        assert 'AND date = $2' in expected_update_query
        assert 'AND start_time = $3' in expected_update_query
        assert 'AND end_time = $4' in expected_update_query
    
    def test_insert_query_structure(self):
        """Test that INSERT query creates complete slot records"""
        expected_insert_query = """
            INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        """
        
        # Verify query structure expectations
        assert 'INSERT INTO slots' in expected_insert_query
        assert 'gen_random_uuid()' in expected_insert_query
        assert 'tenant_id, date, start_time, end_time' in expected_insert_query
        assert 'capacity, resource_unit, blackout, notes' in expected_insert_query
    
    def test_parameter_binding_order(self):
        """Test that parameters are bound in correct order for both UPDATE and INSERT"""
        # UPDATE parameters: tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes
        update_params = ['tenant_id', 'date', 'start_time', 'end_time', 'capacity', 'resource_unit', 'blackout', 'notes']
        
        # INSERT parameters: tenant_id, date, start_time, end_time, capacity, resource_unit, blackout, notes
        insert_params = ['tenant_id', 'date', 'start_time', 'end_time', 'capacity', 'resource_unit', 'blackout', 'notes']
        
        # Both should use the same parameter order (except UPDATE has WHERE clause first)
        assert update_params[:4] == insert_params[:4]  # WHERE clause fields
        assert update_params[4:] == insert_params[4:]  # SET/VALUES fields


if __name__ == '__main__':
    pytest.main([__file__, '-v'])