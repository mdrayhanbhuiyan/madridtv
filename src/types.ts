export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  category: string;
  originalGroup: string;
  isFeatured?: boolean;
}

export interface PlaybackHistoryItem {
  channelId: string;
  watchedAt: number;
}
