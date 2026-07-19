import bcrypt from "bcryptjs";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { signToken } from "../lib/jwt.js";

const USER_PROJECTION = { projection: { _id: 0, password_hash: 0 } };

export default function registerAuthRoutes(app) {
	app.post("/auth/login", async (req, res) => {
		try {
			const { username, password } = req.body;
			if (!username || !password) {
				return res.status(400).json({ error: "username and password are required" });
			}

			const user = await req.db.collection("users").findOne({ username });
			if (!user || !user.active) {
				return res.status(401).json({ error: "Invalid credentials" });
			}

			const valid = await bcrypt.compare(password, user.password_hash);
			if (!valid) {
				return res.status(401).json({ error: "Invalid credentials" });
			}

			const token = signToken(user);
			const expiresIn = process.env.JWT_EXPIRES_IN || "8h";

			res.json({
				token,
				expires_in: expiresIn,
				role: user.role,
				username: user.username,
			});
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	app.get("/auth/me", jwtAuth, async (req, res) => {
		try {
			const user = await req.db.collection("users").findOne(
				{ id: req.user.id },
				USER_PROJECTION
			);
			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}
			res.json(user);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});
}
