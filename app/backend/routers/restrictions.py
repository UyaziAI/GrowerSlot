"""
Restrictions router - handles slot restrictions
"""
from fastapi import APIRouter, Depends
import uuid

from ..db import execute_transaction
from ..security import get_current_user, require_role
from ..schemas import RestrictionApply

router = APIRouter()

@router.post("/apply")
async def apply_restrictions(
    restriction: RestrictionApply,
    current_user: dict = Depends(require_role("admin"))
):
    """Apply restrictions to slots"""
    tenant_id = current_user["tenant_id"]
    
    # Build list of restrictions to insert
    queries = []
    
    if restriction.slot_id:
        # Apply to specific slot
        slot_ids = [restriction.slot_id]
    elif restriction.restriction_date:
        # Apply to all slots on a specific date
        date_query = """
            SELECT id FROM slots WHERE tenant_id = $1 AND date = $2
        """
        from ..db import execute_query
        slots = await execute_query(date_query, uuid.UUID(tenant_id), restriction.restriction_date)
        slot_ids = [str(slot['id']) for slot in slots]
    else:
        return {"message": "Either slot_id or restriction_date must be specified"}
    
    # Create restriction records
    for slot_id in slot_ids:
        if restriction.grower_ids:
            for grower_id in restriction.grower_ids:
                query = """
                    INSERT INTO slot_restrictions (slot_id, allowed_grower_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                """
                queries.append((query, [uuid.UUID(slot_id), uuid.UUID(grower_id)]))
        
        if restriction.cultivar_ids:
            for cultivar_id in restriction.cultivar_ids:
                query = """
                    INSERT INTO slot_restrictions (slot_id, allowed_cultivar_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                """
                queries.append((query, [uuid.UUID(slot_id), uuid.UUID(cultivar_id)]))
    
    if queries:
        await execute_transaction(queries)
        return {"message": f"Applied restrictions to {len(slot_ids)} slots"}
    else:
        return {"message": "No restrictions to apply"}