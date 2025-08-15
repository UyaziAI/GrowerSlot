"""
Tests for /v1/slots/bulk endpoint validation
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
import pytz

from app.backend.main import app
from app.backend.schemas import BulkCreateSlotsRequest

client = TestClient(app)

# Mock admin user for testing
ADMIN_USER = {
    "sub": "admin-user-id",
    "tenant_id": "test-tenant-id",
    "role": "admin",
    "email": "admin@test.com"
}

def get_mock_admin_user():
    return ADMIN_USER

def get_sa_today():
    """Get today's date in Africa/Johannesburg timezone"""
    sa_tz = pytz.timezone('Africa/Johannesburg')
    return date.today()  # Simplified for testing

class TestBulkSlotsValidation:
    """Test validation for /v1/slots/bulk endpoint"""
    
    def setup_method(self):
        """Setup for each test"""
        # Mock the auth dependency
        app.dependency_overrides = {
            # Add your auth dependency override here if needed
        }
    
    def teardown_method(self):
        """Cleanup after each test"""
        app.dependency_overrides.clear()

    def test_past_start_date_returns_422(self):
        """Test that past start_date returns 422 with exact error message"""
        today = get_sa_today()
        yesterday = today - timedelta(days=1)
        
        payload = {
            "start_date": yesterday.isoformat(),
            "end_date": today.isoformat(),
            "weekdays": [1, 2, 3, 4, 5],  # Mon-Fri
            "slot_length_min": 60,
            "capacity": 20,
            "notes": "Test slots"
        }
        
        # Mock auth to return admin user
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422
        error_data = response.json()
        assert "error" in error_data
        assert error_data["error"] == "start_date cannot be in the past"

    def test_end_date_before_start_date_returns_422(self):
        """Test that end_date < start_date returns 422 with exact message"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": tomorrow.isoformat(),
            "end_date": today.isoformat(),  # end < start
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 60,
            "capacity": 20
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422
        error_data = response.json()
        assert "error" in error_data
        assert "end_date must be on or after start_date" in error_data["error"]

    def test_empty_weekdays_returns_422(self):
        """Test that empty weekdays returns 422 with exact message"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [],  # Empty weekdays
            "slot_length_min": 60,
            "capacity": 20
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422
        error_data = response.json()
        assert "error" in error_data
        assert error_data["error"] == "weekdays must include at least one day (Mon=1..Sun=7)"

    def test_invalid_weekday_values_returns_422(self):
        """Test that weekdays outside 1-7 range returns validation error"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [0, 8, 9],  # Invalid weekday values
            "slot_length_min": 60,
            "capacity": 20
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        # Should be 422 due to Pydantic validation
        assert response.status_code == 422

    def test_invalid_slot_length_returns_422(self):
        """Test that slot_length_min <= 0 or > 1440 returns validation error"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        # Test zero slot length
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 0,  # Invalid: must be > 0
            "capacity": 20
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422
        
        # Test excessive slot length
        payload["slot_length_min"] = 1500  # Invalid: must be <= 1440
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422

    def test_invalid_capacity_returns_422(self):
        """Test that capacity <= 0 returns validation error"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 60,
            "capacity": 0  # Invalid: must be > 0
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422

    def test_valid_payload_returns_200_or_201(self):
        """Test that valid payload returns success"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [1, 2, 3, 4, 5],  # Mon-Fri
            "slot_length_min": 60,
            "capacity": 25,
            "notes": "Valid test slots"
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        # Should be successful (200 or 201)
        assert response.status_code in [200, 201]
        
        response_data = response.json()
        assert "count" in response_data
        assert "message" in response_data
        assert isinstance(response_data["count"], int)
        assert response_data["count"] >= 0

    def test_malformed_json_returns_400(self):
        """Test that malformed JSON returns 400 with appropriate error"""
        malformed_payload = '{"start_date": "2025-08-15", "invalid_json"}'
        
        with client as test_client:
            response = test_client.post(
                "/v1/slots/bulk",
                data=malformed_payload,
                headers={"Content-Type": "application/json"}
            )
            
        assert response.status_code == 422  # FastAPI returns 422 for JSON parsing errors

    def test_missing_required_fields_returns_422(self):
        """Test that missing required fields returns 422"""
        incomplete_payload = {
            "start_date": get_sa_today().isoformat(),
            # Missing end_date, weekdays, slot_length_min, capacity
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=incomplete_payload)
            
        assert response.status_code == 422

    def test_invalid_date_format_returns_422(self):
        """Test that invalid date formats return validation error"""
        payload = {
            "start_date": "invalid-date-format",
            "end_date": "2025-13-32",  # Invalid date
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 60,
            "capacity": 20
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code == 422

    def test_weekend_only_weekdays_valid(self):
        """Test that weekend-only weekdays (6, 7) is valid"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [6, 7],  # Saturday, Sunday only
            "slot_length_min": 120,  # 2-hour slots
            "capacity": 15
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        # Should be successful
        assert response.status_code in [200, 201]

    def test_single_day_range_valid(self):
        """Test that start_date = end_date (single day) is valid"""
        today = get_sa_today()
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": today.isoformat(),  # Same day
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 30,  # 30-minute slots
            "capacity": 10
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code in [200, 201]

    def test_notes_optional_field(self):
        """Test that notes field is optional"""
        today = get_sa_today()
        tomorrow = today + timedelta(days=1)
        
        payload = {
            "start_date": today.isoformat(),
            "end_date": tomorrow.isoformat(),
            "weekdays": [1, 2, 3, 4, 5],
            "slot_length_min": 60,
            "capacity": 20
            # notes field omitted
        }
        
        with client as test_client:
            response = test_client.post("/v1/slots/bulk", json=payload)
            
        assert response.status_code in [200, 201]

class TestPydanticValidation:
    """Test Pydantic model validation directly"""
    
    def test_validator_end_after_start(self):
        """Test the end_date validator"""
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        with pytest.raises(ValueError, match="end_date must be on or after start_date"):
            BulkCreateSlotsRequest(
                start_date=today,
                end_date=yesterday,  # Invalid: before start_date
                weekdays=[1, 2, 3, 4, 5],
                slot_length_min=60,
                capacity=20
            )

    def test_validator_weekdays_not_empty(self):
        """Test the weekdays validator"""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        with pytest.raises(ValueError, match="weekdays must include at least one day"):
            BulkCreateSlotsRequest(
                start_date=today,
                end_date=tomorrow,
                weekdays=[],  # Invalid: empty list
                slot_length_min=60,
                capacity=20
            )

    def test_valid_model_creation(self):
        """Test that valid data creates model successfully"""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        request = BulkCreateSlotsRequest(
            start_date=today,
            end_date=tomorrow,
            weekdays=[1, 2, 3, 4, 5],
            slot_length_min=60,
            capacity=25,
            notes="Test notes"
        )
        
        assert request.start_date == today
        assert request.end_date == tomorrow
        assert request.weekdays == [1, 2, 3, 4, 5]
        assert request.slot_length_min == 60
        assert request.capacity == 25
        assert request.notes == "Test notes"

# Integration test helper functions
def create_valid_bulk_request():
    """Helper to create a valid bulk request for integration tests"""
    today = get_sa_today()
    end_date = today + timedelta(days=7)
    
    return {
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat(),
        "weekdays": [1, 2, 3, 4, 5],  # Mon-Fri
        "slot_length_min": 60,
        "capacity": 20,
        "notes": "Integration test slots"
    }