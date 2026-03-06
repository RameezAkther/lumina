# app/services/weather_service.py
import httpx
import datetime
import numpy as np

def normalize_name(name):
    remove_words = ["Region", "State", "Province", "Division"]
    
    for word in remove_words:
        name = name.replace(word, "").strip()
        
    return name

# --- 1. GEOCODING (Text -> Lat/Lon) ---
async def get_coordinates(country: str, state: str, district: str, area: str = ""):
    """
    Uses OpenStreetMap Nominatim API to get coordinates.
    """
    # Construct query string (more specific first)
    state = normalize_name(state)
    query_parts = [p for p in [area, district, state, country] if p]
    query = ", ".join(query_parts)
    print(f"Geocoding query: {query}")
    
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "limit": 1
    }
    # Nominatim requires a User-Agent identifying the app
    headers = {"User-Agent": "LuminaSolarApp/1.0"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params, headers=headers)
            data = resp.json()
            
            if data and len(data) > 0:
                print(f"Geocoding result: {data[0]['display_name']} (Lat: {data[0]['lat']}, Lon: {data[0]['lon']})")
                return float(data[0]["lat"]), float(data[0]["lon"]), data[0]["display_name"]
            return None, None, None
        except Exception as e:
            print(f"Geocoding error: {e}")
            return None, None, None

# --- 2. NASA POWER API (Lat/Lon -> Solar Data) ---
async def fetch_nasa_solar_data(lat: float, lon: float):
    """
    Fetches monthly average GHI (Global Horizontal Irradiance) 
    for the last 5 years from NASA POWER API.
    """
    current_year = datetime.datetime.now().year
    start_year = current_year - 6 # Get last 5 full years
    end_year = current_year - 1

    base_url = "https://power.larc.nasa.gov/api/temporal/monthly/point"
    
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN", # All Sky Surface Shortwave Downward Irradiance (kWh/m^2/day)
        "community": "RE", # Renewable Energy
        "longitude": lon,
        "latitude": lat,
        "start": start_year,
        "end": end_year,
        "format": "JSON"
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(base_url, params=params)
            data = resp.json()
            
            # The data structure is properties -> parameter -> ALLSKY_SFC_SW_DWN -> { "YYYYMM": value }
            raw_data = data.get("properties", {}).get("parameter", {}).get("ALLSKY_SFC_SW_DWN", {})
            return raw_data
        except Exception as e:
            print(f"NASA API error: {e}")
            return {}

# --- 3. DATA PROCESSING ---
def calculate_historical_stats(raw_data, system_capacity_kw=1.0):
    """
    Processes NASA data to return averages, yield estimates, and sustainability metrics.
    system_capacity_kw: Calculated from roof segmentation panel count * panel capacity
    """
    if not raw_data:
        return None

    # Sustainability Constants
    CO2_FACTOR = 0.43  # kg CO2 avoided per kWh generated
    TREE_FACTOR = 22.0 # kg CO2 absorbed per tree per year

    historical_time_series = []
    monthly_agg = {k: [] for k in range(1, 13)}
    valid_monthly_values = []
    
    # Process raw data and filter out NASA anomalies
    for date_key, val in raw_data.items():
        # Filter out -999 (NASA error code for missing data)
        if val < 0: 
            continue
            
        # date_key is format "YYYYMM" (e.g., "202001")
        year = int(date_key[0:4])
        month = int(date_key[4:6])
        
        # NASA appends a 13th month representing the "Annual Average". We must skip it.
        if month == 13: 
            continue
            
        historical_time_series.append({
            "year": year, 
            "month": month, 
            "ghi": val
        })
        monthly_agg[month].append(val)
        valid_monthly_values.append(val)
    
    if not valid_monthly_values:
        return None

    # 1. Core Mathematical Averages
    avg_daily_ghi = np.mean(valid_monthly_values) # kWh/m2/day
    pr = 0.75 # Performance Ratio (system losses)

    # 2. Yield Calculations
    annual_generation_kwh = avg_daily_ghi * 365 * system_capacity_kw * pr
    specific_yield = avg_daily_ghi * 365 * pr
    variability = "Low" if np.std(valid_monthly_values) < 0.5 else "Moderate"

    # 3. Sustainability Metrics
    co2_saved_kg = annual_generation_kwh * CO2_FACTOR
    trees_equivalent = co2_saved_kg / TREE_FACTOR

    # 4. Monthly Distribution (for a typical 12-month bar chart)
    monthly_averages = []
    for m in range(1, 13):
        avg_ghi = np.mean(monthly_agg[m]) if monthly_agg[m] else 0
        days_in_month = 30.44 # Avg days
        monthly_kwh = avg_ghi * days_in_month * system_capacity_kw * pr
        monthly_averages.append(round(monthly_kwh, 1))

    return {
        "summary": {
            "ghi": round(avg_daily_ghi, 2),
            "annual_yield_kwh": round(annual_generation_kwh, 0),
            "specific_yield": round(specific_yield, 0),
            "variability": variability,
            "co2_saved_kg": round(co2_saved_kg, 2),
            "trees_planted_equiv": round(trees_equivalent, 1)
        },
        "monthly_chart_data": monthly_averages,
        "raw_historical_data": historical_time_series
    }