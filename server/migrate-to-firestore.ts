import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function migrateToFirestore() {
  console.log("🔄 Starting migration from JSON files to Firestore...\n");

  // Initialize Firebase Admin
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Error: Missing Firebase credentials in environment variables.");
    console.error("Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY");
    process.exit(1);
  }

  // Handle both escaped newlines (\n as string) and actual newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const db = getFirestore();
  const dataDir = "data";

  // Helper function to read JSON file
  async function readJSONFile(filePath: string): Promise<Record<string, any>> {
    try {
      if (!existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath}, skipping...`);
        return {};
      }
      const data = await fs.readFile(filePath, "utf-8");
      if (!data.trim()) {
        console.log(`⚠️  Empty file: ${filePath}, skipping...`);
        return {};
      }
      return JSON.parse(data, (key, value) => {
        // Convert date strings back to Date objects
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error);
      return {};
    }
  }

  // Helper function to migrate a collection
  async function migrateCollection(
    jsonFileName: string,
    collectionName: string
  ): Promise<void> {
    const filePath = path.join(dataDir, jsonFileName);
    const data = await readJSONFile(filePath);
    const entries = Object.entries(data);

    if (entries.length === 0) {
      console.log(`📄 ${collectionName}: No data to migrate`);
      return;
    }

    console.log(`📄 Migrating ${collectionName}: ${entries.length} documents...`);

    let batch = db.batch();
    let batchCount = 0;
    let totalCommitted = 0;

    for (const [id, doc] of entries) {
      const docRef = db.collection(collectionName).doc(id);
      batch.set(docRef, doc);
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount === 500) {
        await batch.commit();
        totalCommitted += 500;
        console.log(`   ✅ Committed batch of 500 documents (${totalCommitted}/${entries.length})`);
        batch = db.batch(); // Create a new batch for the next set of documents
        batchCount = 0;
      }
    }

    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      totalCommitted += batchCount;
      console.log(`   ✅ Committed final batch of ${batchCount} documents (${totalCommitted}/${entries.length})`);
    }

    console.log(`✅ ${collectionName}: Successfully migrated ${entries.length} documents\n`);
  }

  // Migrate all collections
  try {
    await migrateCollection("users.json", "users");
    await migrateCollection("games.json", "games");
    await migrateCollection("gameParticipants.json", "game_participants");
    await migrateCollection("transactions.json", "transactions");
    await migrateCollection("yahtzeePlayerStates.json", "yahtzee_player_states");
    await migrateCollection("yahtzeeTurns.json", "yahtzee_turns");
    await migrateCollection("matchResults.json", "match_results");
    await migrateCollection("matchResultPlayers.json", "match_result_players");
    await migrateCollection("gameInvitations.json", "game_invitations");
    await migrateCollection("plinkoResults.json", "plinko_results");
    await migrateCollection("diceResults.json", "dice_results");
    await migrateCollection("chessGameStates.json", "chess_game_states");
    await migrateCollection("chessMoves.json", "chess_moves");
    await migrateCollection("pageViews.json", "page_views");

    console.log("🎉 Migration completed successfully!");
    console.log("\n📊 Summary:");
    console.log("All your JSON data has been migrated to Firestore.");
    console.log("Your user data, balances, and transactions are now safely stored in the cloud.");
    console.log("\n⚠️  Important: Keep your JSON files as backup until you verify everything works correctly.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateToFirestore().catch(console.error);
