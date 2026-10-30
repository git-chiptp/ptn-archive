const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

export function parseYoutubeVideoId(value?: string | null): string | undefined {
  const source = value?.trim();
  if (!source) {
    return undefined;
  }
  if (YOUTUBE_VIDEO_ID_PATTERN.test(source)) {
    return source;
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return undefined;
  }
  let videoId = '';
  if (url.hostname.toLowerCase() === 'youtu.be') {
    const pathSegments = url.pathname.split('/').filter(Boolean);
    videoId = pathSegments.length === 1 ? pathSegments[0] : '';
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v') ?? '';
  } else if (/^\/(?:embed|shorts|live)\//i.test(url.pathname)) {
    videoId = url.pathname.split('/').filter(Boolean)[1] ?? '';
  }
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : undefined;
}

export function youtubeEmbedUrl(videoId: string): string | undefined {
  const normalized = parseYoutubeVideoId(videoId);
  return normalized
    ? `https://www.youtube-nocookie.com/embed/${normalized}?rel=0`
    : undefined;
}
