import express from "express";
import registerRoutes from "./routes.js";
import { basicAuth } from "./auth.js";
import { MongoClient } from "mongodb";
import "dotenv/config";

const app = express();
const port = 3000;

app.use(express.json());
app.use(basicAuth);

app.get("/", (req, res) => {
	res.json({ status: "ok", session: "NB6007CEM S2" });
});

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

// Middleware to inject db into request objects
app.use(async (req, res, next) => {
	try {
		req.db = await getDatabase();
		next();
	} catch (err) {
		console.error("Failed to connect to MongoDB in request middleware:", err);
		res.status(500).json({ error: "Database connection failed" });
	}
});

registerRoutes(app);

// Only listen if not running in Vercel's serverless environment
if (!process.env.VERCEL) {
	app.listen(port, () => {
		console.log(`Hello world app listening on port ${port}`);
	});
}

export default app;