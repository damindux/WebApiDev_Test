import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { ROLES } from "./lib/roles.js";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const DEMO_USERS = [
	{ id: 1, username: "admin", password: "admin123", role: ROLES.ADMINISTRATOR, station_id: null },
	{ id: 2, username: "dispatch1", password: "dispatch123", role: ROLES.DISPATCHER, station_id: null },
	{ id: 3, username: "officer1", password: "officer123", role: ROLES.PATROL_OFFICER, station_id: 1 },
];

async function seedUsers() {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		console.error("Error: MONGODB_URI is not defined in .env file");
		process.exit(1);
	}

	const client = new MongoClient(uri);

	try {
		await client.connect();
		console.log("Connected to MongoDB successfully!");

		const db = client.db();
		const collection = db.collection("users");

		await collection.deleteMany({});
		console.log("Cleared existing collection: users");

		const users = [];
		for (const demo of DEMO_USERS) {
			users.push({
				id: demo.id,
				username: demo.username,
				password_hash: await bcrypt.hash(demo.password, BCRYPT_ROUNDS),
				role: demo.role,
				station_id: demo.station_id,
				active: true,
				created_at: new Date().toISOString(),
			});
		}

		const result = await collection.insertMany(users);
		console.log(`Successfully inserted ${result.insertedCount} users`);
		console.log("User seeding completed!");
	} catch (err) {
		console.error("User seeding failed:", err);
		process.exit(1);
	} finally {
		await client.close();
	}
}

seedUsers();
