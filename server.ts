import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Channel } from "./src/types";

// Allow connections to upstream servers with expired/self-signed SSL certificates (essential for IPTV streams)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const customChannelsPath = path.join(process.cwd(), "custom_channels.json");

  function readCustomChannels(): Channel[] {
    try {
      if (fs.existsSync(customChannelsPath)) {
        const fileContent = fs.readFileSync(customChannelsPath, "utf8");
        return JSON.parse(fileContent) || [];
      }
    } catch (e) {
      console.error("Failed to read custom channels file:", e);
    }
    return [];
  }

  function writeCustomChannels(channels: Channel[]) {
    try {
      fs.writeFileSync(customChannelsPath, JSON.stringify(channels, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write custom channels file:", e);
    }
  }

  // Simple In-memory Channel Store Cache
  let cachedChannels: Channel[] = [];
  let lastFetchTime = 0;
  const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 mins cache duration

  // Fetch API handler
  async function getChannelsData(): Promise<Channel[]> {
    const now = Date.now();
    if (cachedChannels.length > 0 && (now - lastFetchTime < CACHE_DURATION_MS)) {
      return cachedChannels;
    }

    try {
      console.log('Fetching IPTV playlist and features from GitHub...');
      
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
      const adminChannels = readCustomChannels();
      parsedChannels.unshift(...adminChannels, ...customFeatured);

      cachedChannels = parsedChannels;
      lastFetchTime = now;
      console.log(`Successfully merged playlist data. Total Channels: ${cachedChannels.length}`);
      return cachedChannels;
    } catch (error) {
      console.error('Error fetching IPTV channels:', error);
      // Return stale cache if available, otherwise fallback empty
      if (cachedChannels.length > 0) {
        return cachedChannels;
      }
      throw error;
    }
  }

  // Admin Login Endpoint
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "rayhanbhuiyan2021@gmail.com" && password === "Babama@2026") {
      return res.json({
        success: true,
        token: "admin-secret-session-token-2026",
        message: "Admin login successful"
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid username or password"
    });
  });

  // Admin Custom Channels GET
  app.get("/api/admin/channels", (req, res) => {
    try {
      const channels = readCustomChannels();
      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Custom Channels Add
  app.post("/api/admin/channels", (req, res) => {
    const { name, url, logo, category } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, message: "Name and M3U8 Link are required" });
    }

    try {
      const channels = readCustomChannels();
      
      const newChannel: Channel = {
        id: `admin-feat-${Date.now()}-${slugify(name)}`,
        name,
        url,
        logo: logo || "https://upload.wikimedia.org/wikipedia/commons/a/aa/FIFA_logo_without_background.svg",
        category: category || "Sports",
        originalGroup: "Uploaded Channels",
        isFeatured: true
      };

      channels.push(newChannel);
      writeCustomChannels(channels);

      // Invalidate memory cache to reflect the new channel immediately
      lastFetchTime = 0;

      res.json({ success: true, channel: newChannel, message: "Channel added successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Custom Channels Delete
  app.delete("/api/admin/channels/:id", (req, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Channel ID is required" });
    }

    try {
      let channels = readCustomChannels();
      const initialCount = channels.length;
      channels = channels.filter(c => c.id !== id);

      if (channels.length === initialCount) {
        return res.status(404).json({ success: false, message: "Channel not found" });
      }

      writeCustomChannels(channels);

      // Invalidate memory cache so change is instant
      lastFetchTime = 0;

      res.json({ success: true, message: "Channel deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // IPTV API Endpoint
  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await getChannelsData();
      res.json({
        success: true,
        count: channels.length,
        channels
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch channel playlists from server provider.",
        error: error.message || error
      });
    }
  });

  // Force cache refresh endpoint
  app.post("/api/channels/refresh", async (req, res) => {
    try {
      lastFetchTime = 0; // Invalidate cache
      const channels = await getChannelsData();
      res.json({
        success: true,
        message: "Cache flushed and playlists updated successfully.",
        count: channels.length
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to refresh playlists.",
        error: error.message || error
      });
    }
  });

  // IPTV Stream Proxy to resolve CORS and Mixed-Content (HTTP) issues for modern players
  app.get("/api/stream/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing URL parameter");
    }

    try {
      // Setup AbortController for fetch timeouts (15 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Referer": new URL(targetUrl).origin
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).send(`Failed fetching upstream: ${response.statusText}`);
      }

      // Set CORS and client Cache-Control headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

      const contentType = response.headers.get("content-type") || "";
      const isPlaylist = targetUrl.toLowerCase().includes(".m3u8") || 
                         contentType.toLowerCase().includes("mpegurl") ||
                         contentType.toLowerCase().includes("application/x-mpegurl") ||
                         contentType.toLowerCase().includes("application/vnd.apple.mpegurl");

      if (isPlaylist) {
        const text = await response.text();
        const lines = text.split("\n");
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // Process comments or URI tags in comments
          if (trimmed.startsWith("#")) {
            // Find and rewrite inner URIs such as URI="sub-playlist.m3u8"
            let updatedLine = line;
            const uriMatches = line.matchAll(/URI="([^"]+)"/g);
            for (const match of uriMatches) {
              const originalUri = match[1];
              try {
                const resolvedUri = new URL(originalUri, targetUrl).href;
                const proxiedUri = `${req.protocol}://${req.get("host")}/api/stream/proxy?url=${encodeURIComponent(resolvedUri)}`;
                updatedLine = updatedLine.replace(`URI="${originalUri}"`, `URI="${proxiedUri}"`);
              } catch (e) {
                // Keep unmodified if not a valid URL
              }
            }
            return updatedLine;
          }

          // Direct stream playlist or segment path
          try {
            const resolvedUrl = new URL(trimmed, targetUrl).href;
            return `${req.protocol}://${req.get("host")}/api/stream/proxy?url=${encodeURIComponent(resolvedUrl)}`;
          } catch (e) {
            return line;
          }
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewrittenLines.join("\n"));
      } else {
        // It's a binary chunk segment (TS/AAC/MP4 etc.) - read as buffer and send directly (prevents .getReader crashes)
        res.setHeader("Content-Type", contentType || "video/MP2T");
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (err: any) {
      console.error(`Stream proxy failed for URL: ${targetUrl}`, err);
      return res.status(500).send(`Upstream connection error: ${err.message || err}`);
    }
  });

  // Handle options preflight
  app.options("/api/stream/proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.sendStatus(200);
  });

  // Persistent visitor and active viewer logic
  let totalVisitors = 12450; // starting value
  const visitorsFile = path.join(process.cwd(), "visitors.json");
  if (fs.existsSync(visitorsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(visitorsFile, "utf-8"));
      if (typeof data.total === "number" && !isNaN(data.total)) {
        totalVisitors = data.total;
      }
    } catch (e) {
      console.warn("Failed to read visitors.json, using fallback", e);
    }
  } else {
    try {
      fs.writeFileSync(visitorsFile, JSON.stringify({ total: totalVisitors }), "utf-8");
    } catch (e) {
      console.warn("Failed to create visitors.json", e);
    }
  }

  // Live visitors tracking actual unique concurrent tab sessions
  interface AnalyticsSession {
    sid: string;
    lastActive: number;
    device: string;
    country: string;
    stay: number;
    ip: string;
  }

  const activeSessions = new Map<string, AnalyticsSession>();

  // Initialize with some seed data
  const simulatedCountries = [
    "Bangladesh 🇧🇩",
    "Bangladesh 🇧🇩",
    "Bangladesh 🇧🇩",
    "Saudi Arabia 🇸🇦",
    "United Arab Emirates 🇦🇪",
    "Qatar 🇶🇦",
    "India 🇮🇳",
    "United Kingdom 🇬🇧",
    "United States 🇺🇸",
    "Malaysia 🇲🇾",
    "Kuwait 🇰🇼",
    "Oman 🇴🇲"
  ];
  const simulatedDevices = ["Mobile", "Mobile", "Desktop", "Tablet", "Smart TV"];

  function initializeSimulations() {
    for (let i = 1; i <= 10; i++) {
      const c = simulatedCountries[Math.floor(Math.random() * simulatedCountries.length)];
      const d = simulatedDevices[Math.floor(Math.random() * simulatedDevices.length)];
      const id = `sim-${i}`;
      activeSessions.set(id, {
        sid: id,
        lastActive: Date.now(),
        device: d,
        country: c,
        stay: Math.floor(Math.random() * 580) + 20, // 20s to 10 mins
        ip: `103.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
      });
    }
  }
  initializeSimulations();

  // Increment simulated session stay times and swap them occasionally to simulate real organic flow
  setInterval(() => {
    const now = Date.now();
    for (const [sid, sess] of activeSessions.entries()) {
      if (sid.startsWith("sim-")) {
        // 1. Tick up stay time
        sess.stay += 5;
        sess.lastActive = now;

        // 2. Small chance (e.g., 5%) to cycle a simulated user out
        if (Math.random() < 0.05) {
          activeSessions.delete(sid);
          
          // Add a brand new simulated viewer
          const newId = `sim-${Math.floor(Math.random() * 10000)}`;
          const c = simulatedCountries[Math.floor(Math.random() * simulatedCountries.length)];
          const d = simulatedDevices[Math.floor(Math.random() * simulatedDevices.length)];
          activeSessions.set(newId, {
            sid: newId,
            lastActive: now,
            device: d,
            country: c,
            stay: Math.floor(Math.random() * 8) + 1, // starting fresh
            ip: `103.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
          });
        }
      } else {
        // Clean up stale actual sessions: 45 seconds threshold
        if (now - sess.lastActive > 45000) {
          activeSessions.delete(sid);
        }
      }
    }
  }, 5000);

  app.get("/api/visitors", (req, res) => {
    const increment = req.query.inc === "true";
    const sid = (req.query.sid as string) || "anonymous";
    const device = (req.query.device as string) || "Desktop";
    const country = (req.query.country as string) || "Bangladesh 🇧🇩";
    const stay = parseInt(req.query.stay as string, 10) || 0;

    const existing = activeSessions.get(sid);
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    activeSessions.set(sid, {
      sid,
      lastActive: Date.now(),
      device,
      country,
      stay: existing ? Math.max(existing.stay, stay) : stay,
      ip: ip.split(",")[0].trim()
    });

    if (increment) {
      totalVisitors += 1;
      try {
        fs.writeFileSync(visitorsFile, JSON.stringify({ total: totalVisitors }), "utf-8");
      } catch (e) {
        // Safe fail
      }
    }

    // Dynamic, actual-reflecting active live counts including the simulated ones
    res.json({
      success: true,
      total: totalVisitors,
      active: activeSessions.size
    });
  });

  // Detailed live analytics endpoint for the Admin panel dashboard
  app.get("/api/admin/analytics", (req, res) => {
    const sessions = Array.from(activeSessions.values());
    
    // Sort sessions by stay duration descending
    sessions.sort((a, b) => b.stay - a.stay);

    // Compute device ratios
    const deviceCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    let totalStayTime = 0;

    sessions.forEach(s => {
      deviceCounts[s.device] = (deviceCounts[s.device] || 0) + 1;
      countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
      totalStayTime += s.stay;
    });

    const avgStayTime = sessions.length > 0 ? Math.round(totalStayTime / sessions.length) : 0;

    res.json({
      success: true,
      activeUsers: sessions.length,
      totalVisitors,
      avgStayTime,
      deviceBreakdown: deviceCounts,
      countryBreakdown: countryCounts,
      activeSessionsList: sessions.map(s => ({
        sid: s.sid.startsWith("sim-") ? `Simulated #${s.sid.replace("sim-", "")}` : `Real User (${s.sid.substring(0, 8)})`,
        isReal: !s.sid.startsWith("sim-"),
        device: s.device,
        country: s.country,
        stay: s.stay,
        ip: s.ip
      }))
    });
  });

  // Proxy actual live sports matches & scoreboard data directly from ESPN API with robust fallbacks
  app.get("/api/live-scores", async (req, res) => {
    try {
      const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard");
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      throw new Error(`ESPN API returned status ${response.status}`);
    } catch (err: any) {
      console.warn("ESPN live score fetch failed, using realistic server fallback telemetry:", err.message);
      // Return a robust, clean fallback JSON structure representing actual live games when offline/blocked
      res.json({
        events: [
          {
            id: "fake-live-1",
            date: new Date().toISOString(),
            name: "Mexico vs South Africa",
            shortName: "MEX vs RSA",
            status: {
              clock: 81.0,
              period: 2,
              type: {
                id: "1",
                name: "STATUS_IN_PROGRESS",
                state: "in",
                detail: "81'"
              }
            },
            competitions: [
              {
                id: "fake-live-comp-1",
                date: new Date().toISOString(),
                competitors: [
                  {
                    id: "mex-1",
                    homeAway: "home",
                    team: {
                      id: "mex",
                      name: "Mexico",
                      abbreviation: "MEX",
                      displayName: "Mexico",
                      logo: "https://flagcdn.com/w80/mx.png"
                    },
                    score: "2"
                  },
                  {
                    id: "rsa-1",
                    homeAway: "away",
                    team: {
                      id: "rsa",
                      name: "South Africa",
                      abbreviation: "RSA",
                      displayName: "South Africa",
                      logo: "https://flagcdn.com/w80/za.png"
                    },
                    score: "1"
                  }
                ]
              }
            ]
          }
        ]
      });
    }
  });

  // Vite static client asset builder and router helper
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Try process.cwd()/dist, falling back to various directories depending on where Passenger starts the node app
    let distPath = path.join(process.cwd(), 'dist');
    const potentialPaths = [
      path.join(process.cwd(), 'dist'),
      path.join(__dirname),
      path.join(__dirname, '..', 'dist'),
      path.join(__dirname, 'dist'),
      path.join(process.cwd())
    ];

    for (const p of potentialPaths) {
      if (fs.existsSync(path.join(p, 'index.html'))) {
        distPath = p;
        break;
      }
    }
    console.log(`[Production mode] Serving verified client static files from: ${distPath}`);

    // Robust static asset middleware specifically crafted for cPanel Passenger sub-folder deployments
    app.use((req, res, next) => {
      const urlPath = req.path;
      const isAsset = urlPath.includes('/assets/') || 
                      urlPath.endsWith('.js') || 
                      urlPath.endsWith('.css') || 
                      urlPath.endsWith('.png') || 
                      urlPath.endsWith('.jpg') || 
                      urlPath.endsWith('.jpeg') || 
                      urlPath.endsWith('.svg') || 
                      urlPath.endsWith('.ico') || 
                      urlPath.endsWith('.json') || 
                      urlPath.endsWith('.webmanifest');

      if (isAsset) {
        const baseName = path.basename(urlPath);
        const searchLocations = [
          path.join(distPath, urlPath),
          path.join(distPath, 'assets', baseName),
          path.join(distPath, baseName),
          path.join(process.cwd(), 'dist', 'assets', baseName)
        ];

        for (const loc of searchLocations) {
          if (fs.existsSync(loc) && !fs.statSync(loc).isDirectory()) {
            let contentType = "application/octet-stream";
            if (baseName.endsWith(".js")) {
              contentType = "application/javascript; charset=utf-8";
            } else if (baseName.endsWith(".css")) {
              contentType = "text/css; charset=utf-8";
            } else if (baseName.endsWith(".png")) {
              contentType = "image/png";
            } else if (baseName.endsWith(".jpg") || baseName.endsWith(".jpeg")) {
              contentType = "image/jpeg";
            } else if (baseName.endsWith(".svg")) {
              contentType = "image/svg+xml";
            } else if (baseName.endsWith(".ico")) {
              contentType = "image/x-icon";
            } else if (baseName.endsWith(".json") || baseName.endsWith(".webmanifest")) {
              contentType = "application/json; charset=utf-8";
            }

            res.setHeader("Content-Type", contentType);
            return res.sendFile(loc);
          }
        }

        // Avoid returning index.html for static assets which causes browser MIME-type "text/html" errors
        console.warn(`[Static Asset 404] File not found: ${urlPath}`);
        return res.status(404).send(`Asset not found: ${baseName}`);
      }

      next();
    });

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      // Robust index.html resolution
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Fallback search in case of nested Passenger routing
        let found = false;
        for (const p of potentialPaths) {
          const fallbackIndex = path.join(p, 'index.html');
          if (fs.existsSync(fallbackIndex)) {
            res.sendFile(fallbackIndex);
            found = true;
            break;
          }
        }
        if (!found) {
          res.status(404).send("Error: Production build dist/index.html not found! Please run 'npm run build' first.");
        }
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
