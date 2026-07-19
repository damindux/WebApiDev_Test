import { MongoClient } from "mongodb";
import "dotenv/config";

async function testCrudOperations() {
	console.log("Starting Database CRUD Operations Test...");

	const uri = process.env.MONGODB_URI;
	if (!uri) {
		console.error("FAIL: MONGODB_URI is not defined in the environment variables!");
		process.exit(1);
	}

	const client = new MongoClient(uri, {
		connectTimeoutMS: 5000,
		serverSelectionTimeoutMS: 5000
	});

	try {
		await client.connect();
		console.log("SUCCESS: Connected to database server.");

		const db = client.db();
		const testCollection = db.collection("test_crud_verification");

		// Clean up any stale records from previous tests
		await testCollection.deleteMany({});

		// --- 1. CREATE ---
		console.log("\n[1/4] Testing CREATE...");
		const documentToInsert = {
			testId: "crud-test-123",
			description: "MongoDB CRUD verification",
			createdAt: new Date(),
			status: "active"
		};
		const insertResult = await testCollection.insertOne(documentToInsert);
		if (insertResult.insertedId) {
			console.log(`SUCCESS: Document inserted with _id: ${insertResult.insertedId}`);
		} else {
			throw new Error("Insert failed - no insertedId returned.");
		}

		// --- 2. READ ---
		console.log("\n[2/4] Testing READ...");
		const retrievedDoc = await testCollection.findOne({ testId: "crud-test-123" });
		if (retrievedDoc && retrievedDoc.description === "MongoDB CRUD verification") {
			console.log("SUCCESS: Document read successfully from the database.");
			console.log("Retrieved document:", JSON.stringify(retrievedDoc, null, 2));
		} else {
			throw new Error(`Read failed - could not locate document or fields did not match.`);
		}

		// --- 3. UPDATE ---
		console.log("\n[3/4] Testing UPDATE...");
		const updateResult = await testCollection.updateOne(
			{ testId: "crud-test-123" },
			{ $set: { status: "completed", lastUpdated: new Date() } }
		);
		if (updateResult.modifiedCount === 1) {
			console.log("SUCCESS: Document status updated to 'completed'.");
			const updatedDoc = await testCollection.findOne({ testId: "crud-test-123" });
			console.log("Updated document status check:", updatedDoc.status);
		} else {
			throw new Error("Update failed - modifiedCount was not 1.");
		}

		// --- 4. DELETE ---
		console.log("\n[4/4] Testing DELETE...");
		const deleteResult = await testCollection.deleteOne({ testId: "crud-test-123" });
		if (deleteResult.deletedCount === 1) {
			console.log("SUCCESS: Document deleted successfully.");
		} else {
			throw new Error("Delete failed - deletedCount was not 1.");
		}

		// Verify deletion
		const finalCheck = await testCollection.findOne({ testId: "crud-test-123" });
		if (!finalCheck) {
			console.log("SUCCESS: Verified document no longer exists.");
		} else {
			throw new Error("Verification failed - document still exists after deletion!");
		}

		// Cleanup test collection
		await testCollection.drop();
		console.log("\nSUCCESS: Cleaned up and dropped test collection.");

		console.log("\nALL DATABASE CRUD TESTS PASSED SUCCESSFULLY!");
		process.exit(0);
	} catch (err) {
		console.error("\nFAIL: CRUD Operations Test failed!");
		console.error("Error details:", err);
		process.exit(1);
	} finally {
		await client.close();
	}
}

testCrudOperations();
