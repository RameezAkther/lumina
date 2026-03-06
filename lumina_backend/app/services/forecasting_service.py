# app/services/forecasting_service.py
import httpx
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ExpSineSquared, WhiteKernel


# --- GLOBAL BASE DEFAULTS (USD) ---
BASE_USD_COST_PER_PANEL = 250.0
BASE_USD_ELECTRICITY_RATE = 0.15
BASE_USD_SYSTEM_COST = 5000.0

async def get_localized_defaults(country_name: str) -> dict:
    """
    Determines the local currency for a given country and converts standard USD 
    base prices to the local equivalent using live exchange rates.
    """
    target_currency = "USD"
    exchange_rate = 1.0

    async with httpx.AsyncClient() as client:
        try:
            # 1. Get Currency Code for the given Country
            if country_name and country_name.lower() not in ["united states", "usa", "us"]:
                country_res = await client.get(f"https://restcountries.com/v3.1/name/{country_name}")
                if country_res.status_code == 200:
                    country_data = country_res.json()[0]
                    currencies = country_data.get("currencies", {})
                    if currencies:
                        target_currency = list(currencies.keys())[0] # e.g., "NZD"

            # 2. Get Live Exchange Rate from USD to Target Currency
            if target_currency != "USD":
                rates_res = await client.get("https://open.er-api.com/v6/latest/USD")
                if rates_res.status_code == 200:
                    rates_data = rates_res.json()
                    exchange_rate = rates_data.get("rates", {}).get(target_currency, 1.0)
                    
        except Exception as e:
            print(f"Warning: Localization failed, defaulting to USD. Error: {e}")

    return {
        "currency": target_currency,
        "cost_per_panel": round(BASE_USD_COST_PER_PANEL * exchange_rate, 2),
        "electricity_rate": round(BASE_USD_ELECTRICITY_RATE * exchange_rate, 3),
        "system_cost": round(BASE_USD_SYSTEM_COST * exchange_rate, 2),
    }

# --- 1. NOVEL PROBABILISTIC FORECASTING (IEEE-Worthy Component) ---
def forecast_ghi_probabilistic_gpr(historical_ghi_list, forecast_months=12):
    """
    Uses Gaussian Process Regression with a composite kernel to forecast 
    future GHI with uncertainty bounds (P50, P10, P90).
    
    historical_ghi_list: List of chronologically ordered monthly GHI values (e.g., 60 months)
    """
    if len(historical_ghi_list) < 24:
        raise ValueError("Need at least 24 months of historical data to capture seasonality.")

    # Prepare data for GPR
    X_train = np.arange(len(historical_ghi_list)).reshape(-1, 1)
    y_train = np.array(historical_ghi_list)

    # Define composite kernel
    # 1. ExpSineSquared captures the 12-month seasonality
    # 2. RBF captures long-term climate trends/drift
    # 3. WhiteKernel captures random weather noise
    kernel = (
        1.0 * ExpSineSquared(length_scale=1.0, periodicity=12.0) * RBF(length_scale=50.0)
        + WhiteKernel(noise_level=0.1)
    )

    gpr = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5, normalize_y=True)
    gpr.fit(X_train, y_train)

    # Predict future months
    X_future = np.arange(len(historical_ghi_list), len(historical_ghi_list) + forecast_months).reshape(-1, 1)
    y_pred_mean, y_pred_std = gpr.predict(X_future, return_std=True)

    # Calculate P-values based on Normal Distribution
    # P50 (Expected), P90 (Conservative/Bankable, 90% chance to exceed), P10 (Optimistic)
    forecasts = []
    for i in range(forecast_months):
        mean_val = max(0, y_pred_mean[i]) # Prevent negative solar radiation
        std_val = y_pred_std[i]
        
        forecasts.append({
            "month_offset": i + 1,
            "P50_expected": round(mean_val, 2),
            "P90_conservative": round(max(0, mean_val - 1.28 * std_val), 2),
            "P10_optimistic": round(mean_val + 1.28 * std_val, 2),
            "uncertainty_std": round(std_val, 3)
        })

    return forecasts

# --- 2. LIFETIME GENERATION WITH DEGRADATION ---
def predict_lifetime_generation(first_year_yield_kwh, lifespan_years=25, degradation_rate=0.006):
    """
    Predicts yearly generation over the system's lifespan factoring in panel degradation.
    Standard degradation is ~0.6% (0.006) per year.
    """
    lifetime_projection = []
    cumulative_yield = 0
    
    for year in range(1, lifespan_years + 1):
        # Y_t = Y_0 * (1 - d)^(t-1)
        current_year_yield = first_year_yield_kwh * ((1 - degradation_rate) ** (year - 1))
        cumulative_yield += current_year_yield
        
        lifetime_projection.append({
            "year": year,
            "projected_kwh": round(current_year_yield, 1)
        })
        
    return lifetime_projection, round(cumulative_yield, 1)

async def convert_currency_values(from_currency: str, to_currency: str, values: dict) -> dict:
    """
    Fetches the live exchange rate and converts the frontend input values.
    """
    if from_currency == to_currency:
        return values
        
    exchange_rate = 1.0
    async with httpx.AsyncClient() as client:
        try:
            # Fetch exchange rate from the base currency
            rates_res = await client.get(f"https://open.er-api.com/v6/latest/{from_currency}")
            if rates_res.status_code == 200:
                rates_data = rates_res.json()
                exchange_rate = rates_data.get("rates", {}).get(to_currency, 1.0)
        except Exception as e:
            print(f"Warning: Currency conversion failed. Error: {e}")

    return {
        "system_cost": round(values.get("system_cost", 0) * exchange_rate, 2),
        "electricity_rate": round(values.get("electricity_rate", 0) * exchange_rate, 3),
        "cost_per_panel": round(values.get("cost_per_panel", 0) * exchange_rate, 2),
        "currency": to_currency
    }

# --- 3. FINANCIAL SAVINGS FORECAST ---
def predict_financial_savings(lifetime_projection, current_electricity_rate=0.15, grid_inflation_rate=0.03):
    """
    Calculates expected financial savings over the lifespan, accounting for grid inflation.
    Includes cumulative savings and carries over the projected_kwh for frontend graphing.
    """
    lifetime_savings = []
    cumulative_savings = 0
    
    for data in lifetime_projection:
        year = data["year"]
        yield_kwh = data["projected_kwh"]
        
        # Future electricity rate = Rate * (1 + inflation)^(year-1)
        future_rate = current_electricity_rate * ((1 + grid_inflation_rate) ** (year - 1))
        yearly_savings = yield_kwh * future_rate
        cumulative_savings += yearly_savings
        
        lifetime_savings.append({
            "year": year,
            "projected_kwh": yield_kwh, # Added for Lifetime Generation Chart
            "yearly_savings": round(yearly_savings, 2),
            "cumulative_savings": round(cumulative_savings, 2), # Added for ROI Chart
            "electricity_rate_projected": round(future_rate, 3)
        })
        
    return lifetime_savings, round(cumulative_savings, 2)

# --- 4. PAYBACK PERIOD CALCULATOR ---
def calculate_payback_period(lifetime_savings, system_cost):
    """
    Calculates the exact year and month the system breaks even.
    """
    cumulative = 0
    for data in lifetime_savings:
        # lifetime_savings entries use 'yearly_savings' and 'cumulative_savings'
        yearly = data.get("yearly_savings", 0)
        cumulative += yearly

        if cumulative >= system_cost:
            previous_cumulative = cumulative - yearly
            remaining_cost = system_cost - previous_cumulative

            # Guard against division by zero
            if yearly <= 0:
                return None

            fraction_of_year = remaining_cost / yearly
            payback_years = data.get("year", 1) - 1 + fraction_of_year
            return round(payback_years, 1)

    return None  # System does not pay for itself within lifespan

# --- 5. MASTER ORCHESTRATOR FUNCTION ---
def generate_advanced_solar_report(historical_ghi_list, system_capacity_kw, system_cost, electricity_rate, currency="USD"):
    """
    Ties all functions together to generate the frontend payload.
    """
    pr = 0.75 # Performance Ratio
    
    # 1. GPR Probabilistic Forecast for the next 12 months
    gpr_forecasts = forecast_ghi_probabilistic_gpr(historical_ghi_list, forecast_months=12)
    
    # Sum the P50 and P90 expected GHI for the first year
    first_year_p50_ghi = sum([f["P50_expected"] for f in gpr_forecasts]) / 12
    first_year_p90_ghi = sum([f["P90_conservative"] for f in gpr_forecasts]) / 12
    
    # 2. Calculate initial annual yield based on P50 (kWh = GHI * 365 * kW * PR)
    p50_annual_yield = first_year_p50_ghi * 365 * system_capacity_kw * pr
    p90_annual_yield = first_year_p90_ghi * 365 * system_capacity_kw * pr
    
    # 3. Lifetime Projections (using P50 as standard)
    lifetime_gen, total_lifetime_kwh = predict_lifetime_generation(p50_annual_yield)
    lifetime_savings, total_savings = predict_financial_savings(lifetime_gen, current_electricity_rate=electricity_rate)
    
    # 4. ROI / Payback
    payback_years = calculate_payback_period(lifetime_savings, system_cost)
    
    return {
        "currency": currency,
        "advanced_metrics": {
            "first_year_yield_p50_kwh": round(p50_annual_yield, 0),
            "first_year_yield_p90_kwh": round(p90_annual_yield, 0), # Bankable yield
            "lifetime_yield_kwh": total_lifetime_kwh,
            "total_estimated_savings": total_savings,
            "payback_period_years": payback_years
        },
        "next_12_months_probabilistic_forecast": gpr_forecasts,
        "lifetime_financial_projection": lifetime_savings
    }