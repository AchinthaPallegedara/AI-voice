import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVoiceAgent } from '../hooks/useVoiceAgent.js';

const PhoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07A19.5 19.5 0 013.95 13a19.8 19.8 0 01-3.07-8.67A2 2 0 012.87 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
    <path d="M19 10v2a7 7 0 01-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const MicOffIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
    <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const EndIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.8 19.8 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Voice waveform visualiser
const BAR_SCALES = [0.5, 0.8, 1.0, 0.8, 0.5];

function WaveBars({ level, state }) {
  const isUser = state === 'recording';
  const isAI   = state === 'speaking';
  const active = isUser || isAI;
  return (
    <div className="wave-bars">
      {BAR_SCALES.map((scale, i) => (
        <div
          key={i}
          className={`wave-bar${isUser ? ' wave-bar--user' : isAI ? ' wave-bar--ai' : ''}`}
          style={{
            height: active ? `${Math.max(4, level * scale * 30)}px` : '4px',
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function CallPage() {
  const {
    callState, statusText, messages, muted, elapsed, toast, audioLevel,
    startCall, endCall, toggleMute, resetConversation,
  } = useVoiceAgent();

  const [settings, setSettings] = useState({ ai_name: 'Aria' });
  const transcriptRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setSettings(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages]);

  const inCall = !['ready', 'connecting'].includes(callState);

  const avatarRingClass = [
    'avatar-ring',
    inCall && callState === 'idle'       ? 'listening'   : '',
    callState === 'recording'            ? 'recording'   : '',
    callState === 'speaking'             ? 'speaking'    : '',
    callState === 'processing'           ? 'processing'  : '',
  ].filter(Boolean).join(' ');

  const dotClass = [
    'status-dot',
    inCall && !['recording'].includes(callState) ? 'connected' : '',
    callState === 'recording'   ? 'recording'  : '',
    callState === 'processing'  ? 'processing' : '',
  ].filter(Boolean).join(' ');

  const name = settings.ai_name || 'Aria';

  return (
    <>
      <header className="page-header">
        <span className="logo">AI Voice</span>
        <Link to="/settings" className="icon-btn" title="Settings">
          <SettingsIcon />
        </Link>
      </header>

      <main className="call-main">
        <div className="avatar-section">
          <div className={avatarRingClass}>
            <div className="avatar">{name[0].toUpperCase()}</div>
          </div>
          <div className="ai-name">{name}</div>
          <div className="status-row">
            <span className={dotClass} />
            <span>{statusText}</span>
          </div>
          {inCall && <div className="timer">{formatTime(elapsed)}</div>}
        </div>

        {inCall && (
          <WaveBars level={audioLevel} state={callState} />
        )}

        <div className="transcript-card">
          <div className="transcript-header">
            <span>Transcript</span>
            {inCall && messages.length > 0 && (
              <button className="reset-link" onClick={resetConversation}>Clear</button>
            )}
          </div>
          <div className="transcript-body" ref={transcriptRef}>
            {messages.length === 0 ? (
              <span className="transcript-empty">
                {inCall ? 'Just start speaking — your conversation will appear here.' : 'Your conversation will appear here.'}
              </span>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`message ${m.role}`}>
                  <span className="msg-role">{m.role === 'user' ? 'You' : name}</span>
                  <div className="msg-bubble">{m.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {!inCall ? (
        <div className="prereq-section">
          <button className="call-btn" onClick={startCall} disabled={callState === 'connecting'}>
            <PhoneIcon />
            {callState === 'connecting' ? 'Connecting…' : 'Start Call'}
          </button>
          <span className="call-hint">Mic activates automatically when you speak</span>
        </div>
      ) : (
        <div className="controls">
          <button
            className={`ctrl-btn${muted ? ' muted' : ''}`}
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>

          <button className="end-btn" onClick={endCall} title="End Call">
            <EndIcon />
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
