"""Resolved driver imagery as returned to clients."""

from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel

if TYPE_CHECKING:  # `app.services` imports schemas, so this cannot be runtime
    from app.services.media_service import MediaRef


class DriverMedia(BaseModel):
    """One resolved image plus the framing and credit a client needs.

    Nested rather than flattened alongside `headshot_url`: the focal point and
    attribution travel with every consumer, and thirteen services copying four
    loose fields is the shape this avoids.
    """

    url: str
    # CSS position percentages, not face coordinates. Render with
    # `object-fit: cover` and `object-position: <x>% <y>%`; any other crop
    # maths reinterprets values that were reviewed against these rules.
    focal_x: Optional[float] = None
    focal_y: Optional[float] = None
    attribution_text: Optional[str] = None
    license_code: Optional[str] = None
    license_url: Optional[str] = None
    # False when the URL is still a legacy upstream link rather than owned
    # storage. Lets a client tell migrated data from unmigrated.
    is_owned: bool = True

    @classmethod
    def from_ref(cls, ref: Optional["MediaRef"]) -> Optional["DriverMedia"]:
        if ref is None:
            return None
        return cls(
            url=ref.url,
            focal_x=ref.focal_x,
            focal_y=ref.focal_y,
            attribution_text=ref.attribution_text,
            license_code=ref.license_code,
            license_url=ref.license_url,
            is_owned=ref.is_owned,
        )
