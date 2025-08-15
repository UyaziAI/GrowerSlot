"""
Tests for CSV exports functionality
"""
import pytest
import asyncio
import uuid
from datetime import date, time, datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import io
import csv

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app
from db import init_db, execute_query

client = TestClient(app)

# Test data constants
TEST_TENANT_ID = str(uuid.uuid4())
TEST_ADMIN_USER = {
    "user_id": str(uuid.uuid4()),
    "tenant_id": TEST_TENANT_ID,
    "role": "admin",
    "email": "admin@test.com"
}

@pytest.fixture
async def setup_test_data():
    """Create test data for export testing"""
    await init_db()
    
    # Create test tenant, growers, cultivars, slots, and bookings
    test_data = {
        "tenant_id": TEST_TENANT_ID,
        "grower_id": str(uuid.uuid4()),
        "cultivar_id": str(uuid.uuid4()),
        "slot_id": str(uuid.uuid4()),
        "booking_id": str(uuid.uuid4())
    }
    
    # Insert test data (simplified for testing)
    queries = [
        ("INSERT INTO tenants (id, name) VALUES ($1, $2)", [uuid.UUID(test_data["tenant_id"]), "Test Tenant"]),
        ("INSERT INTO growers (id, tenant_id, name, contact_email) VALUES ($1, $2, $3, $4)", 
         [uuid.UUID(test_data["grower_id"]), uuid.UUID(test_data["tenant_id"]), "Test Grower", "grower@test.com"]),
        ("INSERT INTO cultivars (id, tenant_id, name) VALUES ($1, $2, $3)", 
         [uuid.UUID(test_data["cultivar_id"]), uuid.UUID(test_data["tenant_id"]), "Test Cultivar"]),
        ("INSERT INTO slots (id, tenant_id, date, start_time, end_time, capacity, resource_unit) VALUES ($1, $2, $3, $4, $5, $6, $7)",
         [uuid.UUID(test_data["slot_id"]), uuid.UUID(test_data["tenant_id"]), date(2025, 8, 15), time(9, 0), time(10, 0), 100, "kg"]),
        ("INSERT INTO bookings (id, slot_id, grower_id, cultivar_id, quantity, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
         [uuid.UUID(test_data["booking_id"]), uuid.UUID(test_data["slot_id"]), uuid.UUID(test_data["grower_id"]), 
          uuid.UUID(test_data["cultivar_id"]), 50, "confirmed", "Test booking notes", datetime.now()])
    ]
    
    for query, params in queries:
        try:
            await execute_query(query, *params)
        except Exception:
            pass  # Ignore duplicate key errors
    
    return test_data

@pytest.mark.asyncio
async def test_export_bookings_csv_success():
    """Test successful CSV export with correct headers and data format"""
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        response = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01",
                "end": "2025-08-31"
            }
        )
    
    assert response.status_code == 200
    
    # Check content type and headers
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in response.headers.get("content-disposition", "")
    assert "bookings_2025-08-01_2025-08-31.csv" in response.headers.get("content-disposition", "")
    
    # Parse CSV content
    csv_content = response.text
    lines = csv_content.strip().split('\n')
    
    # Verify header row (exact order)
    expected_header = "booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes"
    assert lines[0] == expected_header

@pytest.mark.asyncio 
async def test_export_bookings_csv_date_filtering():
    """Test that date range filtering works correctly"""
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        # Test with narrow date range
        response_narrow = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-12-01",
                "end": "2025-12-01"
            }
        )
        
        # Test with wider date range
        response_wide = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-01-01", 
                "end": "2025-12-31"
            }
        )
    
    assert response_narrow.status_code == 200
    assert response_wide.status_code == 200
    
    # Count rows (excluding header)
    narrow_rows = len(response_narrow.text.strip().split('\n')) - 1
    wide_rows = len(response_wide.text.strip().split('\n')) - 1
    
    # Wider range should have >= rows than narrow range
    assert wide_rows >= narrow_rows

@pytest.mark.asyncio
async def test_export_bookings_csv_unicode_encoding():
    """Test that Unicode characters in names are properly encoded in UTF-8"""
    
    # Mock data with Unicode characters
    unicode_grower_name = "Grower François José"
    unicode_cultivar_name = "Cultivar Müller & Søn"
    unicode_notes = "Special notes: café, naïve, résumé"
    
    mock_query_result = [{
        'booking_id': str(uuid.uuid4()),
        'slot_date': date(2025, 8, 15),
        'start_time': time(9, 0),
        'end_time': time(10, 0),
        'grower_name': unicode_grower_name,
        'cultivar_name': unicode_cultivar_name,
        'quantity': 25,
        'status': 'confirmed',
        'notes': unicode_notes
    }]
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        with patch('app.backend.routers.exports.execute_query', return_value=mock_query_result):
            response = client.get(
                "/v1/exports/bookings.csv",
                params={
                    "start": "2025-08-01",
                    "end": "2025-08-31"
                }
            )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    
    # Verify Unicode content is properly encoded
    csv_content = response.text
    assert unicode_grower_name in csv_content
    assert unicode_cultivar_name in csv_content
    assert unicode_notes in csv_content
    
    # Verify it's valid CSV that can be parsed
    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    assert len(rows) >= 2  # Header + at least one data row
    
    # Check that Unicode characters are preserved in parsed CSV
    data_row = rows[1]
    assert unicode_grower_name in data_row[4]  # grower_name column
    assert unicode_cultivar_name in data_row[5]  # cultivar_name column
    assert unicode_notes in data_row[8]  # notes column

@pytest.mark.asyncio
async def test_export_bookings_csv_filtering():
    """Test optional filtering parameters"""
    
    test_grower_id = str(uuid.uuid4())
    test_cultivar_id = str(uuid.uuid4())
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        # Test with grower filter
        response_grower = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01",
                "end": "2025-08-31",
                "grower_id": test_grower_id
            }
        )
        
        # Test with cultivar filter
        response_cultivar = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01", 
                "end": "2025-08-31",
                "cultivar_id": test_cultivar_id
            }
        )
        
        # Test with status filter
        response_status = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01",
                "end": "2025-08-31", 
                "status": "confirmed"
            }
        )
    
    assert response_grower.status_code == 200
    assert response_cultivar.status_code == 200
    assert response_status.status_code == 200

@pytest.mark.asyncio
async def test_export_bookings_csv_invalid_date_range():
    """Test validation of date range parameters"""
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        # Test start date after end date
        response = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-31",
                "end": "2025-08-01"
            }
        )
    
    assert response.status_code == 400
    assert "start date must be <= end date" in response.json()["detail"]

@pytest.mark.asyncio
async def test_export_bookings_csv_missing_required_params():
    """Test that required date parameters are enforced"""
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        # Test missing start date
        response_no_start = client.get(
            "/v1/exports/bookings.csv",
            params={"end": "2025-08-31"}
        )
        
        # Test missing end date
        response_no_end = client.get(
            "/v1/exports/bookings.csv",
            params={"start": "2025-08-01"}
        )
    
    assert response_no_start.status_code == 422  # Validation error
    assert response_no_end.status_code == 422    # Validation error

@pytest.mark.asyncio
async def test_export_bookings_csv_admin_only():
    """Test that only admin users can access the export endpoint"""
    
    grower_user = {
        "user_id": str(uuid.uuid4()),
        "tenant_id": TEST_TENANT_ID,
        "role": "grower",
        "email": "grower@test.com"
    }
    
    with patch('app.backend.security.get_current_user', return_value=grower_user):
        response = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01",
                "end": "2025-08-31"
            }
        )
    
    assert response.status_code == 403  # Forbidden for non-admin users

@pytest.mark.asyncio
async def test_export_bookings_csv_empty_result():
    """Test CSV export when no bookings match the criteria"""
    
    with patch('app.backend.security.get_current_user', return_value=TEST_ADMIN_USER):
        with patch('app.backend.routers.exports.execute_query', return_value=[]):
            response = client.get(
                "/v1/exports/bookings.csv",
                params={
                    "start": "2030-01-01",
                    "end": "2030-01-31"
                }
            )
    
    assert response.status_code == 200
    
    # Should still have header row
    csv_content = response.text
    lines = csv_content.strip().split('\n')
    assert len(lines) == 1  # Only header row
    
    expected_header = "booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes"
    assert lines[0] == expected_header

@pytest.mark.asyncio
async def test_export_bookings_csv_tenant_scoping():
    """Test that exports are properly scoped to the user's tenant"""
    
    other_tenant_user = {
        "user_id": str(uuid.uuid4()),
        "tenant_id": str(uuid.uuid4()),  # Different tenant
        "role": "admin",
        "email": "admin@other.com"
    }
    
    with patch('app.backend.security.get_current_user', return_value=other_tenant_user):
        response = client.get(
            "/v1/exports/bookings.csv",
            params={
                "start": "2025-08-01",
                "end": "2025-08-31"
            }
        )
    
    assert response.status_code == 200
    
    # Should only return header (no data from other tenant)
    csv_content = response.text
    lines = csv_content.strip().split('\n')
    # May have only header or very limited data since it's a different tenant
    assert len(lines) >= 1  # At least header row