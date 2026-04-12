
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function testQuery(collectionId) {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      limit: 5
    }
  };

  console.log(`Testing query for: ${collectionId}`);
  console.log(`URL: ${url}`);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error(`Status: ${res.status}`);
      console.error(`Error: ${await res.text()}`);
      return;
    }

    const data = await res.json();
    console.log(`Results length: ${data.length}`);
    console.log(`First result: ${JSON.stringify(data[0], null, 2)}`);
  } catch (err) {
    console.error(`Fetch error: ${err.message}`);
  }
}

async function main() {
  await testQuery('summaries');
  await testQuery('saved_summaries');
  await testQuery('users');
}

main();
