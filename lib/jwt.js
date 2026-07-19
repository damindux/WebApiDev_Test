import jwt from "jsonwebtoken";

export function signToken(user) {
	return jwt.sign(
		{
			sub: user.id,
			username: user.username,
			role: user.role,
			station_id: user.station_id ?? null,
		},
		process.env.JWT_SECRET,
		{ expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
	);
}

export function verifyToken(token) {
	return jwt.verify(token, process.env.JWT_SECRET);
}
