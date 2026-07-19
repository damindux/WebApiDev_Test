export default function registerRoutes(app) {
	app.get("/provinces", async (req, res) => {
		try {
			const db = req.db;
			const provinces = await db.collection("provinces").find({}, { projection: { _id: 0 } }).toArray();
			res.json(provinces);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/provinces/:provinceId", async (req, res) => {
		try {
			const db = req.db;
			const province = await db.collection("provinces").findOne(
				{ id: Number(req.params.provinceId) },
				{ projection: { _id: 0 } }
			);
			if (!province) return res.status(404).json({ error: "Province not found" });
			res.json(province);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/districts", async (req, res) => {
		try {
			const db = req.db;
			const districts = await db.collection("districts").find({}, { projection: { _id: 0 } }).toArray();
			res.json(districts);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/districts/:districtId", async (req, res) => {
		try {
			const db = req.db;
			const district = await db.collection("districts").findOne(
				{ id: Number(req.params.districtId) },
				{ projection: { _id: 0 } }
			);
			if (!district) return res.status(404).json({ error: "District not found" });
			res.json(district);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/stations", async (req, res) => {
		try {
			const db = req.db;
			const stations = await db.collection("stations").find({}, { projection: { _id: 0 } }).toArray();
			res.json(stations);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/stations/:stationId", async (req, res) => {
		try {
			const db = req.db;
			const station = await db.collection("stations").findOne(
				{ id: Number(req.params.stationId) },
				{ projection: { _id: 0 } }
			);
			if (!station) return res.status(404).json({ error: "Station not found" });
			res.json(station);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles", async (req, res) => {
		try {
			const db = req.db;
			const vehicles = await db.collection("vehicles").find({}, { projection: { _id: 0 } }).toArray();
			res.json(vehicles);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId", async (req, res) => {
		try {
			const db = req.db;
			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

			const latestPings = await db.collection("pings")
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

	app.get("/vehicles/:vehicleId/pings", async (req, res) => {
		try {
			const db = req.db;
			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

			const pings = await db.collection("pings").find({ vehicle_id: vehicleId }, { projection: { _id: 0 } }).toArray();
			res.json(pings);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/vehicles/:vehicleId/pings/:pingId", async (req, res) => {
		try {
			const db = req.db;
			const vehicleId = Number(req.params.vehicleId);
			const pingId = Number(req.params.pingId);
			const vehicle = await db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

			const ping = await db.collection("pings").findOne(
				{ id: pingId, vehicle_id: vehicleId },
				{ projection: { _id: 0 } }
			);
			if (!ping) return res.status(404).json({ error: "Ping not found" });

			res.json(ping);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.post("/vehicles/:vehicleId/pings", async (req, res) => {
		try {
			const db = req.db;
			const apiKey = req.headers["x-api-key"];
			if (!apiKey) return res.status(401).json({ error: "X-API-Key header is required" });

			const vehicleId = Number(req.params.vehicleId);
			const vehicle = await db.collection("vehicles").findOne({ id: vehicleId }, { projection: { _id: 0 } });
			if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

			const expectedApiKey = `key_v${String(vehicleId).padStart(2, "0")}`;
			if (expectedApiKey !== apiKey) return res.status(403).json({ error: "Invalid API key" });

			const { latitude, longitude, speed } = req.body;
			if (latitude == null || longitude == null || speed == null) {
				return res.status(400).json({ error: "Missing required fields: latitude, longitude, speed" });
			}

			// Generate next pingId: find maximum id in pings and add 1
			const maxPingDoc = await db.collection("pings")
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

			await db.collection("pings").insertOne(ping);

			// Exclude the _id field from response
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

	app.get("/vehicles/:vehicleId/last-position", async (req, res) => {
		try {
			const db = req.db;
			const vehicleId = Number(req.params.vehicleId);
			const latestPings = await db.collection("pings")
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
