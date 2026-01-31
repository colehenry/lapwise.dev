
from sqlalchemy import select
from app.models import Circuit

def ingest_circuit(db, event):
    """
    Ingest circuit if it doesn't exist.

    Returns: circuit_id
    """
    circuit_name = event.get(
        "Location"
    )  # Circuit location (e.g., "Bahrain International Circuit")
    location = event.get("Location")
    country = event.get("Country")

    # Check if circuit exists by name
    circuit = db.execute(
        select(Circuit).where(Circuit.name == circuit_name)
    ).scalar_one_or_none()

    if circuit:
        print(f"  ✓ Circuit exists: {circuit_name}")
        return circuit.id
    else:
        print(f"  + Creating circuit: {circuit_name}")
        circuit = Circuit(
            name=circuit_name,
            location=location,
            country=country,
            track_length_km=None,  # FastF1 doesn't provide this directly
        )
        db.add(circuit)
        db.commit()
        db.refresh(circuit)
        return circuit.id
