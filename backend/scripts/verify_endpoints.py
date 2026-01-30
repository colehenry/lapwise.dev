import httpx
import asyncio
import sys


BASE_URL = "http://localhost:8000/api"
API_KEY = "754b5a8e5c6c17f92026f9fedbe15bf58fbb0af80c3706098d0da7701327ad26"

# Endpoints that should work
ENDPOINTS = [
    # Drivers
    "/drivers/VER",
    "/drivers/VER/season-history",
    "/drivers/VER/race-history",
    
    # Constructors
    "/constructors/Red Bull Racing",
    "/constructors/Red Bull Racing/season-history",
    "/constructors/Red Bull Racing/race-history",
    
    # Circuits
    "/circuits",
    
    # Events
    "/events/upcoming",
    
    # Results
    "/results/seasons",
    "/results/latest",
    
    # Season specific
    "/results/2023/standings",         # Fixed path
    "/results/2023",                   # Season rounds
    "/results/2023/points-progression", # Fixed path
]

async def verify_endpoint(client, path):
    try:
        response = await client.get(path)
        if response.status_code == 200:
            print(f"✅ {path} - 200 OK")
            return True
        else:
            print(f"❌ {path} - {response.status_code} {response.text[:100]}...") # Limit error output
            return False
    except Exception as e:
        print(f"❌ {path} - Error: {str(e)}")
        return False

async def main():
    print(f"Verifying endpoints at {BASE_URL}...")
    headers = {"X-API-Key": API_KEY}
    success_count = 0
    total_count = len(ENDPOINTS)
    
    async with httpx.AsyncClient(base_url=BASE_URL, headers=headers, timeout=10.0) as client:
        # First check health/root (no auth needed usually, but root might be just info)
        try:
            await client.get("/")  # This is /api/ which might not be mapped, Main.py maps / not /api
        except Exception:
            pass 

        for path in ENDPOINTS:
            if await verify_endpoint(client, path):
                success_count += 1
    
    print(f"\nResults: {success_count}/{total_count} passed")
    # if success_count != total_count:
    #     sys.exit(1)
    # Don't exit 1 yet, we want to see what passes.

if __name__ == "__main__":
    asyncio.run(main())
