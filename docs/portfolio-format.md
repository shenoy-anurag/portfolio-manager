# Portfolio Exchange Format (PEX) — v1

Versioned, lossless JSON format for exporting a user's combined portfolio from Portfolio Manager and re-importing it later, or into another instance.

- File: any name, ideally `<name>.portfolio.json`
- MIME on export: `application/json`

## Versioning

- Top-level `format` is fixed: `"portfolio-manager-portfolio"`
- `version` is an integer, currently `1`. The importer rejects files with a newer `version`.
- `exportedAt` is an ISO-8601 UTC timestamp of when the export was produced.

## Example

```jsonc
{
  "format": "portfolio-manager-portfolio",
  "version": 1,
  "exportedAt": "2026-08-01T06:00:00.000Z",
  "appVersion": "0.1.0",
  "baseCurrency": "INR",

  "instruments": [
    { "id": "instr_x", "symbol": "RELIANCE.NS", "name": "Reliance Industries",
      "assetClass": "equity", "source": "yahoo", "currency": "INR",
      "amfiCode": null, "isin": "INE002A01018", "interestRate": null },
    { "id": "instr_y", "symbol": "HDFC_FLEXI_CAP_G", "name": "HDFC Flexi Cap Fund - Direct - Growth",
      "assetClass": "mf-equity", "source": "amfi", "currency": "INR",
      "amfiCode": "118702", "isin": "INF179K01VR8", "interestRate": null },
    { "id": "instr_z", "symbol": "PPF", "name": "Public Provident Fund",
      "assetClass": "ppf", "source": "manual", "currency": "INR",
      "amfiCode": null, "isin": null, "interestRate": 7.1 }
  ],

  "accounts": [
    { "id": "acct_a", "name": "Zerodha - Main Demat", "broker": "Zerodha",
      "type": "demat", "currency": "INR", "params": {} },
    { "id": "acct_b", "name": "SBI PPF", "broker": "SBI",
      "type": "ppf", "currency": "INR", "params": { "interestRate": 7.1 } }
  ],

  "holdings": [
    { "id": "hold_1", "accountId": "acct_a", "instrumentId": "instr_x",
      "quantity": 15.5, "avgCost": 2475.3, "purchaseDate": "2024-03-12", "params": {} }
  ],

  "transactions": [
    { "id": "txn_1", "accountId": "acct_a", "instrumentId": "instr_x",
      "type": "buy", "date": "2024-03-12", "quantity": 15.5,
      "amount": 38367.15, "nav": 2475.3, "folio": null,
      "notes": "Imported from Zerodha XLSX" }
  ],

  "snapshots": [
    { "date": "2026-07-01", "totalValueInr": 1284500.5, "investedInr": 1000000.0 }
  ],

  "settings": {
    "refreshCadence": "daily",
    "refreshTime": "18:00",
    "targetAllocation": { "equity": 50, "mf-equity": 20, "mf-debt": 15, "ppf": 10, "fd": 5 }
  }
}
```

## Section Reference

### `instruments`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque ID; remapped on import |
| `symbol` | string | Natural key: Yahoo ticker (`.NS`/`.BO`/US), AMFI scheme name slug, or `PPF`/`EPFO`/`FD` |
| `name` | string | Display name |
| `assetClass` | enum | `equity`, `mf-equity`, `mf-debt`, `ppf`, `epfo`, `fd`, `us-equity`, `gold` |
| `source` | enum | `yahoo`, `amfi`, `manual` |
| `currency` | string | ISO 4217 (`INR`, `USD`) |
| `amfiCode` | string/null | AMFI scheme code for mutual funds |
| `isin` | string/null | ISIN when known |
| `interestRate` | number/null | For fixed-income instruments (PPF/EPFO/FD) |

Natural key for matching on import: `(source, symbol)`.

### `accounts`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque ID; remapped on import |
| `name` | string | Account display name |
| `broker` | string | Broker/provider label (`Zerodha`, `CAMS`, `SBI`, ...) |
| `type` | enum | `demat`, `mf`, `ppf`, `epfo`, `fd`, `us`, `cash` |
| `currency` | string | ISO 4217 |
| `params` | object | Account-specific metadata (e.g. FD principal/rate/maturity) |

Natural key for matching on import: `(broker, type, name)`.

### `holdings`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque ID; remapped on import |
| `accountId` | string | References an account (remapped) |
| `instrumentId` | string | References an instrument (remapped) |
| `quantity` | number | Units held |
| `avgCost` | number | Average cost basis (in `instrument.currency`) |
| `purchaseDate` | string/null | ISO date (`YYYY-MM-DD`) |
| `params` | object | Extras (e.g. FD maturity date) |

### `transactions`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque ID; remapped on import |
| `accountId` | string | References an account (remapped) |
| `instrumentId` | string | References an instrument (remapped) |
| `type` | enum | `buy`, `sell`, `sip`, `dividend` |
| `date` | string | ISO date `YYYY-MM-DD` |
| `quantity` | number/null | Units traded |
| `amount` | number/null | Net amount in account currency |
| `nav` | number/null | Execution price / NAV |
| `folio` | string/null | MF folio number |
| `notes` | string/null | Free text |

### `snapshots` (optional)
| Field | Type | Notes |
|---|---|---|
| `date` | string | ISO date `YYYY-MM-DD` |
| `totalValueInr` | number | Net worth in INR on that date |
| `investedInr` | number | Total invested (cost basis) in INR on that date |

### `settings` (optional)
| Field | Type | Notes |
|---|---|---|
| `refreshCadence` | enum | `daily`, `1m`, `5m`, `15m`, `hourly` |
| `refreshTime` | string | `HH:mm` 24h IST time for daily refresh |
| `targetAllocation` | object | `assetClass → %` target weights |

## Import Semantics

1. Validate against the PEX v1 JSON schema (zod). Reject unknown `version > 1`.
2. Match/upsert instruments and accounts by natural key; create if missing. Remap all cross-references (`accountId`, `instrumentId`) through the remap tables.
3. Upsert holdings, transactions, snapshots.
4. Apply settings (never overwrites secrets; `OPENAI_API_KEY` is never exported).
5. Return an import report: counts of added / updated / skipped per section.

The import is **idempotent** — re-importing the same file does not create duplicates.

## Guarantees

- `OPENAI_API_KEY` and any credentials are **never** included in exports.
- The format is lossless: exporting then importing into an empty instance reproduces the same portfolio.
- `settings` and `snapshots` are optional on input; defaults apply when omitted.
