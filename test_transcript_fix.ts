import dotenv from 'dotenv';
import { getTranscript } from './lib/transcript.ts';

dotenv.config({ path: '.env.local' });

async function test() {
  const videoId = 'bc3i_PQvypE';
  console.log(`[Test] Starting transcript extraction for ${videoId}...`);
  console.time('Extraction Time');
  
  try {
    const result = await getTranscript(videoId);
    console.timeEnd('Extraction Time');
    console.log('[Test] ✅ Success!');
    console.log('[Test] Source:', result.source);
    console.log('[Test] Language:', result.lang);
    console.log('[Test] Transcript length:', result.text.length);
    console.log('[Test] Preview (first 200 chars):', result.text.slice(0, 200));
  } catch (err) {
    console.timeEnd('Extraction Time');
    console.error('[Test] ❌ Failed:', err.message);
  }
}

test();
