import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import "dotenv/config";

async function seed() {
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
		console.log(`Database name: ${db.databaseName}`);

		const data = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf-8"));
		const collections = ["provinces", "districts", "stations", "vehicles", "pings"];

		for (const key of collections) {
			if (data[key] && Array.isArray(data[key])) {
				const collection = db.collection(key);
				
				// Drop or clear collection to ensure clean seed
				await collection.deleteMany({});
				console.log(`Cleared existing collection: ${key}`);

				if (data[key].length > 0) {
					// Convert some fields if necessary? No, keep it as JSON.
					const result = await collection.insertMany(data[key]);
					console.log(`Successfully inserted ${result.insertedCount} documents into collection: ${key}`);
				}
			}
		}

		console.log("Database seeding completed!");
	} catch (err) {
		console.error("Seeding failed:", err);
	} finally {
		await client.close();
	}
}

seed();
