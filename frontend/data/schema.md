# Destination record schema

Each entry in `destinations.json` is one domestic tourism destination in Bangladesh.
All costs and travel-related numbers are **estimates** unless a cited source says otherwise.

## Top-level fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable slug, unique across the file (e.g. `"sreemangal"`). |
| `name` | `{ en: string, bn: string }` | Display name in English and Bangla. |
| `division` | string | Administrative division (English). |
| `district` | string | Administrative district (English). |
| `lat` | number | WGS84 latitude. |
| `lng` | number | WGS84 longitude. |
| `tags` | object | Affinity scores in **0..1** (see below). |
| `dailyCost` | number | Rough BDT per person per day (estimate). |
| `costNote` | `{ low: number, high: number, rationale: string }` | Reviewable range and reasoning for `dailyCost`. |
| `minDays` | number | Minimum sensible trip length in days (≥ 1). |
| `bestMonths` | `number[]` | Preferred visit months, integers **1..12**. |
| `access` | object | Access / season / permit constraints (see below). |
| `popularityTier` | `"iconic"` \| `"hidden"` | Coarse popularity bucket. |
| `popularity` | number | Relative popularity score in **0..1**. |
| `unesco` | boolean | Whether the site (or a core part) is UNESCO-listed. |
| `summary` | `{ en: string, bn: string }` | Short destination blurb. |
| `tips` | `{ en: string, bn: string }` | Practical visitor tip. |
| `tagsReviewed` | boolean | `false` until tag scores are human-reviewed. |
| `bnReview` | boolean | `true` when Bangla strings still need proofreading (`TODO_REVIEW_BN`). |

## `tags` keys

Every key is required. Values are numbers in **0..1**:

`peaceful`, `adventure`, `cultural`, `social`, `photography`, `hiking`, `boating`, `food`, `history`, `beach`, `wildlife`, `relaxing`

## `access` object

| Field | Type | Notes |
| --- | --- | --- |
| `openMonths` | `number[]` | Months the destination is open to visitors (**1..12**). |
| `overnightMonths` | `number[]` | Months overnight stay is allowed (**1..12**). May be a subset of `openMonths`. |
| `permit` | `"none"` \| `"travel_pass"` \| `"permission_required"` | Permit posture for typical domestic visitors. |
| `maxStayHours` | `number` \| `null` | Cap on same-day stay length when overnight is not allowed; otherwise `null`. |
| `note` | `{ en: string, bn: string }` | Human-readable access caveat. Uncertain facts must include `TODO_VERIFY`. |
| `source` | string | Citation for access rules, or `"TODO_SOURCE"` if none is cited. |
| `lastVerified` | `string` \| `null` | ISO date `YYYY-MM-DD`, or `null` when `source` is `"TODO_SOURCE"`. |

## Provenance rules

- Do **not** invent sources. If access, cost, or season facts are not cited, set `access.source` to `"TODO_SOURCE"` and `access.lastVerified` to `null`, and put `TODO_VERIFY` in `access.note` where values are provisional.
- Bangla copy (`name.bn`, `summary.bn`, `tips.bn`, `access.note.bn`) that still needs proofreading must keep `"bnReview": true` on the record.
- Tag scores are first-pass judgments until reviewed; keep `"tagsReviewed": false` until then.

## Example

```json
{
  "id": "sreemangal",
  "name": { "en": "Sreemangal", "bn": "শ্রীমঙ্গল" },
  "division": "Sylhet",
  "district": "Moulvibazar",
  "lat": 24.31,
  "lng": 91.73,
  "tags": {
    "peaceful": 0.9,
    "adventure": 0.3,
    "cultural": 0.4,
    "social": 0.3,
    "photography": 0.8,
    "hiking": 0.5,
    "boating": 0.1,
    "food": 0.6,
    "history": 0.2,
    "beach": 0.0,
    "wildlife": 0.4,
    "relaxing": 0.9
  },
  "dailyCost": 1500,
  "costNote": {
    "low": 1000,
    "high": 2500,
    "rationale": "Budget guesthouse + meals; tea-garden day trips add transport."
  },
  "minDays": 2,
  "bestMonths": [10, 11, 12, 1, 2, 3],
  "access": {
    "openMonths": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "overnightMonths": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "permit": "none",
    "maxStayHours": null,
    "note": { "en": "TODO_VERIFY year-round access assumptions.", "bn": "…" },
    "source": "TODO_SOURCE",
    "lastVerified": null
  },
  "popularityTier": "iconic",
  "popularity": 0.75,
  "unesco": false,
  "summary": { "en": "…", "bn": "…" },
  "tips": { "en": "…", "bn": "…" },
  "tagsReviewed": false,
  "bnReview": true
}
```
