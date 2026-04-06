function extractVideoId(url) {
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (ID_PATTERN.test(id)) return id;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v && ID_PATTERN.test(v)) return v;
      const seg = u.pathname.split('/').filter(Boolean);
      const PREFIX = ['shorts', 'embed', 'live', 'v', 'e'];
      if (seg.length >= 2 && PREFIX.includes(seg[0])) {
        const id = seg[1];
        if (ID_PATTERN.test(id)) return id;
      }
    }
  } catch {}
  const fallback = url.match(/(?:v=|\/|%2F)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/);
  return fallback ? fallback[1] : null;
}

console.log(extractVideoId('https://www.youtube.com/shorts/JwRWtuFgkTU'));
