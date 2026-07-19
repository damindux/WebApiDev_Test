import { verifyToken } from "../lib/jwt.js";

export function jwtAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		const payload = verifyToken(parts[1]);
		req.user = {
			id: payload.sub,
			username: payload.username,
			role: payload.role,
			station_id: payload.station_id ?? null,
		};
		next();
	} catch {
		return res.status(401).json({ error: "Unauthorized" });
	}
}
