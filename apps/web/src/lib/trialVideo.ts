type VideoSource = { kind: 'embed' | 'video'; url: string };

export function trialVideoSource(value: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'].includes(host)) {
    const id = host.endsWith('youtu.be') ? parts[0]
      : parts[0] === 'watch' ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null;
    return id && /^[\w-]{11}$/.test(id)
      ? { kind: 'embed', url: `https://www.youtube.com/embed/${id}?playsinline=1&rel=0` }
      : null;
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
    if (!id || !/^\d+$/.test(id)) return null;
    const embed = new URL(`https://player.vimeo.com/video/${id}`);
    const hash = url.searchParams.get('h') ?? (host === 'player.vimeo.com' ? null : parts[1]);
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) embed.searchParams.set('h', hash);
    return { kind: 'embed', url: embed.href };
  }

  // Direct media URLs can be signed or extensionless; let the browser detect the format.
  return { kind: 'video', url: url.href };
}
