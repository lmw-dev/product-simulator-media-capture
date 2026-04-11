const TRACKING_QUERY_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'si',
]);

function normalizeYoutubeUrl(parsedUrl) {
  const hostname = parsedUrl.hostname.replace(/^www\./, '');

  if (hostname === 'youtu.be') {
    const videoId = parsedUrl.pathname.replace(/^\/+/, '').split('/')[0];
    if (!videoId) {
      return null;
    }
    const canonical = new URL('https://www.youtube.com/watch');
    canonical.searchParams.set('v', videoId);
    return canonical.toString();
  }

  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
    return null;
  }

  if (parsedUrl.pathname.startsWith('/shorts/')) {
    const videoId = parsedUrl.pathname.replace('/shorts/', '').split('/')[0];
    if (!videoId) {
      return null;
    }
    const canonical = new URL('https://www.youtube.com/watch');
    canonical.searchParams.set('v', videoId);
    return canonical.toString();
  }

  if (parsedUrl.pathname === '/watch') {
    const videoId = parsedUrl.searchParams.get('v');
    if (!videoId) {
      return null;
    }
    const canonical = new URL('https://www.youtube.com/watch');
    canonical.searchParams.set('v', videoId);
    return canonical.toString();
  }

  return null;
}

function normalizeGenericUrl(parsedUrl) {
  const url = new URL(parsedUrl.toString());

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '');
    if (!url.pathname) {
      url.pathname = '/';
    }
  }

  const keptParams = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lowerKey)) {
      continue;
    }
    keptParams.push([key, value]);
  }

  keptParams.sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) {
      return aValue.localeCompare(bValue);
    }
    return aKey.localeCompare(bKey);
  });

  url.search = '';
  for (const [key, value] of keptParams) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

function normalizeUrl(rawUrl) {
  const input = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!input) {
    throw new Error('URL is required');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(input);
  } catch (error) {
    throw new Error(`Invalid URL: ${input}`);
  }

  const youtubeCanonical = normalizeYoutubeUrl(parsedUrl);
  if (youtubeCanonical) {
    return youtubeCanonical;
  }

  return normalizeGenericUrl(parsedUrl);
}

module.exports = {
  normalizeUrl,
};
