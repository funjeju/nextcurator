require('dotenv').config({ path: '.env.local' });

async function getVideoInfoFallback(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('NO_API_KEY_FOR_FALLBACK');
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`);
  const data = await res.json();
  if (data.items && data.items.length > 0) {
    const snippet = data.items[0].snippet;
    return {
      title: snippet.title,
      channel: snippet.channelTitle,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }
  throw new Error('VIDEO_NOT_FOUND_IN_API');
}

getVideoInfoFallback('JwRWtuFgkTU').then(console.log).catch(console.error);
