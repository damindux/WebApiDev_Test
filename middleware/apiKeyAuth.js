export async function apiKeyAuth(req, res, next) {
	const apiKey = req.headers["x-api-key"];
	if (!apiKey) {
		return res.status(401).json({ error: "X-API-Key header is required" });
	}

	const vehicleId = Number(req.params.vehicleId);
	const vehicle = await req.db.collection("vehicles").findOne(
		{ id: vehicleId },
		{ projection: { _id: 0 } }
	);
	if (!vehicle) {
		return res.status(404).json({ error: "Vehicle not found" });
	}

	const expectedApiKey = `key_v${String(vehicleId).padStart(2, "0")}`;
	if (expectedApiKey !== apiKey) {
		return res.status(403).json({ error: "Invalid API key" });
	}

	req.vehicle = vehicle;
	next();
}
