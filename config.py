import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ──────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RESERVATIONS_TABLE = os.getenv("RESERVATIONS_TABLE", "reservations")

# Column name mapping for the Resly-sourced reservations table.
# Override any of these via .env if your actual column names differ.
COLUMN_MAP = {
    "property_id":   os.getenv("COL_PROPERTY_ID",   "property_id"),
    "property_name": os.getenv("COL_PROPERTY_NAME",  "property_name"),
    "check_in":      os.getenv("COL_CHECK_IN",       "check_in"),
    "check_out":     os.getenv("COL_CHECK_OUT",      "check_out"),
    "status":        os.getenv("COL_STATUS",         "status"),
    "nightly_rate":  os.getenv("COL_NIGHTLY_RATE",   "nightly_rate"),
    "total_amount":  os.getenv("COL_TOTAL_AMOUNT",   "total_amount"),
    "nights":        os.getenv("COL_NIGHTS",         "nights"),
    "created_at":    os.getenv("COL_CREATED_AT",     "created_at"),
    "source":        os.getenv("COL_SOURCE",         "source"),
}

# Statuses that count as confirmed/active bookings
CONFIRMED_STATUSES = os.getenv(
    "CONFIRMED_STATUSES", "confirmed,checked_in,checked_out"
).split(",")

# ── Anthropic ─────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-opus-4-6"

# Number of properties to send per Claude API call (controls cost vs. latency)
BATCH_SIZE = 20

# ── Google Sheets ─────────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

# ── Analysis parameters ───────────────────────────────────
OCCUPANCY_WINDOWS = [7, 14, 30, 60, 90]  # days ahead to measure occupancy

# Thresholds for occupancy-based pricing signals
LOW_OCCUPANCY_THRESHOLD  = 0.40  # below 40% → consider decreasing price
HIGH_OCCUPANCY_THRESHOLD = 0.80  # above 80% → consider increasing price
