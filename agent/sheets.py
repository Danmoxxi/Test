from datetime import date

import gspread
import pandas as pd
from google.oauth2.service_account import Credentials

from config import GOOGLE_SERVICE_ACCOUNT_FILE, GOOGLE_SHEET_ID

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_HEADERS = [
    "Property ID",
    "Property Name",
    "Occ 7d",
    "Occ 14d",
    "Occ 30d",
    "Occ 60d",
    "Occ 90d",
    "Occ 30d vs Portfolio",
    "ADR ($)",
    "Avg Lead Time (days)",
    "Next Check-in",
    "Action",
    "Urgency",
    "Rate Change %",
    "Date Range Focus",
    "Reasoning",
    "Status",   # Human fills in: Approved / Rejected
    "Notes",    # Human comments
]


def _open_sheet() -> gspread.Spreadsheet:
    creds = Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_FILE, scopes=_SCOPES
    )
    gc = gspread.authorize(creds)
    return gc.open_by_key(GOOGLE_SHEET_ID)


def _pct(val) -> str:
    return f"{round(val * 100, 1)}%" if val is not None else ""


def _delta(val) -> str:
    if val is None:
        return ""
    sign = "+" if val >= 0 else ""
    return f"{sign}{round(val * 100, 1)}%"


def write_recommendations(metrics_df: pd.DataFrame, recommendations: list[dict]) -> str:
    """
    Write merged metrics + recommendations to a dated tab in the Google Sheet.
    Returns the spreadsheet URL.
    """
    sh = _open_sheet()
    tab_name = f"Recs {date.today().isoformat()}"

    try:
        ws = sh.worksheet(tab_name)
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=tab_name, rows=500, cols=len(_HEADERS))

    rec_map = {str(r["property_id"]): r for r in recommendations}

    rows = [_HEADERS]
    for _, m in metrics_df.iterrows():
        pid = str(m["property_id"])
        rec = rec_map.get(pid, {})
        rows.append([
            pid,
            m.get("property_name", ""),
            _pct(m.get("occupancy_7d")),
            _pct(m.get("occupancy_14d")),
            _pct(m.get("occupancy_30d")),
            _pct(m.get("occupancy_60d")),
            _pct(m.get("occupancy_90d")),
            _delta(m.get("occupancy_30d_vs_portfolio")),
            m.get("adr", ""),
            m.get("avg_lead_time_days", ""),
            m.get("next_check_in", ""),
            rec.get("action", ""),
            rec.get("urgency", ""),
            rec.get("recommended_change_pct", ""),
            rec.get("date_range_focus", ""),
            rec.get("reasoning", ""),
            "Pending",
            "",
        ])

    ws.update(rows)
    ws.format(f"A1:{chr(64 + len(_HEADERS))}1", {"textFormat": {"bold": True}})
    sh.batch_update({
        "requests": [{
            "updateSheetProperties": {
                "properties": {
                    "sheetId": ws.id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        }]
    })

    return f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}"


def write_schema_debug(columns: list[str]) -> None:
    """Write detected Supabase column names to a 'Schema Debug' tab."""
    sh = _open_sheet()
    try:
        ws = sh.worksheet("Schema Debug")
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title="Schema Debug", rows=100, cols=2)
    ws.update([["Detected Column"], *[[c] for c in columns]])
