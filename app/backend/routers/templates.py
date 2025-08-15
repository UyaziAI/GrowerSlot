from fastapi import APIRouter, Depends
from ..schemas import TemplateIn, TemplateOut, ApplyTemplateRequest, ApplyTemplateResult

router = APIRouter(prefix="/v1/admin/templates", tags=["templates"])

def get_tenant_id():
    # replace with real dependency later
    return "TENANT_PLACEHOLDER"

@router.get("", response_model=list[TemplateOut])
def list_templates(tenant_id: str = Depends(get_tenant_id)):
    return []

@router.post("", response_model=TemplateOut)
def create_template(payload: TemplateIn, tenant_id: str = Depends(get_tenant_id)):
    return {"id":"TEMPLATE_PLACEHOLDER","tenant_id":tenant_id, **payload.dict()}

@router.patch("/{tpl_id}", response_model=TemplateOut)
def update_template(tpl_id: str, payload: TemplateIn, tenant_id: str = Depends(get_tenant_id)):
    return {"id":tpl_id,"tenant_id":tenant_id, **payload.dict()}

@router.delete("/{tpl_id}")
def delete_template(tpl_id: str, tenant_id: str = Depends(get_tenant_id)):
    return {"ok": True}