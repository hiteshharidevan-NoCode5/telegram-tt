import type { ApiMessage } from '../api/types';
import { ApiMediaFormat } from '../api/types';
import { getGlobal } from '../global';
import { getMessageMediaHash } from '../global/helpers';
import * as mediaLoader from './mediaLoader';

export interface EpaperConfig {
  enabled: boolean;
  startHour: number;
  endHour: number;
  channelIds: string[];
  keywords: string;
}

export interface EpaperLogEntry {
  time: string;
  filename: string;
  chatTitle: string;
  status: string;
}

const CONFIG_KEY = 'altgram_epaper_config_v1';
const DOWNLOADED_KEY = 'altgram_epaper_downloaded_v1';
const LOGS_KEY = 'altgram_epaper_logs_v1';

const DEFAULT_CONFIG: EpaperConfig = {
  enabled: true,
  startHour: 6,
  endHour: 12,
  channelIds: [],
  keywords: '',
};

const activeDownloads = new Set<string>();

export function getEpaperConfig(): EpaperConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveEpaperConfig(config: EpaperConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event('altgram-epaper-updated'));
}

export function getEpaperLogs(): EpaperLogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendLog(entry: EpaperLogEntry) {
  const logs = getEpaperLogs();
  logs.unshift(entry);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 40)));
  window.dispatchEvent(new Event('altgram-epaper-updated'));
}

function getDownloadedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markDownloaded(key: string) {
  const set = getDownloadedSet();
  set.add(key);
  const arr = Array.from(set).slice(-500);
  localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(arr));
}

export function isWithinMorningWindow(config = getEpaperConfig()): boolean {
  const hour = new Date().getHours();
  return hour >= config.startHour && hour <= config.endHour;
}

function matchesKeywords(filename: string, caption: string, keywordsRaw: string): boolean {
  const terms = keywordsRaw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${filename} ${caption}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

function saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const bridge = (window as any).AndroidBlobDownloader;
      if (bridge && typeof bridge.saveSilentEpaper === 'function') {
        bridge.saveSilentEpaper(dataUrl, filename);
        resolve();
      } else if (bridge && typeof bridge.getBase64FromBlobData === 'function') {
        bridge.getBase64FromBlobData(dataUrl, filename);
        resolve();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve();
      }
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export async function processEpaperMessage(
  chatId: string,
  message: ApiMessage,
  forceIgnoreWindow = false,
): Promise<boolean> {
  const config = getEpaperConfig();
  if (!config.enabled && !forceIgnoreWindow) return false;
  if (!config.channelIds.includes(chatId)) return false;
  if (!forceIgnoreWindow && !isWithinMorningWindow(config)) return false;

  const doc = message.content?.document;
  if (!doc) return false;

  const rawName = doc.fileName || '';
  const isPdf = rawName.toLowerCase().endsWith('.pdf') || doc.mimeType === 'application/pdf';
  if (!isPdf) return false;

  const caption = message.content?.text?.text || '';
  if (!matchesKeywords(rawName, caption, config.keywords)) return false;

  const uniqueKey = `${chatId}_${message.id}`;
  if (getDownloadedSet().has(uniqueKey) || activeDownloads.has(uniqueKey)) {
    return false;
  }

  const mediaHash = getMessageMediaHash(message, 'download');
  if (!mediaHash) return false;

  activeDownloads.add(uniqueKey);
  const global = getGlobal();
  const chatTitle = global.chats?.byId?.[chatId]?.title || chatId;
  const safeName = sanitizeFilename(rawName || `epaper_${chatId}_${message.id}.pdf`);

  try {
    const blobUrl = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
    if (!blobUrl) throw new Error('Empty media blob');
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    await saveBlobToDevice(blob, safeName);
    markDownloaded(uniqueKey);
    appendLog({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      filename: safeName,
      chatTitle,
      status: 'Saved to Downloads/AltGram',
    });
    return true;
  } catch (err: any) {
    appendLog({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      filename: safeName,
      chatTitle,
      status: `Error: ${err?.message || 'Download failed'}`,
    });
    return false;
  } finally {
    activeDownloads.delete(uniqueKey);
  }
}

export async function runEpaperSync(force = false): Promise<number> {
  const config = getEpaperConfig();
  if (!force) {
    if (!config.enabled || !isWithinMorningWindow(config)) return 0;
  }
  if (config.channelIds.length === 0) return 0;

  const global = getGlobal();
  const messagesByChat = global.messages?.byChatId || {};
  const todayStartSec = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  let count = 0;

  for (const chatId of config.channelIds) {
    const chatMessages = messagesByChat[chatId]?.byId;
    if (!chatMessages) continue;
    const msgs = Object.values(chatMessages)
      .filter((m) => m && m.date >= todayStartSec)
      .sort((a, b) => b.id - a.id);

    for (const msg of msgs) {
      const ok = await processEpaperMessage(chatId, msg, force);
      if (ok) count += 1;
    }
  }
  return count;
}

let schedulerStarted = false;

export function initEpaperScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  (window as any).__triggerAltGramEpaperSync = () => {
    void runEpaperSync(false);
  };

  setTimeout(() => {
    void runEpaperSync(false);
  }, 15000);

  setInterval(() => {
    void runEpaperSync(false);
  }, 60 * 60 * 1000);
}
