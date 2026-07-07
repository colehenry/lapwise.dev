from sqlalchemy import select, or_, func
from app.models import Circuit


def ingest_circuit(db, event):
    """
    Ingest circuit if it doesn't exist.

    Returns: circuit_id
    """
    circuit_name = event.get("Location")
    location = event.get("Location")
    country = event.get("Country")

    # 1. Exact name match.
    circuit = db.execute(
        select(Circuit).where(Circuit.name == circuit_name)
    ).scalar_one_or_none()

    # 2. Same country, matching on name or location fields in either direction.
    #    Catches FastF1 label changes (e.g. "Monaco" → "Monte Carlo").
    if circuit is None and country:
        circuit = db.execute(
            select(Circuit).where(
                Circuit.country == country,
                or_(
                    Circuit.location == circuit_name,
                    Circuit.name == location,
                    Circuit.location == location,
                    Circuit.name == circuit_name,
                ),
            )
        ).scalar_one_or_none()

    # 3. If a country has exactly one circuit and nothing matched, it must be the
    #    same venue under a different label (micro-states, single-venue countries).
    if circuit is None and country:
        all_in_country = (
            db.execute(select(Circuit).where(Circuit.country == country))
            .scalars()
            .all()
        )
        if len(all_in_country) == 1:
            circuit = all_in_country[0]

    if circuit:
        print(f"  ✓ Circuit exists: {circuit.name}")
        return circuit.id

    print(f"  + Creating circuit: {circuit_name}")
    circuit = Circuit(
        name=circuit_name,
        location=location,
        country=country,
        track_length_km=None,
    )
    db.add(circuit)
    db.commit()
    db.refresh(circuit)
    return circuit.id
