from datetime import date, timedelta

import pandas as pd

from config import OCCUPANCY_WINDOWS


def _occupied_nights(prop_df: pd.DataFrame, start: date, end: date) -> int:
    """Count unique occupied nights for one property between start (inclusive) and end (exclusive)."""
    occupied: set[date] = set()
    for _, row in prop_df.iterrows():
        ci = row["check_in"].date() if pd.notna(row.get("check_in")) else None
        co = row["check_out"].date() if pd.notna(row.get("check_out")) else None
        if ci and co:
            day = max(ci, start)
            while day < min(co, end):
                occupied.add(day)
                day += timedelta(days=1)
    return len(occupied)


def analyze_portfolio(reservations: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-property revenue metrics across all occupancy windows.

    Returns one row per property with occupancy rates, ADR, lead time,
    and vs-portfolio deltas.
    """
    if reservations.empty:
        return pd.DataFrame()

    today = date.today()
    results = []

    for prop_id, prop_df in reservations.groupby("property_id"):
        prop_df = prop_df.copy()

        row: dict = {
            "property_id": prop_id,
            "property_name": (
                prop_df["property_name"].iloc[0]
                if "property_name" in prop_df.columns
                else str(prop_id)
            ),
            "total_bookings": len(prop_df),
        }

        # Occupancy rate per analysis window
        for window in OCCUPANCY_WINDOWS:
            end = today + timedelta(days=window)
            occ = _occupied_nights(prop_df, today, end)
            row[f"occupancy_{window}d"] = round(occ / window, 4)

        # Average daily rate
        if "nightly_rate" in prop_df.columns:
            rates = pd.to_numeric(prop_df["nightly_rate"], errors="coerce").dropna()
            row["adr"] = round(rates.mean(), 2) if not rates.empty else None
        elif "total_amount" in prop_df.columns and "nights" in prop_df.columns:
            derived = (
                pd.to_numeric(prop_df["total_amount"], errors="coerce")
                / pd.to_numeric(prop_df["nights"], errors="coerce")
            ).dropna()
            row["adr"] = round(derived.mean(), 2) if not derived.empty else None
        else:
            row["adr"] = None

        # Average booking lead time (days between created_at and check_in)
        if "created_at" in prop_df.columns and "check_in" in prop_df.columns:
            lead = (prop_df["check_in"] - prop_df["created_at"]).dt.days.dropna()
            row["avg_lead_time_days"] = round(lead.mean(), 1) if not lead.empty else None
        else:
            row["avg_lead_time_days"] = None

        # Nearest upcoming check-in
        future = prop_df[prop_df["check_in"].dt.date >= today]
        row["next_check_in"] = (
            future["check_in"].min().date().isoformat() if not future.empty else None
        )

        results.append(row)

    df = pd.DataFrame(results)

    # Add vs-portfolio delta for each occupancy window
    for window in OCCUPANCY_WINDOWS:
        col = f"occupancy_{window}d"
        if col in df.columns:
            portfolio_avg = df[col].mean()
            df[f"{col}_vs_portfolio"] = (df[col] - portfolio_avg).round(4)

    return df.reset_index(drop=True)
