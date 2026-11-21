import React, { memo, useEffect, useState } from '../../lib/teact/teact';
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
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="E-Paper Auto-Downloader"
        style={{
          position: 'fixed',
          top: '10px',
          right: '54px',
          zIndex: 9998,
          background: config.enabled ? '#1a73e8' : '#5f6368',
          color: '#fff',
          border: 'none',
          borderRadius: '16px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 600,
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }}
      >
        📰 {config.channelIds.length > 0 ? config.channelIds.length : ''}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#1e1e1e',
              color: '#f1f3f4',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '440px',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: '16px' }}>📰 E-Paper Auto-Downloader</strong>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  background: '#2a2a2a',
                  padding: '10px 12px',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Morning Hourly Sync</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    Auto-checks every hour from 6:00 AM to 12:00 PM
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e: any) => {
                    const next = { ...config, enabled: Boolean(e.target.checked) };
                    setConfig(next);
                    saveEpaperConfig(next);
                  }}
                />
              </label>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>
                  Keyword Filter (optional, comma-separated):
                </div>
                <input
                  type="text"
                  placeholder="e.g. Hindu, Express, Ahmedabad (blank = all PDFs)"
                  value={config.keywords}
                  onInput={(e: any) => {
                    const next = { ...config, keywords: e.target.value };
                    setConfig(next);
                    saveEpaperConfig(next);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    background: '#121212',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '6px' }}>
                  Select Channels to Monitor ({config.channelIds.length} selected):
                </div>
                <input
                  type="text"
                  placeholder="Filter your channels..."
                  value={search}
                  onInput={(e: any) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    marginBottom: '6px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    background: '#121212',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <div
                  style={{
                    maxHeight: '170px',
                    overflowY: 'auto',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    background: '#161616',
                  }}
                >
                  {filteredChannels.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '12px', color: '#888' }}>
                      No channels loaded yet. Open your chat list first so AltGram loads your channels.
                    </div>
                  ) : (
                    filteredChannels.map((ch: any) => (
                      <label
                        key={ch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderBottom: '1px solid #262626',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={config.channelIds.includes(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ch.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncNow}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#1a73e8',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now (Download Today\'s PDFs)'}
              </button>

              {statusMsg && (
                <div style={{ fontSize: '12px', color: '#8ab4f8', marginBottom: '10px' }}>
                  {statusMsg}
                </div>
              )}

              <div>
                <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>
                  Recent Activity (Saved to Downloads/AltGram):
                </div>
                <div
                  style={{
                    maxHeight: '110px',
                    overflowY: 'auto',
                    background: '#121212',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '11px',
                  }}
                >
                  {logs.length === 0 ? (
                    <div style={{ color: '#777' }}>No e-papers downloaded yet.</div>
                  ) : (
                    logs.map((l, idx) => (
                      <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid #222', paddingBottom: '3px' }}>
                        <strong>[{l.time}]</strong> {l.filename} — <span style={{ color: '#81c995' }}>{l.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(EpaperManager);
