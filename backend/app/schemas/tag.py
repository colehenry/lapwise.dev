"""
Tag Schemas
"""

import re

from pydantic import BaseModel, field_validator


class CreateTagRequest(BaseModel):
    name: str
    color: str
    category: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1 or len(v) > 50:
            raise ValueError("Tag name must be 1-50 characters")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Color must be a valid hex color (e.g. #EF4444)")
        return v.upper()

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"topic", "driver", "team", "season"}
            if v not in allowed:
                raise ValueError(f"Category must be one of: {', '.join(allowed)}")
        return v


class UpdateTagRequest(BaseModel):
    name: str | None = None
    color: str | None = None
    category: str | None = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Color must be a valid hex color (e.g. #EF4444)")
        return v.upper() if v else v


class TagResponse(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    category: str | None

    model_config = {"from_attributes": True}


class TagListResponse(BaseModel):
    tags: list[TagResponse]
