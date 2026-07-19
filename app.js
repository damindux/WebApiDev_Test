import express from "express";
import registerRoutes from "./routes.js";
import registerAuthRoutes from "./routes/auth.js";
import registerUserRoutes from "./routes/users.js";
import { jwtAuth } from "./middleware/jwtAuth.js";
import { requireRole } from "./middleware/requireRole.js";
import { ALL_READ_ROLES } from "./lib/roles.js";
import { MongoClient } from "mongodb";
import "dotenv/config";

const app = express();
const port = 3000;

if (!process.env.JWT_SECRET) {
	console.error("JWT_SECRET is not defined in the environment variables (.env file).");
	process.exit(1);
}

app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
	console.error("MONGODB_URI is not defined in the environment variables (.env file).");
	process.exit(1);
}

let client = null;
let db = null;

async function getDatabase() {
	if (db) return db;
	if (!client) {
		client = new MongoClient(uri);
	}
	await client.connect();
	db = client.db();
	return db;
}

app.use(async (req, res, next) => {
	try {
		req.db = await getDatabase();
		next();
	} catch (err) {
		console.error("Failed to connect to MongoDB in request middleware:", err);
		res.status(500).json({ error: "Database connection failed" });
	}
});

app.get("/", jwtAuth, requireRole(...ALL_READ_ROLES), (req, res) => {
	res.json({ status: "ok", user: req.user.username, role: req.user.role });
});

registerAuthRoutes(app);
registerUserRoutes(app);
registerRoutes(app);

export async function closeDatabase() {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}

if (!process.env.VERCEL) {
	app.listen(port, () => {
		console.log(`Hello world app listening on port ${port}`);
	});
}

export default app;
