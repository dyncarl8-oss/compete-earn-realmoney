import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  // Handle escaped newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

const collections = [
  'users',
  'games',
  'game_participants',
  'transactions',
  'yahtzee_player_states',
  'yahtzee_turns',
  'match_results',
  'match_result_players',
  'game_invitations',
  'plinko_results',
  'dice_results',
  'slots_results',
  'chess_game_states',
  'chess_moves',
  'page_views',
  'withdrawals'
];

async function clearCollection(collectionName: string) {
  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log(`✓ ${collectionName}: already empty`);
    return;
  }

  console.log(`🗑️  Deleting ${snapshot.size} documents from ${collectionName}...`);
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✓ ${collectionName}: cleared`);
}

async function clearAllData() {
  console.log('🧹 Starting database cleanup...\n');
  
  for (const collection of collections) {
    try {
      await clearCollection(collection);
    } catch (error) {
      console.error(`❌ Error clearing ${collection}:`, error);
    }
  }
  
  console.log('\n✅ Database cleanup complete! Your database is now fresh and ready.');
  process.exit(0);
}

clearAllData().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
