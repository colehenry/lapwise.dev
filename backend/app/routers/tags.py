"""
Tags Router

Endpoints for tag management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_admin
from app.database import get_db
from app.models.user import User
from app.schemas.tag import (
    CreateTagRequest,
    TagListResponse,
    TagResponse,
    UpdateTagRequest,
)
from app.security import verify_api_key
from app.services.tag_service import TagService

router = APIRouter()


@router.get("", response_model=TagListResponse)
async def list_tags(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_api_key),
):
    tags = await TagService.get_all_tags(db)
    return {"tags": tags}


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: CreateTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        tag = await TagService.create_tag(
            db,
            name=data.name,
            color=data.color,
            category=data.category,
            created_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: int,
    data: UpdateTagRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    tag = await TagService.update_tag(
        db,
        tag_id,
        name=data.name,
        color=data.color,
        category=data.category,
    )
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    deleted = await TagService.delete_tag(db, tag_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tag not found")
