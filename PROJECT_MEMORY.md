# Project Memory: WebApiDev Test (Police API)

## Overview
A lightweight Node.js/Express web API designed to serve police vehicle tracking data. It connects to a MongoDB database to manage tracking data such as provinces, districts, stations, vehicles, and GPS ping coordinates.

---

## Tech Stack
* **Runtime**: Node.js (ES Modules, `"type": "module"`)
* **Framework**: Express (v5.2.1)
* **Database**: MongoDB (Atlas)
* **Configuration**: Dotenv (`.env` file, git-ignored)
* **Authentication**: JWT (`jsonwebtoken`) + bcrypt password hashing (`bcryptjs`)

---

## Database Configuration
The application connects to a remote MongoDB Atlas database via the connection string defined in the environment:
* **Connection String**: `MONGODB_URI` (defined in `.env`)
* **Default Database**: `police`
* **Collections**:
  * `provinces`: Contains regional provinces details.
  * `districts`: Contains administrative district details.
  * `stations`: Police stations mapping.
  * `vehicles`: Tracker-equipped police vehicles.
  * `pings`: GPS ping history (latitude, longitude, speed, timestamp).
  * `users`: Human operator accounts (username, password hash, role, station scope).

### Seeding
* **Geo/vehicle data**: [`seed.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/seed.js) parses [`seed.json`](file:///home/damindux/Projects/Uni/WebApiDev_Test/seed.json) into provinces, districts, stations, vehicles, and pings.
* **User accounts**: [`seed-users.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/seed-users.js) seeds demo users into the `users` collection. Run with `npm run seed:users`.
* Seeding was completed with **9 provinces**, **25 districts**, **20 stations**, **200 vehicles**, and **4200 pings**.

---

## Authentication Architecture

The API uses a **dual-boundary** security model:

| Boundary | Mechanism | Used By |
|----------|-----------|---------|
| Human clients | JWT Bearer tokens + RBAC | Administrators, dispatchers, patrol officers |
| IoT devices | `x-api-key` header | GPS hardware posting pings |

### Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `JWT_SECRET` | HMAC signing key for JWTs | **Required** |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `BCRYPT_ROUNDS` | bcrypt cost factor | `12` |
| `MONGODB_URI` | MongoDB connection string | **Required** |

See [`.env.example`](file:///home/damindux/Projects/Uni/WebApiDev_Test/.env.example) for a template.

### Roles (RBAC)
| Role | Access |
|------|--------|
| `administrator` | Full read access; user management (`/users` CRUD) |
| `dispatcher` | Full read access to all geographic and vehicle data |
| `patrol_officer` | Read access scoped to vehicles at their assigned `station_id` |

### Demo Users (after `npm run seed:users`)
| Username | Password | Role | Station |
|----------|----------|------|---------|
| `admin` | `admin123` | administrator | — |
| `dispatch1` | `dispatch123` | dispatcher | — |
| `officer1` | `officer123` | patrol_officer | station `1` |

### Login Flow
1. `POST /auth/login` with `{ "username", "password" }`
2. Server validates credentials against `users` collection (bcrypt compare)
3. Returns `{ "token", "expires_in", "role", "username" }`
4. Client sends `Authorization: Bearer <token>` on subsequent requests

### IoT API Key Flow
* `POST /vehicles/:vehicleId/pings` requires `x-api-key` header
* Key format: `key_v{vehicleId zero-padded to 2 digits}` (e.g. vehicle `1` → `key_v01`)
* JWT tokens are **not** accepted on this route

---

## Middleware Stack

Order in [`app.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/app.js):

1. `express.json()` — JSON body parsing
2. DB injection middleware — attaches `req.db` (lazy MongoDB connect, Vercel-safe)
3. Route handlers with per-route auth:
   * `jwtAuth` — verifies Bearer JWT, attaches `req.user`
   * `requireRole(...roles)` — RBAC guard (403 if role not allowed)
   * `apiKeyAuth` — validates `x-api-key` for ping ingestion only

### Key Files
| File | Purpose |
|------|---------|
| [`middleware/jwtAuth.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/middleware/jwtAuth.js) | JWT verification |
| [`middleware/requireRole.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/middleware/requireRole.js) | Role-based authorization |
| [`middleware/apiKeyAuth.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/middleware/apiKeyAuth.js) | IoT API key validation |
| [`middleware/vehicleAccess.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/middleware/vehicleAccess.js) | Station-scoped vehicle filtering |
| [`routes/auth.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/routes/auth.js) | Login and profile endpoints |
| [`routes/users.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/routes/users.js) | Admin user management |

---

## Vercel Serverless Integration
To prevent crashes in Vercel serverless environments:
1. **Lazy Database Connections**: MongoDB connects on-demand inside request middleware and caches the client/database instances.
2. **Dynamic Request Context**: The active MongoDB database instance is attached to the request (`req.db`).
3. **No-Blocking Listener & Default Export**: `app.listen()` is bypassed when `process.env.VERCEL` is set; `app` is exported as default.

---

## Key Endpoints

| Endpoint | Method | Authentication | Description |
| :--- | :--- | :--- | :--- |
| `GET /` | GET | JWT (all roles) | Root status check with authenticated user info |
| `POST /auth/login` | POST | Public | Issue JWT token |
| `GET /auth/me` | GET | JWT | Current user profile |
| `GET /users` | GET | JWT (administrator) | List all users |
| `POST /users` | POST | JWT (administrator) | Create user |
| `PATCH /users/:userId` | PATCH | JWT (administrator) | Update user role, station, password, or active flag |
| `DELETE /users/:userId` | DELETE | JWT (administrator) | Deactivate user (soft delete) |
| `GET /provinces` | GET | JWT (all roles) | Retrieves all provinces |
| `GET /provinces/:provinceId` | GET | JWT (all roles) | Retrieves details for a specific province |
| `GET /districts` | GET | JWT (all roles) | Retrieves all districts |
| `GET /districts/:districtId` | GET | JWT (all roles) | Retrieves a specific district |
| `GET /stations` | GET | JWT (all roles) | Retrieves all police stations |
| `GET /stations/:stationId` | GET | JWT (all roles) | Retrieves details for a specific station |
| `GET /vehicles` | GET | JWT (all roles) | Retrieves vehicles (station-scoped for patrol officers) |
| `GET /vehicles/:vehicleId` | GET | JWT (all roles) | Vehicle info and latest ping (station-scoped) |
| `GET /vehicles/:vehicleId/pings` | GET | JWT (all roles) | All GPS pings for a vehicle (station-scoped) |
| `GET /vehicles/:vehicleId/pings/:pingId` | GET | JWT (all roles) | Specific ping record (station-scoped) |
| `POST /vehicles/:vehicleId/pings` | POST | API Key (`x-api-key`) | Appends a new GPS ping for a vehicle |
| `GET /vehicles/:vehicleId/last-position` | GET | JWT (all roles) | Latest GPS ping for a vehicle (station-scoped) |

---

## Database Connection Verification & Testing

* **Connection Test**: [`tests/connection.test.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/tests/connection.test.js)
* **CRUD Test**: [`tests/crud.test.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/tests/crud.test.js)
* **Auth Integration Test**: [`tests/auth.test.js`](file:///home/damindux/Projects/Uni/WebApiDev_Test/tests/auth.test.js) — login, JWT protection, RBAC scoping, API key boundary, admin routes

**Prerequisites for auth tests**: run `npm run seed:users` once to populate demo accounts.

**Execution**:
```bash
npm test
```

### Common Deployment Troubleshooting
If the application returns `{"error": "Database connection failed"}` in production/deployment, verify the following:

1. **Environment Variables**:
   * Ensure `MONGODB_URI` and `JWT_SECRET` are defined in Vercel Project Settings.
   * Since `.env` is git-ignored, it will not be deployed automatically.
2. **MongoDB Atlas IP Access Whitelist**:
   * Vercel serverless functions do not have static IP addresses. Whitelist **`0.0.0.0/0`** in MongoDB Atlas Network Access.
3. **User Seeding**:
   * Run `npm run seed:users` against the production database before first login.
