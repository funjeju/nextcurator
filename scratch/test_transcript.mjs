
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
const videoId = 'bc3i_PQvypE';

async function test() {
  console.log(`Testing transcript for ${videoId} via ${workerUrl}`);
  try {
    const res = await fetch(`${workerUrl}?videoId=${videoId}`);
    const data = await res.json();
    if (data.transcript) {
      console.log('Transcript length:', data.transcript.length);
      console.log('First 500 chars:', data.transcript.slice(0, 500));
      console.log('Last 500 chars:', data.transcript.slice(-500));
    } else {
      console.log('Error:', data);
    }
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

test();
