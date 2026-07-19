import bcrypt from "bcryptjs";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES, isValidRole } from "../lib/roles.js";

const USER_PROJECTION = { projection: { _id: 0, password_hash: 0 } };
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

function sanitizeUser(user) {
	const { password_hash, ...safe } = user;
	return safe;
}

export default function registerUserRoutes(app) {
	const adminOnly = [jwtAuth, requireRole(ROLES.ADMINISTRATOR)];

	app.get("/users", ...adminOnly, async (req, res) => {
		try {
			const users = await req.db.collection("users")
				.find({}, USER_PROJECTION)
				.toArray();
			res.json(users);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.post("/users", ...adminOnly, async (req, res) => {
		try {
			const { username, password, role, station_id } = req.body;
			if (!username || !password || !role) {
				return res.status(400).json({ error: "username, password, and role are required" });
			}
			if (!isValidRole(role)) {
				return res.status(400).json({ error: "Invalid role" });
			}
			if (role === ROLES.PATROL_OFFICER && station_id == null) {
				return res.status(400).json({ error: "station_id is required for patrol_officer" });
			}

			const existing = await req.db.collection("users").findOne({ username });
			if (existing) {
				return res.status(409).json({ error: "Username already exists" });
			}

			const maxUser = await req.db.collection("users")
				.find({}, { projection: { id: 1 } })
				.sort({ id: -1 })
				.limit(1)
				.toArray();
			const nextId = maxUser.length > 0 ? maxUser[0].id + 1 : 1;

			const user = {
				id: nextId,
				username,
				password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
				role,
				station_id: role === ROLES.PATROL_OFFICER ? Number(station_id) : null,
				active: true,
				created_at: new Date().toISOString(),
			};

			await req.db.collection("users").insertOne(user);
			res.status(201).json(sanitizeUser(user));
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.patch("/users/:userId", ...adminOnly, async (req, res) => {
		try {
			const userId = Number(req.params.userId);
			const { role, station_id, active, password } = req.body;
			const updates = {};

			if (role !== undefined) {
				if (!isValidRole(role)) {
					return res.status(400).json({ error: "Invalid role" });
				}
				updates.role = role;
			}
			if (station_id !== undefined) {
				updates.station_id = station_id == null ? null : Number(station_id);
			}
			if (active !== undefined) {
				updates.active = Boolean(active);
			}
			if (password !== undefined) {
				updates.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
			}

			if (Object.keys(updates).length === 0) {
				return res.status(400).json({ error: "No valid fields to update" });
			}

			const effectiveRole = updates.role;
			const effectiveStationId = updates.station_id;
			const existing = await req.db.collection("users").findOne({ id: userId });
			if (!existing) {
				return res.status(404).json({ error: "User not found" });
			}

			const resolvedRole = effectiveRole ?? existing.role;
			const resolvedStationId = effectiveStationId !== undefined
				? effectiveStationId
				: existing.station_id;
			if (resolvedRole === ROLES.PATROL_OFFICER && resolvedStationId == null) {
				return res.status(400).json({ error: "station_id is required for patrol_officer" });
			}
			if (resolvedRole !== ROLES.PATROL_OFFICER) {
				updates.station_id = null;
			}

			const result = await req.db.collection("users").findOneAndUpdate(
				{ id: userId },
				{ $set: updates },
				{ returnDocument: "after", projection: { _id: 0, password_hash: 0 } }
			);

			if (!result) {
				return res.status(404).json({ error: "User not found" });
			}

			res.json(result);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.delete("/users/:userId", ...adminOnly, async (req, res) => {
		try {
			const userId = Number(req.params.userId);
			const result = await req.db.collection("users").findOneAndUpdate(
				{ id: userId },
				{ $set: { active: false } },
				{ returnDocument: "after", projection: { _id: 0, password_hash: 0 } }
			);

			if (!result) {
				return res.status(404).json({ error: "User not found" });
			}

			res.json(result);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});
}
