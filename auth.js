export function basicAuth(req, res, next) {
	// Do not apply it to POST /vehicles/:vehicleId/pings
	if (req.method === "POST" && /^\/vehicles\/[^/]+\/pings\/?$/.test(req.path)) {
		return next();
	}

	// Apply this middleware before every GET route handler.
	if (req.method !== "GET") {
		return next();
	}

	const authHeader = req.headers.authorization;
	if (!authHeader) {
		res.setHeader("WWW-Authenticate", 'Basic realm="Police API"');
		return res.status(401).json({ error: "Unauthorized" });
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Basic") {
		res.setHeader("WWW-Authenticate", 'Basic realm="Police API"');
		return res.status(401).json({ error: "Unauthorized" });
	}

	const credentials = Buffer.from(parts[1], "base64").toString("utf-8");
	const colonIndex = credentials.indexOf(":");
	if (colonIndex === -1) {
		return res.status(403).json({ error: "Forbidden" });
	}

	const username = credentials.substring(0, colonIndex);
	const password = credentials.substring(colonIndex + 1);

	if (username !== "police" || password !== "nibm2024") {
		return res.status(403).json({ error: "Forbidden" });
	}

	next();
}
