import React, { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// FLOWSTATE FRONTEND
// Aesthetic: Surgical Brutalism — precision meets warmth
// ============================================================================

const API_BASE = 'http://localhost:3001';

// Distinctive fonts from Google Fonts
const FONTS_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

// Inject fonts
if (typeof document !== 'undefined' && !document.getElementById('flowstate-fonts')) {
  const fontEl = document.createElement('div');
  fontEl.id = 'flowstate-fonts';
  fontEl.innerHTML = FONTS_LINK;
  document.head.appendChild(fontEl);
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  // Core Layout
  container: {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    fontFamily: '"Outfit", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  
  header: {
    padding: '20px 32px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-elevated)',
  },
  
  logo: {
    fontFamily: '"Syne", sans-serif',
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  
  logoIcon: {
    width: '32px',
    height: '32px',
    background: 'var(--accent)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 420px',
    gap: '1px',
    background: 'var(--border)',
  },
  
  // Preview Panel
  previewPanel: {
    background: 'var(--bg-base)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  
  previewHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  previewTitle: {
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
  },
  
  previewCanvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: `
      radial-gradient(circle at 20% 80%, rgba(212, 255, 0, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(212, 255, 0, 0.02) 0%, transparent 50%),
      var(--bg-sunken)
    `,
  },
  
  previewIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: '0',
  },
  
  dropZone: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    background: 'var(--bg-sunken)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  dropZoneActive: {
    background: 'rgba(212, 255, 0, 0.05)',
    borderColor: 'var(--accent)',
  },
  
  dropIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    border: '2px dashed var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: 'var(--text-muted)',
    transition: 'all 0.2s ease',
  },
  
  dropText: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    maxWidth: '280px',
    lineHeight: 1.5,
  },
  
  dropHint: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    marginTop: '-8px',
  },
  
  // Control Panel
  controlPanel: {
    background: 'var(--bg-elevated)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  
  controlHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
  },
  
  controlTitle: {
    fontFamily: '"Syne", sans-serif',
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  
  controlSubtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  
  controlBody: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  
  // Status Badge
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: 500,
  },
  
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  
  // Section
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: 'var(--text-muted)',
  },
  
  // Defect Cards
  defectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  
  defectCard: {
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    position: 'relative',
    paddingLeft: '28px',
    animation: 'slideIn 0.3s ease forwards',
    opacity: 0,
    transform: 'translateX(-10px)',
  },
  
  defectDot: {
    position: 'absolute',
    left: '14px',
    top: '18px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--warning)',
  },
  
  // Code Display
  codeBlock: {
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  
  codeHeader: {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-base)',
  },
  
  codeTitle: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    fontFamily: '"JetBrains Mono", monospace',
  },
  
  codeContent: {
    padding: '16px',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    maxHeight: '200px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  
  // Diff
  diffLine: {
    padding: '2px 0',
  },
  
  diffAdded: {
    color: 'var(--success)',
    background: 'rgba(34, 197, 94, 0.1)',
    padding: '2px 4px',
    borderRadius: '2px',
  },
  
  diffRemoved: {
    color: '#F87171',
    background: 'rgba(248, 113, 113, 0.1)',
    padding: '2px 4px',
    borderRadius: '2px',
    textDecoration: 'line-through',
  },
  
  // Buttons
  button: {
    padding: '14px 24px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: '"Outfit", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  
  buttonPrimary: {
    background: 'var(--accent)',
    color: 'var(--bg-base)',
  },
  
  buttonSecondary: {
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  
  buttonGhost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: '8px 12px',
  },
  
  // Input
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-base)',
    color: 'var(--text-primary)',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  
  // Loading
  loadingShimmer: {
    background: `linear-gradient(
      90deg,
      var(--bg-base) 0%,
      var(--bg-elevated) 50%,
      var(--bg-base) 100%
    )`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '8px',
    height: '40px',
  },
  
  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: 'var(--text-muted)',
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
};

// CSS Variables & Animations
const cssVariables = `
  :root {
    --bg-base: #0A0A0B;
    --bg-elevated: #111113;
    --bg-sunken: #050506;
    --border: #27272A;
    --text-primary: #FAFAFA;
    --text-secondary: #D4D4D8;
    --text-muted: #71717A;
    --text-faint: #52525B;
    --accent: #D4FF00;
    --accent-hover: #E8FF4D;
    --success: #22C55E;
    --warning: #FBBF24;
    --error: #EF4444;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    background: var(--bg-base);
    overflow: hidden;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  @keyframes slideIn {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes healPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(212, 255, 0, 0.4); }
    50% { box-shadow: 0 0 0 12px rgba(212, 255, 0, 0); }
  }
  
  .heal-pulse {
    animation: healPulse 2s infinite;
  }
  
  .fade-in {
    animation: fadeIn 0.4s ease forwards;
  }
  
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--bg-base);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-faint);
  }
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('flowstate-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'flowstate-styles';
  styleEl.textContent = cssVariables;
  document.head.appendChild(styleEl);
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }) {
  const config = {
    idle: { bg: 'var(--bg-base)', dot: 'var(--text-faint)', text: 'Ready' },
    inspecting: { bg: 'rgba(251, 191, 36, 0.1)', dot: 'var(--warning)', text: 'Inspecting...' },
    healing: { bg: 'rgba(212, 255, 0, 0.1)', dot: 'var(--accent)', text: 'Healing...' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', dot: 'var(--success)', text: 'Healed' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', dot: 'var(--error)', text: 'Error' },
  };
  
  const { bg, dot, text } = config[status] || config.idle;
  
  return (
    <div style={{ ...styles.statusBadge, background: bg }}>
      <div style={{ ...styles.statusDot, background: dot }} />
      {text}
    </div>
  );
}

function DefectCard({ defect, index }) {
  return (
    <div 
      style={{ 
        ...styles.defectCard,
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div style={styles.defectDot} />
      {defect}
    </div>
  );
}

function CodeBlock({ title, code, language = 'jsx' }) {
  return (
    <div style={styles.codeBlock}>
      <div style={styles.codeHeader}>
        <span style={styles.codeTitle}>{title}</span>
        <button 
          style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px', fontSize: '11px' }}
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </button>
      </div>
      <pre style={styles.codeContent}>{code}</pre>
    </div>
  );
}

function DiffView({ original, fixed }) {
  if (!original || !fixed) return null;
  
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const maxLen = Math.max(origLines.length, fixedLines.length);
  
  const diffs = [];
  for (let i = 0; i < maxLen; i++) {
    if (origLines[i] !== fixedLines[i]) {
      if (origLines[i]) diffs.push({ type: 'removed', line: origLines[i], num: i + 1 });
      if (fixedLines[i]) diffs.push({ type: 'added', line: fixedLines[i], num: i + 1 });
    }
  }
  
  if (diffs.length === 0) return null;
  
  return (
    <div style={styles.codeBlock}>
      <div style={styles.codeHeader}>
        <span style={styles.codeTitle}>Changes ({diffs.length} lines)</span>
      </div>
      <pre style={styles.codeContent}>
        {diffs.slice(0, 20).map((d, i) => (
          <div key={i} style={styles.diffLine}>
            <span style={d.type === 'added' ? styles.diffAdded : styles.diffRemoved}>
              {d.type === 'added' ? '+' : '-'} {d.line}
            </span>
          </div>
        ))}
        {diffs.length > 20 && (
          <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            ... and {diffs.length - 20} more changes
          </div>
        )}
      </pre>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function FlowStateApp() {
  const [status, setStatus] = useState('idle');
  const [screenshot, setScreenshot] = useState(null);
  const [code, setCode] = useState('');
  const [defects, setDefects] = useState([]);
  const [fixedCode, setFixedCode] = useState(null);
  const [assetPrompt, setAssetPrompt] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);
  
  // Handle file drop/select
  const handleFile = useCallback((file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshot(e.target.result);
      setDefects([]);
      setFixedCode(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);
  
  // Heal action
  const handleHeal = async () => {
    if (!screenshot || !code.trim()) {
      setError('Need both a screenshot and component code');
      return;
    }
    
    setStatus('inspecting');
    setError(null);
    
    try {
      // Extract base64 data from data URL
      const base64Data = screenshot.split(',')[1];
      
      const response = await fetch(`${API_BASE}/api/heal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: base64Data,
          code: code,
          mimeType: 'image/png',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.looks_good) {
          setStatus('success');
          setDefects([]);
        } else {
          setStatus('healing');
          setDefects(result.defects || []);
          setFixedCode(result.fixedCode);
          setAssetPrompt(result.assetPrompt);
          
          setTimeout(() => setStatus('success'), 500);
        }
      } else {
        throw new Error(result.error || 'Healing failed');
      }
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  };
  
  // Apply fixed code
  const handleApply = () => {
    if (fixedCode) {
      setCode(fixedCode);
      setFixedCode(null);
    }
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🌊</div>
          FlowState
        </div>
        <StatusBadge status={status} />
      </header>
      
      {/* Main Content */}
      <main style={styles.main}>
        {/* Preview Panel */}
        <div style={styles.previewPanel}>
          <div style={styles.previewHeader}>
            <span style={styles.previewTitle}>Preview</span>
            {screenshot && (
              <button 
                style={{ ...styles.button, ...styles.buttonGhost }}
                onClick={() => { setScreenshot(null); setDefects([]); setFixedCode(null); }}
              >
                Clear
              </button>
            )}
          </div>
          
          <div style={styles.previewCanvas}>
            {screenshot ? (
              <img 
                src={screenshot} 
                alt="UI Screenshot"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  display: 'block',
                  margin: 'auto',
                }}
              />
            ) : (
              <div 
                style={{ 
                  ...styles.dropZone,
                  ...(dragActive ? styles.dropZoneActive : {}),
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ 
                  ...styles.dropIcon,
                  ...(dragActive ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}),
                }}>
                  📸
                </div>
                <p style={styles.dropText}>
                  Drop a screenshot of your broken UI, or click to browse
                </p>
                <p style={styles.dropHint}>PNG, JPG up to 10MB</p>
                <input 
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Control Panel */}
        <div style={styles.controlPanel}>
          <div style={styles.controlHeader}>
            <h2 style={styles.controlTitle}>Flow Stream</h2>
            <p style={styles.controlSubtitle}>Drop a screenshot, paste your code, heal.</p>
          </div>
          
          <div style={styles.controlBody}>
            {/* Code Input */}
            <div style={styles.section}>
              <label style={styles.sectionLabel}>Component Code</label>
              <textarea
                style={styles.textarea}
                placeholder="Paste your React component here..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            
            {/* Error */}
            {error && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '13px',
                color: 'var(--error)',
              }}>
                {error}
              </div>
            )}
            
            {/* Heal Button */}
            <button
              style={{ 
                ...styles.button, 
                ...styles.buttonPrimary,
                opacity: (!screenshot || !code.trim() || status === 'inspecting' || status === 'healing') ? 0.5 : 1,
              }}
              className={status === 'idle' && screenshot && code.trim() ? 'heal-pulse' : ''}
              onClick={handleHeal}
              disabled={!screenshot || !code.trim() || status === 'inspecting' || status === 'healing'}
            >
              {status === 'inspecting' || status === 'healing' ? (
                <>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                  {status === 'inspecting' ? 'Inspecting...' : 'Healing...'}
                </>
              ) : (
                <>
                  ✨ Heal
                </>
              )}
            </button>
            
            {/* Defects */}
            {defects.length > 0 && (
              <div style={styles.section} className="fade-in">
                <label style={styles.sectionLabel}>
                  Defects Found ({defects.length})
                </label>
                <div style={styles.defectList}>
                  {defects.map((defect, i) => (
                    <DefectCard key={i} defect={defect} index={i} />
                  ))}
                </div>
              </div>
            )}
            
            {/* Diff View */}
            {fixedCode && (
              <div style={styles.section} className="fade-in">
                <label style={styles.sectionLabel}>Changes</label>
                <DiffView original={code} fixed={fixedCode} />
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    style={{ ...styles.button, ...styles.buttonPrimary, flex: 1 }}
                    onClick={handleApply}
                  >
                    Apply Fix
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={() => setFixedCode(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            
            {/* Asset Generation Prompt */}
            {assetPrompt && (
              <div style={styles.section} className="fade-in">
                <label style={styles.sectionLabel}>Asset Generation</label>
                <div style={{
                  background: 'rgba(212, 255, 0, 0.05)',
                  border: '1px solid rgba(212, 255, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: 'var(--accent)' }}>Suggested asset:</strong>
                  <p style={{ marginTop: '8px', lineHeight: 1.5 }}>{assetPrompt}</p>
                </div>
              </div>
            )}
            
            {/* Empty State */}
            {status === 'idle' && defects.length === 0 && !fixedCode && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🔍</div>
                <p>Upload a screenshot and paste your code to begin</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
