import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';

const PRESETS = [
  {
    id: 'assistant',
    label: 'General Assistant',
    prompt: 'You are a helpful and friendly voice assistant. Keep responses concise and conversational — avoid markdown, bullet points, or special formatting.',
  },
  {
    id: 'customer_service',
    label: 'Customer Service',
    prompt: 'You are a professional customer service agent. Be polite, empathetic, and solution-focused. Keep responses brief and clear. Always confirm what the customer needs before providing a solution.',
  },
  {
    id: 'sales',
    label: 'Sales Agent',
    prompt: 'You are a friendly and knowledgeable sales representative. Help customers understand the value of our products, answer their questions honestly, and guide them toward a decision without being pushy. Keep it conversational.',
  },
  {
    id: 'tech_support',
    label: 'Tech Support',
    prompt: 'You are a patient technical support specialist. Help users troubleshoot issues step by step. Ask clarifying questions when needed, explain solutions in plain language, and confirm the issue is resolved.',
  },
  {
    id: 'receptionist',
    label: 'Receptionist',
    prompt: 'You are a warm and professional receptionist. Greet callers by name when possible, understand their reason for calling, collect relevant details, and direct them to the right department or person.',
  },
  { id: 'custom', label: '✏️ Custom', prompt: '' },
];

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
  </svg>
);

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [activePreset, setActivePreset] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        setName(s.ai_name || '');
        setPrompt(s.system_prompt || '');
        const matched = PRESETS.find(p => p.id !== 'custom' && p.prompt.trim() === (s.system_prompt || '').trim());
        if (matched) setActivePreset(matched.id);
      })
      .catch(() => {});
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const selectPreset = (preset) => {
    setActivePreset(preset.id);
    if (preset.prompt) setPrompt(preset.prompt);
  };

  const handlePromptChange = (val) => {
    setPrompt(val);
    const matched = PRESETS.find(p => p.id !== 'custom' && p.prompt.trim() === val.trim());
    setActivePreset(matched ? matched.id : 'custom');
  };

  const previewVoice = async () => {
    setPreviewing(true);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Hi, I'm ${name || 'Aria'}. How can I help you today?` }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play();
      } else {
        showToast('Preview unavailable — server may still be loading', 'error');
      }
    } catch {
      showToast('Preview unavailable', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_name: name.trim() || 'Aria', system_prompt: prompt.trim() }),
      });
      if (res.ok) showToast('Settings saved!', 'success');
      else showToast('Save failed', 'error');
    } catch {
      showToast('Save failed', 'error');
    }
  };

  return (
    <div className="settings-root">
      <header className="settings-header">
        <Link to="/" className="back-link">
          <BackIcon /> Back
        </Link>
        <span className="page-title">Settings</span>
        <button className="save-btn-sm" onClick={save}>Save</button>
      </header>

      <div className="settings-content">

        {/* Identity */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">🤖</span>
            <div>
              <div className="card-title">Agent Identity</div>
              <div className="card-desc">How your AI presents itself</div>
            </div>
          </div>
          <div className="card-body">
            <div className="field">
              <label>Agent Name</label>
              <input
                type="text"
                placeholder="e.g. Aria, Alex, Nova…"
                maxLength={32}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Context / Instructions */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">📋</span>
            <div>
              <div className="card-title">Agent Instructions</div>
              <div className="card-desc">Define your agent's role, context, and behaviour</div>
            </div>
          </div>
          <div className="card-body">
            <div className="field">
              <label>Quick Presets</label>
              <div className="preset-row">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip${activePreset === p.id ? ' active' : ''}`}
                    onClick={() => selectPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>System Prompt / Context</label>
              <textarea
                placeholder="Describe how your agent should behave, what it knows, and any context it needs…"
                value={prompt}
                onChange={e => handlePromptChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Voice */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">🔊</span>
            <div>
              <div className="card-title">Voice</div>
              <div className="card-desc">Powered by Sesame CSM-1B</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Sesame CSM — Human-like Neural Voice</div>
                <div style={{ fontSize: '12px', color: 'var(--sub)' }}>Generates natural speech locally. Uses CUDA on RunPod GPU instances.</div>
              </div>
              <button className="preview-btn" onClick={previewVoice} disabled={previewing} style={{ flexShrink: 0 }}>
                {previewing ? 'Generating…' : '▶ Preview'}
              </button>
            </div>
          </div>
        </div>

      </div>

      <div className="save-bar">
        <button className="save-btn-lg" onClick={save}>Save Settings</button>
      </div>

      {toast && (
        <div className={`settings-toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
