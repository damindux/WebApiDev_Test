import { readFileSync } from "fs";

const data = JSON.parse(readFileSync(new URL("seed.json", import.meta.url), "utf-8"));

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
}
