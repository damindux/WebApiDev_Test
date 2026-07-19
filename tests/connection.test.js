import { MongoClient } from "mongodb";
import "dotenv/config";

async function testConnection() {
	console.log("Starting database connection test...");

	const uri = process.env.MONGODB_URI;
	if (!uri) {
		console.error("FAIL: MONGODB_URI is not defined in the environment variables!");
		process.exit(1);
	}

	// Mask password in logs for safety
	const maskedUri = uri.replace(/:([^:@]+)@/, ":******@");
	console.log(`Connecting to: ${maskedUri}`);

	const client = new MongoClient(uri, {
		connectTimeoutMS: 5000, // 5 seconds timeout for test
		serverSelectionTimeoutMS: 5000
	});

	try {
		await client.connect();
		console.log("SUCCESS: Connected to MongoDB cluster!");

		const db = client.db();
		console.log(`SUCCESS: Connected to database "${db.databaseName}"`);

		const collections = await db.listCollections().toArray();
		console.log("SUCCESS: Retrieved collections list successfully!");
		console.log("Collections present in database:");
		collections.forEach(col => console.log(`  - ${col.name}`));

		// Verify count on one of the collections
		const vehiclesCount = await db.collection("vehicles").countDocuments();
		console.log(`SUCCESS: Counted ${vehiclesCount} documents in "vehicles" collection.`);

		console.log("\nDATABASE CONNECTION TEST PASSED SUCCESSFULLY!");
		process.exit(0);
	} catch (err) {
		console.error("\nFAIL: Database connection test failed!");
		console.error("Error details:", err);
		process.exit(1);
	} finally {
		await client.close();
	}
}

testConnection();
