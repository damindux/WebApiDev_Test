import { readFileSync } from "fs";

const data = JSON.parse(readFileSync(new URL("seed.json", import.meta.url), "utf-8"));

const deviceKeys = {};
data.vehicles.forEach(v => {
  const key = `v-${String(v.id).padStart(2, '0')}`;
  deviceKeys[key] = `key_v${String(v.id).padStart(2, '0')}`;
});

export default function registerRoutes(app) {
	app.get("/provinces", (req, res) => {
		res.json(data.provinces);
	});

	app.get("/provinces/:provinceId", (req, res) => {
		const province = data.provinces.find((p) => p.id === Number(req.params.provinceId));
		if (!province) return res.status(404).json({ error: "Province not found" });
		res.json(province);
	});

	app.get("/districts", (req, res) => {
		res.json(data.districts);
	});

	app.get("/districts/:districtId", (req, res) => {
		const district = data.districts.find((d) => d.id === Number(req.params.districtId));
		if (!district) return res.status(404).json({ error: "District not found" });
		res.json(district);
	});

	app.get("/stations", (req, res) => {
		res.json(data.stations);
	});

	app.get("/stations/:stationId", (req, res) => {
		const station = data.stations.find((s) => s.id === Number(req.params.stationId));
		if (!station) return res.status(404).json({ error: "Station not found" });
		res.json(station);
	});

	app.get("/vehicles", (req, res) => {
		res.json(data.vehicles);
	});

	app.get("/vehicles/:vehicleId", (req, res) => {
		const vehicle = data.vehicles.find((v) => v.id === Number(req.params.vehicleId));
		if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

		const pings = data.pings
			.filter((p) => p.vehicle_id === vehicle.id)
			.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		const lastPing = pings.length > 0 ? {
			ping_id: pings[0].id,
			vehicle_id: pings[0].vehicle_id,
			timestamp: pings[0].timestamp,
			lat: pings[0].latitude,
			lng: pings[0].longitude,
			speed: pings[0].speed ?? 0,
		} : null;

		res.json({
			vehicle_id: vehicle.id,
			reg_number: vehicle.registration_number,
			device_id: vehicle.device_id,
			station_id: vehicle.station_id,
			last_ping: lastPing,
		});
	});

	app.get("/vehicles/:vehicleId/pings", (req, res) => {
		const vehicle = data.vehicles.find((v) => v.id === Number(req.params.vehicleId));
		if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
		const pings = data.pings.filter((p) => p.vehicle_id === vehicle.id);
		res.json(pings);
	});

	app.get("/vehicles/:vehicleId/pings/:pingId", (req, res) => {
		const vehicle = data.vehicles.find((v) => v.id === Number(req.params.vehicleId));
		if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

		const ping = data.pings.find(
			(p) => p.id === Number(req.params.pingId) && p.vehicle_id === vehicle.id
		);
		if (!ping) return res.status(404).json({ error: "Ping not found" });

		res.json(ping);
	});

	app.post("/vehicles/:vehicleId/pings", (req, res) => {
		const apiKey = req.headers["x-api-key"];
		if (!apiKey) return res.status(401).json({ error: "X-API-Key header is required" });

		const vehicleId = Number(req.params.vehicleId);
		const vehicle = data.vehicles.find((v) => v.id === vehicleId);
		if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

		const deviceKey = `v-${String(vehicleId).padStart(2, "0")}`;
		if (deviceKeys[deviceKey] !== apiKey) return res.status(403).json({ error: "Invalid API key" });

		const { latitude, longitude, speed } = req.body;
		if (latitude == null || longitude == null || speed == null) {
			return res.status(400).json({ error: "Missing required fields: latitude, longitude, speed" });
		}

		const maxId = data.pings.reduce((max, p) => Math.max(max, p.id), 0);
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

		data.pings.push(ping);

		res.status(201)
			.location(`/vehicles/${req.params.vehicleId}/pings/${pingId}`)
			.set("ETag", `"${pingId}"`)
			.set("Last-Modified", timestamp)
			.json(ping);
	});

	app.get("/vehicles/:vehicleId/last-position", (req, res) => {
		const pings = data.pings
			.filter((p) => p.vehicle_id === Number(req.params.vehicleId))
			.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		if (pings.length === 0) return res.status(404).json({ error: "No pings found for this vehicle" });

		res.json({
			vehicle_id: pings[0].vehicle_id,
			timestamp: pings[0].timestamp,
			lat: pings[0].latitude,
			lng: pings[0].longitude,
			speed: pings[0].speed ?? 0,
		});
	});
}
