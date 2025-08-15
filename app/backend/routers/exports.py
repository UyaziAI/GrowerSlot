"""
CSV Export router - handles data export functionality
"""
import csv
import io
from datetime import date
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
import uuid
from ..db import execute_query
from ..security import require_role

router = APIRouter()

@router.get("/bookings.csv")
async def export_bookings_csv(
    start: date = Query(..., description="Start date (inclusive) in YYYY-MM-DD format"),
    end: date = Query(..., description="End date (inclusive) in YYYY-MM-DD format"),
    grower_id: Optional[str] = Query(None, description="Filter by grower ID"),
    cultivar_id: Optional[str] = Query(None, description="Filter by cultivar ID"),
    status: Optional[str] = Query(None, description="Filter by booking status"),
    current_user: dict = Depends(require_role("admin"))
):
    """
    Export bookings as CSV with filtering options.
    
    Returns a streaming CSV response with exact column order:
    booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes
    """
    tenant_id = current_user["tenant_id"]
    
    # Validate date range
    if start > end:
        raise HTTPException(status_code=400, detail="start date must be <= end date")
    
    # Build dynamic query with filters
    query_parts = ["""
        SELECT DISTINCT
            b.id as booking_id,
            s.date as slot_date,
            s.start_time,
            s.end_time,
            g.name as grower_name,
            c.name as cultivar_name,
            b.quantity,
            b.status,
            b.notes
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN growers g ON b.grower_id = g.id
        JOIN cultivars c ON b.cultivar_id = c.id
        WHERE s.tenant_id = $1
        AND s.date >= $2
        AND s.date <= $3
    """]
    
    params = [uuid.UUID(tenant_id), start, end]
    param_count = 3
    
    # Add optional filters
    if grower_id:
        param_count += 1
        query_parts.append(f"AND b.grower_id = ${param_count}")
        params.append(uuid.UUID(grower_id))
    
    if cultivar_id:
        param_count += 1
        query_parts.append(f"AND b.cultivar_id = ${param_count}")
        params.append(uuid.UUID(cultivar_id))
    
    if status:
        param_count += 1
        query_parts.append(f"AND b.status = ${param_count}")
        params.append(status)
    
    # Order by date and time for consistent output
    query_parts.append("ORDER BY s.date, s.start_time, b.created_at")
    
    final_query = "\n".join(query_parts)
    
    # Generate filename with date range
    filename = f"bookings_{start.strftime('%Y-%m-%d')}_{end.strftime('%Y-%m-%d')}.csv"
    
    async def generate_csv() -> AsyncGenerator[str, None]:
        """Generate CSV content as streaming response"""
        # Create CSV header - exact order as specified
        header_row = "booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes\n"
        yield header_row
        
        try:
            # Execute query and stream results
            rows = await execute_query(final_query, *params)
            
            for row in rows:
                # Create CSV output buffer
                output = io.StringIO()
                writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
                
                # Format row data with proper CSV escaping
                csv_row = [
                    str(row['booking_id']),
                    row['slot_date'].strftime('%Y-%m-%d'),
                    str(row['start_time']),
                    str(row['end_time']),
                    row['grower_name'] or '',
                    row['cultivar_name'] or '',
                    str(row['quantity']) if row['quantity'] is not None else '',
                    row['status'] or '',
                    row['notes'] or ''
                ]
                
                writer.writerow(csv_row)
                output.seek(0)
                yield output.read()
                
        except Exception as e:
            # Log error and provide fallback
            error_row = f"# Error generating CSV: {str(e)}\n"
            yield error_row
    
    # Return streaming response with proper headers
    return StreamingResponse(
        generate_csv(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )