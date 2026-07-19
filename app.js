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

const client = new MongoClient(uri);

async function startServer() {
	try {
		await client.connect();
		console.log("Connected to MongoDB successfully!");
		const db = client.db();

		registerRoutes(app, db);

		app.listen(port, () => {
			console.log(`Hello world app listening on port ${port}`);
		});
	} catch (err) {
		console.error("Failed to connect to MongoDB", err);
		process.exit(1);
	}
}

startServer();