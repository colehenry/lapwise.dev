"""
Track Length Population Script

Populates track_length_km field for circuits in the database.
Since FastF1 and public F1 APIs don't provide track length data,
this script uses a hardcoded dictionary of known circuit lengths.

Requirements:
    - PYTHONPATH must include backend directory

Usage:
    PYTHONPATH=$PWD python scripts/populate_track_lengths.py
"""

import asyncio
from app.database import get_db
from app.models import Circuit
from sqlalchemy import select

# Lengths in km
TRACK_LENGTHS = {
    "Melbourne": 5.278,
    "Albert Park": 5.278,
    "Shanghai": 5.451,
    "Suzuka": 5.807,
    "Sakhir": 5.412,
    "Bahrain": 5.412,
    "Jeddah": 6.174,
    "Miami Gardens": 5.412,
    "Miami": 5.412,
    "Imola": 4.909,
    "Monaco": 3.337,
    "Monte Carlo": 3.337,
    "Barcelona": 4.657,
    "Montréal": 4.361,
    "Montreal": 4.361,
    "Spielberg": 4.318,
    "Silverstone": 5.891,
    "Spa-Francorchamps": 7.004,
    "Spa": 7.004,
    "Budapest": 4.381,
    "Zandvoort": 4.259,
    "Monza": 5.793,
    "Baku": 6.003,
    "Marina Bay": 4.940,
    "Singapore": 4.940,
    "Austin": 5.513,
    "Mexico City": 4.304,
    "São Paulo": 4.309,
    "Interlagos": 4.309,
    "Las Vegas": 6.201,
    "Lusail": 5.419,
    "Losail": 5.419,
    "Yas Island": 5.281,
    "Yas Marina": 5.281,
    "Le Castellet": 5.842,
    "Paul Ricard": 5.842,
    "Portimão": 4.653,
    "Portimao": 4.653,
    "Istanbul": 5.338,
    "Mugello": 5.245,
    "Nürburgring": 5.148,
    "Hockenheim": 4.574,
    "Sochi": 5.848,
}

async def main():
    print("Populating track length data...")
    async for session in get_db():
        result = await session.execute(select(Circuit))
        circuits = result.scalars().all()
        
        updated_count = 0
        for circuit in circuits:
            # Try exact match
            length = TRACK_LENGTHS.get(circuit.name)
            
            # Try partial/fuzzy match if needed (manual aliases handled in dict)
            if not length:
                # Special cases
                if "Red Bull Ring" in circuit.name:
                    length = 4.318
                elif "Hermanos Rodriguez" in circuit.name:
                    length = 4.304
                elif "Villeneuve" in circuit.name:
                    length = 4.361
            
            if length:
                circuit.track_length_km = length
                updated_count += 1
                print(f"✅ Updated {circuit.name} to {length} km")
            else:
                print(f"⚠️ No data for {circuit.name}")
        
        await session.commit()
        print(f"\nSuccessfully updated {updated_count}/{len(circuits)} circuits.")
        break

if __name__ == "__main__":
    asyncio.run(main())
