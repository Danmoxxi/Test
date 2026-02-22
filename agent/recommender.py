import json

import anthropic
import pandas as pd

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, BATCH_SIZE, OCCUPANCY_WINDOWS

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_SYSTEM_PROMPT = """\
You are an expert STR (Short-Term Rental) revenue manager with deep experience \
in dynamic pricing across large property portfolios.

You will receive occupancy and rate metrics for a batch of properties and must \
produce a clear, data-driven pricing recommendation for each one.

For every property output a JSON object with exactly these fields:
  property_id            – string, copied from input
  action                 – "INCREASE" | "DECREASE" | "HOLD"
  urgency                – "HIGH" | "MEDIUM" | "LOW"
  recommended_change_pct – integer (e.g. 10 for +10 %, -15 for -15 %, 0 for hold)
  date_range_focus       – string describing which dates to adjust (e.g. "Next 14 days")
  reasoning              – 2–3 sentences, specific and data-driven

Respond with a valid JSON array of these objects — one per property, in the same \
order as the input. No prose before or after the JSON array.\
"""


def _format_batch(batch: list[dict]) -> str:
    lines: list[str] = []
    for p in batch:
        name = p.get("property_name") or p.get("property_id", "Unknown")
        lines.append(f"Property: {name}  (ID: {p['property_id']})")
        for w in OCCUPANCY_WINDOWS:
            key = f"occupancy_{w}d"
            vs_key = f"{key}_vs_portfolio"
            occ = p.get(key)
            if occ is not None:
                vs_val = p.get(vs_key)
                vs_str = ""
                if vs_val is not None:
                    sign = "+" if vs_val >= 0 else ""
                    vs_str = f"  ({sign}{round(vs_val * 100, 1)}% vs portfolio avg)"
                lines.append(f"  Occupancy {w}d : {round(occ * 100, 1)}%{vs_str}")
        if p.get("adr") is not None:
            lines.append(f"  ADR           : ${p['adr']}")
        if p.get("avg_lead_time_days") is not None:
            lines.append(f"  Avg lead time : {p['avg_lead_time_days']} days")
        if p.get("next_check_in"):
            lines.append(f"  Next check-in : {p['next_check_in']}")
        lines.append("")
    return "\n".join(lines)


def _fallback(prop: dict) -> dict:
    return {
        "property_id": prop["property_id"],
        "action": "HOLD",
        "urgency": "LOW",
        "recommended_change_pct": 0,
        "date_range_focus": "N/A",
        "reasoning": "Recommendation could not be generated — review manually.",
    }


def generate_recommendations(metrics_df: pd.DataFrame) -> list[dict]:
    """
    Generate pricing recommendations for all properties via Claude.

    Properties are sent in batches of BATCH_SIZE to manage API cost and
    latency. Returns a flat list of recommendation dicts, one per property.
    """
    records = metrics_df.to_dict("records")
    recommendations: list[dict] = []

    for batch_start in range(0, len(records), BATCH_SIZE):
        batch = records[batch_start : batch_start + BATCH_SIZE]
        batch_end = batch_start + len(batch)
        print(f"  Generating recommendations for properties {batch_start + 1}–{batch_end}...")

        prompt = _format_batch(batch)

        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            batch_recs = json.loads(raw)
            if not isinstance(batch_recs, list):
                raise ValueError("Expected a JSON array")
            recommendations.extend(batch_recs)
        except (json.JSONDecodeError, ValueError) as exc:
            print(f"  Warning: parse error for batch {batch_start // BATCH_SIZE + 1}: {exc}")
            recommendations.extend(_fallback(p) for p in batch)

    return recommendations
