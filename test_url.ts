import { extractVideoId } from './lib/transcript';

const url = 'https://www.youtube.com/shorts/JwRWtuFgkTU';
console.log('Testing url:', url);
console.log('Result:', extractVideoId(url));
