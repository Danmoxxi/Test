# STR Revenue Manager Agent

Automated pricing analysis and recommendations for a 180+ property Short-Term Rental portfolio.

## How it works

1. Reads confirmed reservations from your **Supabase** table (synced from Resly)
2. Computes occupancy rates, ADR, and booking lead times per property
3. Sends batches of properties to **Claude** for pricing recommendations
4. Writes a dated recommendations sheet to **Google Sheets** for human review
5. You review, approve/reject, and apply changes manually in Resly

## Setup

### 1. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- Supabase project URL and key
- Column names from your reservations table (run `--debug-schema` first if unsure)
- Anthropic API key
- Google Sheet ID and path to your service account JSON

### 3. Google Sheets service account

1. Create a service account in [Google Cloud Console](https://console.cloud.google.com/)
2. Grant it **Editor** access to your target Google Sheet
3. Download the JSON key and save it as `service_account.json` in the project root

### 4. Inspect your Supabase schema (recommended on first run)

```bash
python -m agent.main --debug-schema
```

This writes the detected column names to a **Schema Debug** tab in your sheet
so you can verify the `COL_*` mappings in `.env`.

### 5. Run the agent

```bash
python -m agent.main
```

Output is written to a new tab named `Recs YYYY-MM-DD` in your Google Sheet.

## Google Sheet columns

| Column | Description |
|---|---|
| Property ID / Name | Identifies the property |
| Occ 7d–90d | Occupancy rate for each forward-looking window |
| Occ 30d vs Portfolio | How this property compares to the portfolio average |
| ADR ($) | Average daily rate from current bookings |
| Avg Lead Time | Days between booking creation and check-in |
| Next Check-in | Date of next confirmed arrival |
| Action | INCREASE / DECREASE / HOLD |
| Urgency | HIGH / MEDIUM / LOW |
| Rate Change % | Suggested % adjustment |
| Date Range Focus | Which dates to apply the change to |
| Reasoning | Claude's data-driven explanation |
| **Status** | **You fill in: Approved / Rejected** |
| **Notes** | **Your comments** |

## File structure

```
agent/
  main.py          Entry point
  analyzer.py      Occupancy and rate metrics
  recommender.py   Claude-powered recommendations
  sheets.py        Google Sheets writer
data/
  supabase_client.py  Supabase connection
config.py          Environment-based configuration
```

## Security notes

- Never commit `.env` or `service_account.json` — both are git-ignored
- Use a **service role key** for Supabase only if anon key lacks read access
- The agent is read-only with respect to Supabase and Resly
