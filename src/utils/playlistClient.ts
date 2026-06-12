import { Channel } from "../types";

// Helper to make stable unique IDs
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

// Map M3U group titles to tidy user categories
function normalizeCategory(group: string): string {
  const g = group.toLowerCase().trim();
  if (g.includes('bangla') || g.includes('bd') || g.includes('bangladeshi')) return 'Bangla';
  if (g.includes('sports') || g.includes('sport') || g.includes('cricket') || g.includes('football')) return 'Sports';
  if (g.includes('news') || g.includes('khabor')) return 'News';
  if (g.includes('movie') || g.includes('cinema') || g.includes('film')) return 'Movies';
  if (g.includes('music') || g.includes('gaana') || g.includes('song')) return 'Music';
  if (g.includes('kids') || g.includes('cartoon') || g.includes('for children')) return 'Kids';
  if (g.includes('entertainment') || g.includes('drama') || g.includes('serial') || g.includes('tv series')) return 'Entertainment';
  if (g.includes('infotainment') || g.includes('discovery') || g.includes('knowledge') || g.includes('documentary')) return 'Infotainment';
  if (g.includes('religious') || g.includes('islamic') || g.includes('islami') || g.includes('religion') || g.includes('koran')) return 'Religious';
  return 'Others';
}

function parseM3U(m3uContent: string): Channel[] {
  const channels: Channel[] = [];
  const lines = m3uContent.split('\n');
  let currentChannel: Partial<Channel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      
      const commaIndex = line.lastIndexOf(',');
      const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown Channel';

      currentChannel = {
        id: '',
        name,
        logo: logoMatch ? logoMatch[1] : '',
        originalGroup: groupMatch ? groupMatch[1] : 'Others',
        category: groupMatch ? normalizeCategory(groupMatch[1]) : 'Others'
      };
    } else if (line.startsWith('http') && currentChannel) {
      currentChannel.url = line;
      // Combine name slug and stream URL hash to create a collision-free safe ID
      currentChannel.id = `${slugify(currentChannel.name || 'channel')}-${Math.abs(hashCode(line))}`;
      channels.push(currentChannel as Channel);
      currentChannel = null;
    }
  }
  return channels;
}

export async function fetchChannelsClientSide(forceRefresh = false): Promise<Channel[]> {
  const cacheKey = "iptv_channels_cache";
  const cacheTimeKey = "iptv_channels_cache_time";
  const cacheDurationMs = 10 * 60 * 1000; // 10 minutes local cache lifetime

  if (!forceRefresh) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);
      if (cachedData && cachedTime) {
        const elapsed = Date.now() - parseInt(cachedTime, 10);
        if (elapsed < cacheDurationMs) {
          const channels = JSON.parse(cachedData);
          if (Array.isArray(channels) && channels.length > 0) {
            console.log(`[Client-Side Cache Optimizer] Load successful! Delivered ${channels.length} channels instantly from memory cache.`);
            return channels;
          }
        }
      }
    } catch (err) {
      console.warn("[Client-Side Cache Optimizer] Failed reading cache. Safe recovery to network fetch.", err);
    }
  }

  console.log('[Client-Side Fallback] Fetching IPTV playlist and features from GitHub directly...');
  
  // 1. Fetch main M3U playlist
  const playlistUrl = 'https://raw.githubusercontent.com/imShakil/tvlink/main/all.m3u';
  const playlistResp = await fetch(playlistUrl);
  if (!playlistResp.ok) {
    throw new Error(`Failed to fetch main playlist: ${playlistResp.status}`);
  }
  const m3uText = await playlistResp.text();
  const parsedChannels = parseM3U(m3uText);

  // Clear original M3U featured flags
  parsedChannels.forEach(c => {
    c.isFeatured = false;
  });

  const customFeatured: Channel[] = [
    {
      id: "fifaplustv-feat",
      name: "FIFA+ TV",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/aa/FIFA_logo_without_background.svg",
      url: "https://a62dad94.wurl.com/manifest/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWV1X0ZJRkFQbHVzRW5nbGlzaF9ITFM/5eac6633-2d13-4c4b-a7d9-9f627710266b/2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "fifaplusenglish-feat",
      name: "FIFA + English",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/aa/FIFA_logo_without_background.svg",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "eurosport-hd-feat",
      name: "EuroSport HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Eurosport_1_HD.png",
      url: "http://cdn.moviemazic.xyz:8083/Feedget/EurosportHD_17/index.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "tsports-hd-feat",
      name: "T Sports",
      logo: "https://upload.wikimedia.org/wikipedia/commons/f/ff/T_Sports_logo.png",
      url: "http://cdn.moviemazic.xyz:8083/TSportsHD/index.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "btv-hd-feat",
      name: "BTV",
      logo: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Bangladesh_Television_logo.png",
      url: "http://cdn.moviemazic.xyz:8083/btv/index.m3u8",
      category: "Bangla",
      originalGroup: "Featured Bangla",
      isFeatured: true
    },
    {
      id: "beinsports4-feat",
      name: "BEIN Sports 4",
      logo: "https://upload.wikimedia.org/wikipedia/commons/1/14/BeIN_Sports_Full_Logo.svg",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs4.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "beinsports3-feat",
      name: "BEIN Sports 3",
      logo: "https://upload.wikimedia.org/wikipedia/commons/1/14/BeIN_Sports_Full_Logo.svg",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "mahsun-sports-feat",
      name: "Mahsun Sports",
      logo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&h=128&fit=crop",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "sony-sports-3-feat",
      name: "Sony Sports 3",
      logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Sony_Sports_Network_logo_2022.png",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "sony-sports-1-feat",
      name: "Sony Sports 1",
      logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Sony_Sports_Network_logo_2022.png",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    },
    {
      id: "fifaplusfrance-feat",
      name: "FIFA + France",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/aa/FIFA_logo_without_background.svg",
      url: "https://andro.226503.xyz/checklist/androstreamlivebs2.m3u8",
      category: "Sports",
      originalGroup: "Featured Sports",
      isFeatured: true
    }
  ];

  // Mutate parsedChannels to inject our custom features at the beginning
  parsedChannels.unshift(...customFeatured);

  console.log(`[Client-Side Fallback] Successfully parsed ${parsedChannels.length} IPTV channels`);
  
  // Save to client cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify(parsedChannels));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
  } catch (err) {
    console.warn("[Client-Side Cache Optimizer] Failed storing content in localStorage (quota limits likely).", err);
  }

  return parsedChannels;
}
