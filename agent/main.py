#!/usr/bin/env python3
"""
STR Revenue Manager Agent — MVP

Reads confirmed reservations from Supabase (sourced from Resly), computes
per-property occupancy and rate metrics, generates pricing recommendations
via Claude, and writes results to a Google Sheet for human review.

Usage:
    python -m agent.main                  # Run full analysis
    python -m agent.main --debug-schema   # Inspect Supabase column names
"""

import sys
from datetime import date

from agent.analyzer import analyze_portfolio
from agent.recommender import generate_recommendations
from agent.sheets import write_recommendations, write_schema_debug
from config import (
    ANTHROPIC_API_KEY,
    GOOGLE_SERVICE_ACCOUNT_FILE,
    GOOGLE_SHEET_ID,
    SUPABASE_KEY,
    SUPABASE_URL,
)
from data.supabase_client import fetch_reservations, fetch_schema


def _check_config() -> None:
    missing = [
        name
        for name, val in [
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_KEY", SUPABASE_KEY),
            ("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY),
            ("GOOGLE_SHEET_ID", GOOGLE_SHEET_ID),
        ]
        if not val
    ]
    if missing:
        print(f"Error: missing required environment variables: {', '.join(missing)}")
        print("Copy .env.example to .env and fill in the values.")
        sys.exit(1)


def main() -> None:
    print("=== STR Revenue Manager Agent ===")
    print(f"Date: {date.today().isoformat()}\n")

    _check_config()

    # ── Schema debug mode ─────────────────────────────────
    if "--debug-schema" in sys.argv:
        print("Fetching Supabase schema...")
        columns = fetch_schema()
        if not columns:
            print("No data found in reservations table.")
            sys.exit(1)
        print(f"Detected columns ({len(columns)}): {columns}")
        write_schema_debug(columns)
        print("Written to 'Schema Debug' tab in Google Sheets.")
        return

    # ── Step 1: Fetch reservations ────────────────────────
    print("Fetching reservations from Supabase...")
    reservations = fetch_reservations(days_ahead=90)

    if reservations.empty:
        print(
            "No reservations found. Check RESERVATIONS_TABLE and column mapping in .env."
        )
        sys.exit(1)

    print(f"  {len(reservations)} confirmed reservations loaded.")

    # ── Step 2: Analyse portfolio ─────────────────────────
    print("Analysing portfolio metrics...")
    metrics = analyze_portfolio(reservations)
    print(f"  {len(metrics)} properties analysed.")

    # ── Step 3: Generate recommendations ─────────────────
    print(f"Generating recommendations via Claude ({GOOGLE_SERVICE_ACCOUNT_FILE})...")
    recommendations = generate_recommendations(metrics)
    print(f"  {len(recommendations)} recommendations generated.")

    # ── Step 4: Write to Google Sheets ────────────────────
    print("Writing to Google Sheets...")
    sheet_url = write_recommendations(metrics, recommendations)

    print(f"\nDone. Review recommendations at:\n  {sheet_url}")
    print("\nNext steps:")
    print("  1. Open the sheet and review each property recommendation.")
    print("  2. Set the 'Status' column to Approved or Rejected.")
    print("  3. Add any notes in the 'Notes' column.")
    print("  4. Apply approved rate changes manually in Resly.")


if __name__ == "__main__":
    main()
