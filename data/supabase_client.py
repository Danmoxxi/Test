from datetime import date

import pandas as pd
from supabase import create_client, Client

from config import (
    SUPABASE_URL,
    SUPABASE_KEY,
    RESERVATIONS_TABLE,
    COLUMN_MAP,
    CONFIRMED_STATUSES,
)


def get_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in .env"
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_reservations(days_ahead: int = 90) -> pd.DataFrame:
    """
    Fetch confirmed reservations with check-in from today onward.

    Returns a DataFrame with normalised column names (matching COLUMN_MAP keys).
    An empty DataFrame is returned if no data is found.
    """
    client = get_client()
    today = date.today().isoformat()
    col = COLUMN_MAP

    response = (
        client.table(RESERVATIONS_TABLE)
        .select("*")
        .gte(col["check_in"], today)
        .execute()
    )

    if not response.data:
        return pd.DataFrame()

    df = pd.DataFrame(response.data)

    # Rename source columns to canonical names
    rename = {v: k for k, v in col.items() if v in df.columns}
    df = df.rename(columns=rename)

    # Parse dates
    for date_col in ("check_in", "check_out", "created_at"):
        if date_col in df.columns:
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce")

    # Keep only confirmed bookings
    if "status" in df.columns:
        df = df[df["status"].isin(CONFIRMED_STATUSES)]

    return df.reset_index(drop=True)


def fetch_schema() -> list[str]:
    """Return the column names present in the reservations table."""
    client = get_client()
    response = (
        client.table(RESERVATIONS_TABLE)
        .select("*")
        .limit(1)
        .execute()
    )
    if response.data:
        return list(response.data[0].keys())
    return []
