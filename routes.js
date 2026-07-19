import { jwtAuth } from "./middleware/jwtAuth.js";
import { requireRole } from "./middleware/requireRole.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { vehicleFilterForUser, canAccessVehicle } from "./middleware/vehicleAccess.js";
import { ALL_READ_ROLES } from "./lib/roles.js";

const readAuth = [jwtAuth, requireRole(...ALL_READ_ROLES)];

export default function registerRoutes(app) {
	app.get("/provinces", ...readAuth, async (req, res) => {
		try {
			const provinces = await req.db.collection("provinces").find({}, { projection: { _id: 0 } }).toArray();
			res.json(provinces);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/provinces/:provinceId", ...readAuth, async (req, res) => {
		try {
			const province = await req.db.collection("provinces").findOne(
				{ id: Number(req.params.provinceId) },
				{ projection: { _id: 0 } }
			);
			if (!province) return res.status(404).json({ error: "Province not found" });
			res.json(province);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/districts", ...readAuth, async (req, res) => {
		try {
			const districts = await req.db.collection("districts").find({}, { projection: { _id: 0 } }).toArray();
			res.json(districts);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/districts/:districtId", ...readAuth, async (req, res) => {
		try {
			const district = await req.db.collection("districts").findOne(
				{ id: Number(req.params.districtId) },
				{ projection: { _id: 0 } }
			);
			if (!district) return res.status(404).json({ error: "District not found" });
			res.json(district);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/stations", ...readAuth, async (req, res) => {
		try {
			const stations = await req.db.collection("stations").find({}, { projection: { _id: 0 } }).toArray();
			res.json(stations);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/stations/:stationId", ...readAuth, async (req, res) => {
		try {
			const station = await req.db.collection("stations").findOne(
				{ id: Number(req.params.stationId) },
				{ projection: { _id: 0 } }
			);
			if (!station) return res.status(404).json({ error: "Station not found" });
			res.json(station);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles", ...readAuth, async (req, res) => {
		try {
			const filter = vehicleFilterForUser(req.user);
			const vehicles = await req.db.collection("vehicles").find(filter, { projection: { _id: 0 } }).toArray();
			res.json(vehicles);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId", ...readAuth, async (req, res) => {
		try {
			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await req.db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
			if (!canAccessVehicle(req.user, vehicle)) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const latestPings = await req.db.collection("pings")
				.find({ vehicle_id: vehicleId }, { projection: { _id: 0 } })
				.sort({ timestamp: -1 })
				.limit(1)
				.toArray();

			const lastPing = latestPings.length > 0 ? {
				ping_id: latestPings[0].id,
				vehicle_id: latestPings[0].vehicle_id,
				timestamp: latestPings[0].timestamp,
				lat: latestPings[0].latitude,
				lng: latestPings[0].longitude,
				speed: latestPings[0].speed ?? 0,
			} : null;

			res.json({
				vehicle_id: vehicle.id,
				reg_number: vehicle.registration_number,
				device_id: vehicle.device_id,
				station_id: vehicle.station_id,
				last_ping: lastPing,
			});
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId/pings", ...readAuth, async (req, res) => {
		try {
			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await req.db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
			if (!canAccessVehicle(req.user, vehicle)) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const pings = await req.db.collection("pings").find({ vehicle_id: vehicleId }, { projection: { _id: 0 } }).toArray();
			res.json(pings);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId/pings/:pingId", ...readAuth, async (req, res) => {
		try {
			const vehicleId = Number(req.params.vehicleId);
			const pingId = Number(req.params.pingId);
			const vehicle = await req.db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
			if (!canAccessVehicle(req.user, vehicle)) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const ping = await req.db.collection("pings").findOne(
				{ id: pingId, vehicle_id: vehicleId },
				{ projection: { _id: 0 } }
			);
			if (!ping) return res.status(404).json({ error: "Ping not found" });

			res.json(ping);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.post("/vehicles/:vehicleId/pings", apiKeyAuth, async (req, res) => {
		try {
			const vehicle = req.vehicle;
			const { latitude, longitude, speed } = req.body;
			if (latitude == null || longitude == null || speed == null) {
				return res.status(400).json({ error: "Missing required fields: latitude, longitude, speed" });
			}

			const maxPingDoc = await req.db.collection("pings")
				.find({}, { projection: { id: 1 } })
				.sort({ id: -1 })
				.limit(1)
				.toArray();

			const maxId = maxPingDoc.length > 0 ? maxPingDoc[0].id : 0;
			const pingId = maxId + 1;
			const timestamp = new Date().toISOString();

			const ping = {
				id: pingId,
				vehicle_id: vehicle.id,
				latitude,
				longitude,
				speed,
				timestamp,
			};

			await req.db.collection("pings").insertOne(ping);

			const { _id, ...pingWithoutId } = ping;

			res.status(201)
				.location(`/vehicles/${req.params.vehicleId}/pings/${pingId}`)
				.set("ETag", `"${pingId}"`)
				.set("Last-Modified", timestamp)
				.json(pingWithoutId);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId/last-position", ...readAuth, async (req, res) => {
		try {
			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await req.db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
			if (!canAccessVehicle(req.user, vehicle)) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const latestPings = await req.db.collection("pings")
				.find({ vehicle_id: vehicleId })
				.sort({ timestamp: -1 })
				.limit(1)
				.toArray();

			if (latestPings.length === 0) return res.status(404).json({ error: "No pings found for this vehicle" });

			res.json({
				vehicle_id: latestPings[0].vehicle_id,
				timestamp: latestPings[0].timestamp,
				lat: latestPings[0].latitude,
				lng: latestPings[0].longitude,
				speed: latestPings[0].speed ?? 0,
			});
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});
}
