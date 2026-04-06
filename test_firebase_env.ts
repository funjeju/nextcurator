import { config } from 'dotenv';
config({ path: '.env.local' });
console.log("Environment loaded. projectId:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
import './lib/firebase.ts';
