import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import "dotenv/config";

if (!process.env.JWT_SECRET) {
	process.env.JWT_SECRET = "test-jwt-secret-for-integration-tests-only";
}

process.env.VERCEL = "1";

const { default: app, closeDatabase } = await import("../app.js");

after(async () => {
	await closeDatabase();
});

async function login(username, password) {
	const res = await request(app)
		.post("/auth/login")
		.send({ username, password });
	return res;
}

describe("Authentication", () => {
	it("returns 401 for invalid credentials", async () => {
		const res = await login("admin", "wrongpassword");
		assert.equal(res.status, 401);
	});

	it("returns a JWT for valid admin credentials", async () => {
		const res = await login("admin", "admin123");
		assert.equal(res.status, 200);
		assert.ok(res.body.token);
		assert.equal(res.body.role, "administrator");
		assert.equal(res.body.username, "admin");
	});
});

describe("JWT-protected routes", () => {
	it("returns 401 when no token is provided", async () => {
		const res = await request(app).get("/vehicles");
		assert.equal(res.status, 401);
	});

	it("allows dispatcher to list all vehicles", async () => {
		const loginRes = await login("dispatch1", "dispatch123");
		const res = await request(app)
			.get("/vehicles")
			.set("Authorization", `Bearer ${loginRes.body.token}`);
		assert.equal(res.status, 200);
		assert.ok(Array.isArray(res.body));
		assert.ok(res.body.length > 1);
	});

	it("scopes patrol officer vehicles to their station", async () => {
		const loginRes = await login("officer1", "officer123");
		const token = loginRes.body.token;

		const vehiclesRes = await request(app)
			.get("/vehicles")
			.set("Authorization", `Bearer ${token}`);
		assert.equal(vehiclesRes.status, 200);
		assert.ok(vehiclesRes.body.length > 0);
		assert.ok(vehiclesRes.body.every((v) => v.station_id === 1));

		const otherStationVehicle = await request(app)
			.get("/vehicles")
			.set("Authorization", `Bearer ${await login("dispatch1", "dispatch123").then((r) => r.body.token)}`);
		const outOfScope = otherStationVehicle.body.find((v) => v.station_id !== 1);
		if (outOfScope) {
			const forbiddenRes = await request(app)
				.get(`/vehicles/${outOfScope.id}`)
				.set("Authorization", `Bearer ${token}`);
			assert.equal(forbiddenRes.status, 403);
		}
	});

	it("returns current user profile from /auth/me", async () => {
		const loginRes = await login("admin", "admin123");
		const res = await request(app)
			.get("/auth/me")
			.set("Authorization", `Bearer ${loginRes.body.token}`);
		assert.equal(res.status, 200);
		assert.equal(res.body.username, "admin");
		assert.equal(res.body.role, "administrator");
		assert.equal(res.body.password_hash, undefined);
	});
});

describe("IoT API key boundary", () => {
	it("returns 401 when x-api-key is missing", async () => {
		const res = await request(app)
			.post("/vehicles/1/pings")
			.send({ latitude: 6.9, longitude: 79.8, speed: 40 });
		assert.equal(res.status, 401);
	});

	it("accepts valid x-api-key without JWT", async () => {
		const res = await request(app)
			.post("/vehicles/1/pings")
			.set("x-api-key", "key_v01")
			.send({ latitude: 6.9271, longitude: 79.8612, speed: 55 });
		assert.equal(res.status, 201);
		assert.ok(res.body.id);
		assert.equal(res.body.vehicle_id, 1);
	});

	it("returns 403 for invalid x-api-key", async () => {
		const res = await request(app)
			.post("/vehicles/1/pings")
			.set("x-api-key", "invalid-key")
			.send({ latitude: 6.9, longitude: 79.8, speed: 40 });
		assert.equal(res.status, 403);
	});
});

describe("Admin user management", () => {
	let adminToken;

	before(async () => {
		const loginRes = await login("admin", "admin123");
		adminToken = loginRes.body.token;
	});

	it("returns 403 for non-admin accessing /users", async () => {
		const loginRes = await login("dispatch1", "dispatch123");
		const res = await request(app)
			.get("/users")
			.set("Authorization", `Bearer ${loginRes.body.token}`);
		assert.equal(res.status, 403);
	});

	it("allows admin to list users", async () => {
		const res = await request(app)
			.get("/users")
			.set("Authorization", `Bearer ${adminToken}`);
		assert.equal(res.status, 200);
		assert.ok(Array.isArray(res.body));
		assert.ok(res.body.length >= 3);
	});
});
