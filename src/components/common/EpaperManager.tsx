import React, { memo, useEffect, useState } from '../../lib/teact/teact';
import Portal from '../ui/Portal';
import { getGlobal } from '../../global';
import {
  getEpaperConfig,
  getEpaperLogs,
  initEpaperScheduler,
  runEpaperSync,
  saveEpaperConfig,
} from '../../util/epaperDownloader';

const EpaperManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(() => getEpaperConfig());
  const [logs, setLogs] = useState(() => getEpaperLogs());
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    initEpaperScheduler();
    const onUpdate = () => {
      setConfig(getEpaperConfig());
      setLogs(getEpaperLogs());
    };
    window.addEventListener('altgram-epaper-updated', onUpdate);
    return () => window.removeEventListener('altgram-epaper-updated', onUpdate);
  }, []);

  const global = getGlobal();
  const chatsById = global.chats?.byId || {};
  const channels = Object.values(chatsById)
    .filter((c: any) => c && (c.type === 'chatTypeChannel' || c.type === 'chatTypeSuperGroup'))
    .sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));

  const filteredChannels = channels.filter((c: any) =>
    (c.title || '').toLowerCase().includes(search.toLowerCase()),
  );

  const toggleChannel = (id: string) => {
    const exists = config.channelIds.includes(id);
    const nextIds = exists
      ? config.channelIds.filter((x) => x !== id)
      : [...config.channelIds, id];
    const next = { ...config, channelIds: nextIds };
    setConfig(next);
    saveEpaperConfig(next);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setStatusMsg('Checking selected channels for today\'s PDFs...');
    try {
      const downloaded = await runEpaperSync(true);
      setLogs(getEpaperLogs());
      setStatusMsg(
        downloaded > 0
          ? `Downloaded ${downloaded} new e-paper(s) to Downloads/AltGram!`
          : 'No new matching PDFs found in loaded messages today.',
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Portal>
      <button type="button" onClick={() => setIsOpen(true)} title="E-Paper Auto-Downloader" style={`position:fixed;top:12px;right:14px;z-index:9998;background:${config.enabled ? "#1a73e8" : "#5f6368"};color:#fff;border:none;border-radius:16px;padding:5px 11px;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;`}>
        📰 {config.channelIds.length > 0 ? config.channelIds.length : ""}
      </button>
      {isOpen && (
        <div style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;">
          <div style="background:#1e1e1e;color:#f1f3f4;border-radius:14px;width:100%;max-width:420px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.6);font-family:sans-serif;">
            <div style="padding:14px 16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">📰 E-Paper Auto-Downloader</strong>
              <button type="button" onClick={() => setIsOpen(false)} style="background:transparent;border:none;color:#aaa;font-size:20px;cursor:pointer;">✕</button>
            </div>
            <div style="padding:14px 16px;overflow-y:auto;flex:1;">
              <label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;background:#2a2a2a;padding:10px 12px;border-radius:8px;cursor:pointer;">
                <div><div style="font-weight:600;font-size:14px;">Morning Hourly Sync</div><div style="font-size:12px;color:#aaa;">Auto-checks every hour 6 AM – 12 PM</div></div>
                <input type="checkbox" checked={config.enabled} onChange={(e: any) => { const next = { ...config, enabled: Boolean(e.target.checked) }; setConfig(next); saveEpaperConfig(next); }} />
              </label>
              <div style="margin-bottom:12px;">
                <div style="font-size:12px;color:#bbb;margin-bottom:4px;">Keyword Filter (comma-separated):</div>
                <input type="text" placeholder="e.g. Hindu, Express (blank = all PDFs)" value={config.keywords} onInput={(e: any) => { const next = { ...config, keywords: e.target.value }; setConfig(next); saveEpaperConfig(next); }} style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #444;background:#121212;color:#fff;font-size:13px;" />
              </div>
              <div style="margin-bottom:12px;">
                <div style="font-size:12px;color:#bbb;margin-bottom:6px;">Select Channels ({config.channelIds.length} selected):</div>
                <input type="text" placeholder="Filter channels..." value={search} onInput={(e: any) => setSearch(e.target.value)} style="width:100%;box-sizing:border-box;padding:7px 10px;margin-bottom:6px;border-radius:8px;border:1px solid #444;background:#121212;color:#fff;font-size:13px;" />
                <div style="max-height:180px;overflow-y:auto;border:1px solid #333;border-radius:8px;background:#141414;">
                  {filteredChannels.map((ch: any) => (
                    <label key={ch.id} style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-bottom:1px solid #222;cursor:pointer;font-size:13px;">
                      <input type="checkbox" checked={config.channelIds.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{ch.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              {statusMsg && <div style="margin-bottom:10px;padding:8px 10px;border-radius:8px;background:#263238;color:#80cbc4;font-size:12px;">{statusMsg}</div>}
            </div>
            <div style="padding:12px 16px;border-top:1px solid #333;display:flex;gap:10px;">
              <button type="button" disabled={isSyncing} onClick={handleSyncNow} style="flex:1;background:#1a73e8;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;">{isSyncing ? "Syncing..." : "Sync Now"}</button>
              <button type="button" onClick={() => setIsOpen(false)} style="background:#333;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:14px;cursor:pointer;">Close</button>
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
};

export default memo(EpaperManager);
