# PROJECT.md

# Taxi Fleet Tracking REST API — Plan

## 1. Overview & Assumptions

A REST API for a Sri Lankan taxi company to track its fleet. The API models the geographic hierarchy (province → district → station), the vehicles assigned to home stations, and the transient GPS pings each vehicle emits. Vehicles are the central resource; pings give a vehicle's last known position; the home station is a static attribute.

### Assumptions

- Country context is Sri Lanka; the seed data already reflects this (Western province, Colombo district, etc.).
- IDs remain numeric (existing routes depend on this) but each entity gets a human-readable `slug` for readability and as a stable external reference.
- A ping is an immutable, append-only log entry. It is not the vehicle's "current" location — the **latest ping by timestamp** is. Pings are never updated or deleted; only inserted.
- `vehicle.station_id` is the vehicle's **home/base station** (a static roster attribute). It does not change per ping. If assignment changes, it's an update to `vehicles`, not to a ping.
- No trip booking, driver, dispatch, reporting, or billing features in scope — only the existing five entities, refined and documented.
- Storage: **SQLite** via `better-sqlite3`, replacing the current `seed.json` read approach. The seed file is retained only as a one-time bootstrap source.
- Auth: a single API key checked by Express middleware (read scope for all endpoints in this phase; a write-scoped key for ping ingestion is deferred — see Open Items §8).
- Uniform JSON error envelope on all failures.
- Express 5 (already a dependency), ES modules (`"type": "module"`), Node 20+.
- External JSON uses **snake_case** field names (matches existing routes: `vehicle_id`, `registration_number`, `last_ping`). Internal columns mirror this, so no translation layer is needed.
- Timestamps stored and exchanged as ISO 8601 UTC text (e.g. `2023-10-01T06:19:00Z`).

## 2. Data Model

### 2.1 Entities & Relationships

```
province 1 ──── N district
district 1 ──── N station
station  1 ──── N vehicle      (vehicle.station_id -> station.id)
vehicle  1 ──── N ping        (ping.vehicle_id -> vehicle.id)
```

A vehicle has exactly one home station. A station belongs to one district, which belongs to one province. A ping belongs to exactly one vehicle.

### 2.2 Schema (SQLite DDL)

```sql
CREATE TABLE provinces (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,        -- e.g. "western"
  name  TEXT NOT NULL                 -- e.g. "Western"
);

CREATE TABLE districts (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE, -- e.g. "colombo"
  name         TEXT NOT NULL,
  province_id  INTEGER NOT NULL REFERENCES provinces(id)
);

CREATE TABLE stations (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE, -- e.g. "colombo-fort"
  name        TEXT NOT NULL,
  district_id INTEGER NOT NULL REFERENCES districts(id)
);

CREATE TABLE vehicles (
  id                  INTEGER PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,   -- derived from reg_number, e.g. "sp-pb-8475"
  registration_number TEXT NOT NULL UNIQUE,
  device_id           TEXT NOT NULL UNIQUE,   -- the GPS tracker hardware id
  station_id          INTEGER NOT NULL REFERENCES stations(id)
);

CREATE TABLE pings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  speed      REAL DEFAULT 0,
  timestamp  TEXT NOT NULL                       -- ISO 8601 UTC; indexed for last-position queries
);
CREATE INDEX idx_pings_vehicle_ts ON pings(vehicle_id, timestamp DESC);
```

### 2.3 Schema Notes

- `slug` is lowercase, hyphenated, derived from `name` (provinces/districts/stations) or `registration_number` (vehicles). Kept unique and used in URIs as an alias; the numeric id is still accepted on every lookup endpoint.
- `pings.speed` is added (the existing `last-position` route already returns `speed ?? 0`). Defaults to 0 when missing in legacy seed.
- Timestamps stored as ISO 8601 text (`TEXT`) for lexicographic sortability and JSON-friendly output.
- `pings.id` is `AUTOINCREMENT` since pings are inserted at runtime and we do not rely on seed ids for them.
- No soft-delete columns in this phase; nothing is deleted.

## 3. Routes

All API routes are prefixed with `/api/v1` (URI versioning via path). Auth via `X-API-Key` header (middleware).

The existing unversioned routes (`/vehicles`, `/provinces`, etc.) remain for backward compatibility during the transition, delegating to the same handlers as `/api/v1`.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/v1/provinces` | List provinces |
| GET  | `/api/v1/provinces/:idOrSlug` | One province (embeds its districts) |
| GET  | `/api/v1/districts` | List districts; `?province_id=` filter |
| GET  | `/api/v1/districts/:idOrSlug` | One district (embeds province summary) |
| GET  | `/api/v1/stations` | List stations; `?district_id=` filter |
| GET  | `/api/v1/stations/:idOrSlug` | One station (embeds district + province chain) |
| GET  | `/api/v1/vehicles` | List vehicles; `?station_id=`, `?page=`, `?limit=` |
| GET  | `/api/v1/vehicles/:idOrSlug` | Vehicle composite — includes `home_station` and `last_ping` |
| GET  | `/api/v1/vehicles/:idOrSlug/pings` | Pings for a vehicle; `?since=`, `?until=`, `?limit=` |
| GET  | `/api/v1/vehicles/:idOrSlug/last-position` | Latest ping summary for vehicle |
| POST | `/api/v1/vehicles/:idOrSlug/pings` | Ingest a new ping; body: `latitude`, `longitude`, `speed?`, `timestamp?`. Returns created ping with `201`. |

### 3.1 Why no CRUD on provinces/districts/stations/vehicles

Scope is "model existing." Geographic and vehicle records are managed out of band for this phase. Only ping ingestion (a write path) is added, because pings are inherently transient/event-driven and the existing GET routes already assume pings exist. Adding vehicle/station CRUD is a deferred phase.

### 3.2 ID-or-slug resolution

A helper `resolveId(param, table)` tries `Number(param)` first; if `NaN` or not found, falls back to `WHERE slug = ?`. If neither resolves, the endpoint returns `404`. This keeps the numeric ids the existing tests use working, while making URLs readable (`/api/v1/vehicles/sp-pb-8475/last-position`).

### 3.3 Query parameters

- `?page=` (1-based, default 1), `?limit=` (default 50, capped at 100) — pagination on `/vehicles`.
- `?station_id=` filter on `/vehicles`.
- `?province_id=` filter on `/districts`.
- `?district_id=` filter on `/stations`.
- `?since=`, `?until=` (ISO 8601) and `?limit=` on `/vehicles/:id/pings`. Pings are sorted by `timestamp ASC` by default; `?order=desc` flips it.

## 4. Representations (JSON)

All responses are `application/json; charset=utf-8`.

### 4.1 Provinces

```json
{ "id": 1, "slug": "western", "name": "Western" }
```

Single-province response embeds its districts:

```json
{
  "id": 1, "slug": "western", "name": "Western",
  "districts": [
    { "id": 1, "slug": "colombo", "name": "Colombo" }
  ]
}
```

### 4.2 Districts

```json
{
  "id": 1, "slug": "colombo", "name": "Colombo", "province_id": 1,
  "province": { "id": 1, "slug": "western", "name": "Western" }
}
```

### 4.3 Stations

```json
{
  "id": 1, "slug": "colombo-fort", "name": "Colombo Fort", "district_id": 1,
  "district": { "id": 1, "slug": "colombo", "name": "Colombo" },
  "province": { "id": 1, "slug": "western", "name": "Western" }
}
```

### 4.4 Vehicles — list item

```json
{
  "id": 1, "slug": "sp-pb-8475", "registration_number": "SP PB-8475",
  "device_id": "TUK-DEV-0001", "station_id": 9
}
```

### 4.5 Vehicle — single (composite)

```json
{
  "id": 1, "slug": "sp-pb-8475", "registration_number": "SP PB-8475",
  "device_id": "TUK-DEV-0001",
  "home_station": {
    "id": 9, "slug": "katunayake-airport", "name": "Katunayake Airport",
    "district_id": 3, "province_id": 1
  },
  "last_ping": {
    "id": 4321, "timestamp": "2023-10-01T06:19:00Z",
    "latitude": 8.49955, "longitude": 79.993205, "speed": 0
  }
}
```

`last_ping` is `null` if no pings exist for the vehicle (matches current behaviour).

### 4.6 Pings

```json
{
  "id": 4321, "vehicle_id": 1,
  "latitude": 8.49955, "longitude": 79.993205, "speed": 0,
  "timestamp": "2023-10-01T06:19:00Z"
}
```

### 4.7 Last-position summary

```json
{
  "vehicle_id": 1, "timestamp": "2023-10-01T06:19:00Z",
  "latitude": 8.49955, "longitude": 79.993205, "speed": 0
}
```

> **Breaking-change flag (acknowledged):** the current `last-position` and `last_ping` object use `lat`/`lng`. We standardise all responses on `latitude`/`longitude` for consistency with the `pings` collection. Existing tests that assert `lat`/`lng` on those two routes will need updating. See Open Items §8.

## 5. Uniform Envelopes

### 5.1 Success

- **Single object:** the object directly (no wrapper).
- **Collection (paginated):** paginated wrapper:

```json
{ "data": [ /* items */ ], "page": 1, "limit": 50, "total": 200 }
```

  Paginated: `/vehicles` only (200 rows in seed). Stations/districts/provinces return flat arrays (small N, no pagination needed). The `/vehicles/:idOrSlug/pings` list returns a flat array (optionally filtered/limited) without the wrapper, since it is a sub-collection of a single vehicle.

### 5.2 Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Vehicle not found",
    "details": { "resource": "vehicle", "id": "99" }
  }
}
```

Status codes in use: `200`, `201` (created ping), `400` (bad body / bad query), `401` (missing/bad API key), `404` (resource not found), `500` (unexpected).

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL`.

## 6. Project Structure (planned)

```
app.js                 # boot Express, mount middleware + /api/v1 router
src/
  db.js                # open better-sqlite3, run schema.sql, seed from seed.json
  schema.sql           # the DDL in §2.2
  middleware/
    apiKey.js          # X-API-Key check against process.env.API_KEYS (comma-sep)
    errorHandler.js    # final error -> uniform envelope
  routes/
    provinces.js
    districts.js
    stations.js
    vehicles.js        # composite GET + last-position + pings GET/POST
  lib/
    resolve.js         # idOrSlug -> id helper
    paginate.js        # page/limit parsing + defaults/caps
.env.example           # API_KEYS=xxx, PORT=3000, DB_PATH=./fleet.db
routes.js              # legacy unversioned routes (delegate to /api/v1) — kept for S4 tests
seed.json              # retained as bootstrap-only import source
package.json
```

### 6.1 Seed bootstrap

`seed.json` is imported **once** during an explicit `npm run seed` (`node src/db.js --seed`), which:

1. Creates/opens `fleet.db`.
2. Applies `schema.sql`.
3. Wipes and reloads all tables from `seed.json`, generating `slug` values.
4. Exits.

Thereafter SQLite is the source of truth. A `--reseed` flag wipes then reloads. Auto-seed on first boot (DB file absent) was considered and rejected (see Open Items §8) — explicit seeding is safer and idempotent.

## 7. Dependencies to add

- `better-sqlite3` — synchronous SQLite; fast, no callback noise; pairs well with the existing synchronous read style.
- `dotenv` — load `.env` for `API_KEYS`, `PORT`, `DB_PATH`.

No ORM (keep the surface small and the SQL explicit). Validation in this phase is hand-rolled; `zod` or `express-validator` can be added later if POST coverage grows.

## 8. Open Items / Decisions Needed

1. **lat/lng vs latitude/longitude** — §4.7 standardises on `latitude`/`longitude`. Confirm the breaking change is acceptable, or whether to keep `lat`/`lng` aliases on `/last-position` and `last_ping`. (Default: standardise.)
2. **POST /pings auth** — same API key, or a separate "ingest" key with write scope? (Default: same key, single scope, for this phase.)
3. **Seed bootstrap trigger** — explicit `npm run seed` (chosen) vs. auto-import on first boot. (Chosen: explicit.)
4. **Pagination cap** — `limit` capped at 100, default 50 (default).
5. **Legacy `/vehicles` routes** — keep delegating to `/api/v1` until tests migrate, then remove `routes.js`. Confirm removal timing.
6. **Speed units** — assume km/h (typical for vehicle telemetry). Document but do not enforce a range in this phase.
7. **POST /pings rate / duplicate handling** — no dedup in this phase; every accepted POST inserts a row. Consider an `(vehicle_id, timestamp)` unique constraint later if duplicates become a problem.
8. **Vehicle/station CRUD timing** — explicitly out of scope here; flagged as a follow-up phase.
