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

export async function fetchChannelsClientSide(): Promise<Channel[]> {
  console.log('[Client-Side Fallback] Fetching IPTV playlist and features from GitHub directly...');
  
  // 1. Fetch main M3U playlist
  const playlistUrl = 'https://raw.githubusercontent.com/imShakil/tvlink/main/all.m3u';
  const playlistResp = await fetch(playlistUrl);
  if (!playlistResp.ok) {
    throw new Error(`Failed to fetch main playlist: ${playlistResp.status}`);
  }
  const m3uText = await playlistResp.text();
  const parsedChannels = parseM3U(m3uText);

  // 2. Fetch features.json
  try {
    const featuresUrl = 'https://raw.githubusercontent.com/imShakil/tvlink/main/features.json';
    const featuresResp = await fetch(featuresUrl);
    if (featuresResp.ok) {
      const schema = await featuresResp.json();
      if (schema && schema.channels && Array.isArray(schema.channels)) {
        const featuredChannelsList: any[] = schema.channels;
        
        featuredChannelsList.forEach((fc: any) => {
          // Mark isFeatured properties based on matching name or source URLs
          const match = parsedChannels.find(
            c => c.url.trim() === fc.source.trim() || c.name.toLowerCase() === fc.name.toLowerCase()
          );
          if (match) {
            match.isFeatured = true;
          } else {
            // If it's featured but not in list, we add it
            parsedChannels.push({
              id: fc.id || `feat-${slugify(fc.name)}-${Math.abs(hashCode(fc.source))}`,
              name: fc.name,
              logo: fc.logo || '',
              url: fc.source,
              category: fc.category === 'featured' ? 'Bangla' : normalizeCategory(fc.category || 'Others'),
              originalGroup: fc.category || 'featured',
              isFeatured: true
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('[Client-Side Fallback] Could not load features.json, continuing with M3U only:', e);
  }

  console.log(`[Client-Side Fallback] Successfully parsed ${parsedChannels.length} IPTV channels`);
  return parsedChannels;
}
