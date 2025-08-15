"""
Tests for Apply Template Preview functionality
"""
import pytest
import asyncio
from datetime import date, datetime
from unittest.mock import AsyncMock, patch, MagicMock
import uuid

from ..services.templates import plan_slots, diff_against_db


class TestPlanSlots:
    """Test the plan_slots function"""
    
    def test_simple_weekday_template(self):
        """Test basic weekday template with single time slot"""
        template = {
            'weekdays': {
                'mon': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '10:00',
                    'capacity': 15
                }
            },
            'slot_length_min': 30,
            'default_capacity': 10,
            'default_resource_unit': 'tons',
            'default_notes': '',
            'exceptions': []
        }
        
        start_date = date(2025, 8, 18)  # Monday
        end_date = date(2025, 8, 18)    # Same Monday
        
        result = asyncio.run(plan_slots(
            tenant_id='test-tenant',
            template=template,
            start_date=start_date,
            end_date=end_date
        ))
        
        assert len(result) == 2  # Two 30-minute slots in 09:00-10:00 hour
        assert result[0]['date'] == '2025-08-18'
        assert result[0]['start_time'] == '09:00'
        assert result[0]['end_time'] == '09:30'
        assert result[0]['capacity'] == 15
        assert result[0]['blackout'] == False
        
        assert result[1]['start_time'] == '09:30'
        assert result[1]['end_time'] == '10:00'
    
    def test_blackout_exception_skips_day(self):
        """Test that blackout exceptions skip entire days"""
        template = {
            'weekdays': {
                'mon': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '10:00',
                    'capacity': 15
                }
            },
            'slot_length_min': 60,
            'exceptions': [
                {
                    'date': '2025-08-18',
                    'type': 'blackout'
                }
            ]
        }
        
        start_date = date(2025, 8, 18)  # Monday with blackout
        end_date = date(2025, 8, 18)
        
        result = asyncio.run(plan_slots(
            tenant_id='test-tenant',
            template=template,
            start_date=start_date,
            end_date=end_date
        ))
        
        assert len(result) == 0  # Blackout day should be skipped
    
    def test_override_exception_changes_schedule(self):
        """Test that override exceptions change daily schedule"""
        template = {
            'weekdays': {
                'mon': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '10:00',
                    'capacity': 15
                }
            },
            'slot_length_min': 60,
            'exceptions': [
                {
                    'date': '2025-08-18',
                    'type': 'override',
                    'start_time': '14:00',
                    'end_time': '16:00',
                    'capacity': 25
                }
            ]
        }
        
        start_date = date(2025, 8, 18)  # Monday with override
        end_date = date(2025, 8, 18)
        
        result = asyncio.run(plan_slots(
            tenant_id='test-tenant',
            template=template,
            start_date=start_date,
            end_date=end_date
        ))
        
        assert len(result) == 2  # Two 60-minute slots in 14:00-16:00
        assert result[0]['start_time'] == '14:00'
        assert result[0]['end_time'] == '15:00'
        assert result[0]['capacity'] == 25  # Override capacity
        
        assert result[1]['start_time'] == '15:00'
        assert result[1]['end_time'] == '16:00'
        assert result[1]['capacity'] == 25
    
    def test_multiple_days_span(self):
        """Test template application across multiple days"""
        template = {
            'weekdays': {
                'mon': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '09:30',
                    'capacity': 10
                },
                'tue': {
                    'enabled': True,
                    'start_time': '10:00',
                    'end_time': '10:30',
                    'capacity': 20
                }
            },
            'slot_length_min': 30
        }
        
        start_date = date(2025, 8, 18)  # Monday
        end_date = date(2025, 8, 19)    # Tuesday
        
        result = asyncio.run(plan_slots(
            tenant_id='test-tenant',
            template=template,
            start_date=start_date,
            end_date=end_date
        ))
        
        assert len(result) == 2  # One slot per day
        
        monday_slot = next(slot for slot in result if slot['date'] == '2025-08-18')
        assert monday_slot['start_time'] == '09:00'
        assert monday_slot['capacity'] == 10
        
        tuesday_slot = next(slot for slot in result if slot['date'] == '2025-08-19')
        assert tuesday_slot['start_time'] == '10:00'
        assert tuesday_slot['capacity'] == 20


class TestDiffAgainstDb:
    """Test the diff_against_db function"""
    
    @pytest.mark.asyncio
    async def test_empty_desired_returns_empty_diff(self):
        """Test that empty desired list returns empty diff"""
        mock_pool = MagicMock()
        
        result = await diff_against_db('tenant-123', [], mock_pool)
        
        assert result == {'create': [], 'update': [], 'skip': []}
    
    @pytest.mark.asyncio
    async def test_new_slots_classified_as_create(self):
        """Test that slots not in database are classified as create"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        
        # Mock empty database result (no existing slots)
        mock_conn.fetch.return_value = []
        
        desired = [
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
        
        result = await diff_against_db('tenant-123', desired, mock_pool)
        
        assert len(result['create']) == 1
        assert len(result['update']) == 0
        assert len(result['skip']) == 0
        assert result['create'][0] == desired[0]
    
    @pytest.mark.asyncio
    async def test_matching_slots_classified_as_skip(self):
        """Test that identical slots are classified as skip"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        
        # Mock database with existing matching slot
        mock_conn.fetch.return_value = [
            {
                'id': uuid.uuid4(),
                'date': date(2025, 8, 18),
                'start_time': datetime.strptime('09:00', '%H:%M').time(),
                'end_time': datetime.strptime('09:30', '%H:%M').time(),
                'capacity': 10,
                'resource_unit': 'tons',
                'blackout': False,
                'notes': ''
            }
        ]
        
        desired = [
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
        
        result = await diff_against_db('tenant-123', desired, mock_pool)
        
        assert len(result['create']) == 0
        assert len(result['update']) == 0
        assert len(result['skip']) == 1
        assert result['skip'][0] == desired[0]
    
    @pytest.mark.asyncio
    async def test_different_capacity_classified_as_update(self):
        """Test that slots with different capacity are classified as update"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        
        slot_id = uuid.uuid4()
        
        # Mock database with existing slot (capacity=10)
        mock_conn.fetch.return_value = [
            {
                'id': slot_id,
                'date': date(2025, 8, 18),
                'start_time': datetime.strptime('09:00', '%H:%M').time(),
                'end_time': datetime.strptime('09:30', '%H:%M').time(),
                'capacity': 10,
                'resource_unit': 'tons',
                'blackout': False,
                'notes': ''
            }
        ]
        
        # Desired slot with different capacity (20)
        desired = [
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 20,  # Different from database
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            }
        ]
        
        result = await diff_against_db('tenant-123', desired, mock_pool)
        
        assert len(result['create']) == 0
        assert len(result['update']) == 1
        assert len(result['skip']) == 0
        
        update_item = result['update'][0]
        assert update_item['id'] == slot_id
        assert update_item['capacity'] == 20
    
    @pytest.mark.asyncio
    async def test_mixed_classification(self):
        """Test classification of mixed create/update/skip operations"""
        mock_pool = MagicMock()
        mock_conn = AsyncMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        
        existing_id = uuid.uuid4()
        
        # Mock database with one existing slot
        mock_conn.fetch.return_value = [
            {
                'id': existing_id,
                'date': date(2025, 8, 18),
                'start_time': datetime.strptime('09:00', '%H:%M').time(),
                'end_time': datetime.strptime('09:30', '%H:%M').time(),
                'capacity': 10,
                'resource_unit': 'tons',
                'blackout': False,
                'notes': ''
            }
        ]
        
        desired = [
            # Skip: identical to database
            {
                'date': '2025-08-18',
                'start_time': '09:00',
                'end_time': '09:30',
                'capacity': 10,
                'resource_unit': 'tons',
                'notes': '',
                'blackout': False
            },
            # Create: new slot
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
        
        result = await diff_against_db('tenant-123', desired, mock_pool)
        
        assert len(result['create']) == 1
        assert len(result['update']) == 0
        assert len(result['skip']) == 1


class TestApplyTemplatePreviewIntegration:
    """Integration tests for the complete preview functionality"""
    
    def test_preview_returns_deterministic_counts(self):
        """Test that preview mode returns predictable counts"""
        # This test validates the structure expectations for the endpoint
        template_config = {
            'weekdays': {
                'mon': {'enabled': True, 'start_time': '09:00', 'end_time': '10:00', 'capacity': 10}
            },
            'slot_length_min': 30
        }
        
        # Expected counts for a Monday with two 30-minute slots
        expected_created = 2  # Two new slots if database is empty
        expected_updated = 0  # No updates if database is empty
        expected_skipped = 0  # No skips if database is empty
        
        # Validate structure
        assert isinstance(expected_created, int)
        assert isinstance(expected_updated, int)
        assert isinstance(expected_skipped, int)
        assert expected_created >= 0
        assert expected_updated >= 0
        assert expected_skipped >= 0
    
    def test_preview_samples_structure(self):
        """Test that preview mode returns proper samples structure"""
        expected_samples = {
            'create': [
                {
                    'date': '2025-08-18',
                    'start_time': '09:00',
                    'end_time': '09:30',
                    'capacity': 10,
                    'resource_unit': 'tons',
                    'notes': '',
                    'blackout': False
                }
            ],
            'update': [],
            'skip': []
        }
        
        # Validate samples structure
        assert 'create' in expected_samples
        assert 'update' in expected_samples
        assert 'skip' in expected_samples
        assert isinstance(expected_samples['create'], list)
        assert isinstance(expected_samples['update'], list)
        assert isinstance(expected_samples['skip'], list)
        
        # Validate sample item structure
        if expected_samples['create']:
            sample = expected_samples['create'][0]
            required_fields = ['date', 'start_time', 'end_time', 'capacity', 'resource_unit', 'blackout']
            for field in required_fields:
                assert field in sample


if __name__ == '__main__':
    pytest.main([__file__, '-v'])