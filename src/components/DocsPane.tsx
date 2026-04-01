"use client";

import { useState } from "react";
import {
  Copy,
  Key,
  Send,
  Search,
  Code2,
  Terminal,
  FileJson,
  Maximize2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { STT_PUBLIC_MODEL, STT_PUBLIC_PROVIDER } from "@/lib/brand";

interface DocsPaneProps {
  apiBaseUrl: string;
  onCopyFeedback: (msg: string) => void;
  isAuthenticated?: boolean;
  apiKeyName?: string;
  onApiKeyNameChange?: (value: string) => void;
  onCreateApiKey?: () => void;
  onRefreshApiKeys?: () => void;
  isApiKeysLoading?: boolean;
  apiKeysStatus?: string;
  newlyCreatedApiKey?: string;
  onCopyNewApiKey?: () => void;
}

type Param = { name: string; type: string; required?: boolean; default?: string };

const ENDPOINTS = [
  {
    id: "tts",
    category: "Voice",
    title: "Text to Speech",
    method: "POST",
    path: "/api/voice/tts",
    fullPath: "/api/voice/tts",
    desc: "Converts text to natural speech. Returns an audio blob (MP3, WAV, or PCM).",
    params: [
      { name: "voiceId", type: "string", required: true, default: "EXAVITQu4vr4xnSDxMaL" },
      { name: "text", type: "string", required: true, default: "Hello world" },
      { name: "modelId", type: "string", required: true, default: "tts/echo_flash-v2.5" },
      { name: "outputFormat", type: "string", required: true, default: "mp3_44100_128" },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { type: "audio/mpeg", blob: "BASE64_DATA..." },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/api/voice/tts" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"voiceId":"EXAVITQu4vr4xnSDxMaL","text":"Hello world","modelId":"tts/echo_flash-v2.5","outputFormat":"mp3_44100_128"}'`,
      js: (base: string) => `const res = await fetch("${base}/api/voice/tts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    text: "Hello world",
    modelId: "tts/echo_flash-v2.5",
    outputFormat: "mp3_44100_128"
  })
});`,
      py: (base: string) => `import requests
r = requests.post("${base}/echo/tts", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, json={
    "voiceId": "EXAVITQu4vr4xnSDxMaL",
    "text": "Hello world",
    "modelId": "tts/echo_flash-v2.5",
    "outputFormat": "mp3_44100_128"
})`,
    },
  },
  {
    id: "stt",
    category: "Voice",
    title: "Speech to Text",
    method: "POST",
    path: "/api/voice/stt",
    fullPath: "/api/voice/stt",
    desc: "Transcribes uploaded audio to text.",
    params: [
      { name: "file", type: "file", required: true, default: "sample.wav" },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { text: "Hello world", language: "en", provider: STT_PUBLIC_PROVIDER, model: STT_PUBLIC_MODEL },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/api/voice/stt" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@sample.wav"`,
      js: (base: string) => `const formData = new FormData();
formData.append("file", fileInput.files[0]);
const res = await fetch("${base}/api/voice/stt", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY" },
  body: formData
});`,
      py: (base: string) => `import requests
with open("sample.wav", "rb") as audio_file:
    r = requests.post("${base}/api/voice/stt", headers={
        "Authorization": "Bearer YOUR_API_KEY"
    }, files={"file": audio_file})`,
    },
  },
  {
    id: "assistants",
    category: "Agents",
    title: "List Assistants",
    method: "GET",
    path: "/api/agents",
    fullPath: "/api/agents",
    desc: "Returns all configured assistants.",
    params: [],
    responseStatus: "200 OK",
    responseExample: { assistants: [{ id: "asst_xxx", name: "..." }] },
    examples: {
      curl: (base: string) => `curl -H "Authorization: Bearer YOUR_API_KEY" "${base}/api/agents"`,
      js: (base: string) => `const res = await fetch("${base}/api/agents", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});`,
      py: (base: string) => `r = requests.get("${base}/api/agents", headers={
    "Authorization": "Bearer YOUR_API_KEY"
})`,
    },
  },
  {
    id: "call",
    category: "Calls",
    title: "Start Outbound Call",
    method: "POST",
    path: "/api/calls/outbound",
    fullPath: "/api/calls/outbound",
    desc: "Initiates an outbound phone call from an assistant.",
    params: [
      { name: "assistantId", type: "string", required: true, default: "019c51ea-8ce8-4962-9b83-70023ec0d6c2" },
      { name: "customerNumber", type: "string", required: true, default: "+15551234567" },
    ] as Param[],
    responseStatus: "201 Created",
    responseExample: { id: "call_019c...", status: "ringing", type: "outboundPhoneCall" },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/api/calls/outbound" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"assistantId":"019c51ea-8ce8-4962-9b83-70023ec0d6c2","customerNumber":"+15551234567"}'`,
      js: (base: string) => `const res = await fetch("${base}/api/calls/outbound", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    assistantId: "019c51ea-8ce8-4962-9b83-70023ec0d6c2",
    customerNumber: "+15551234567"
  })
});`,
      py: (base: string) => `import requests
r = requests.post("${base}/orbit/call", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, json={
    "assistantId": "019c51ea-8ce8-4962-9b83-70023ec0d6c2",
    "customerNumber": "+15551234567"
})`,
    },
  },
  {
    id: "calls",
    category: "Calls",
    title: "List Calls",
    method: "GET",
    path: "/api/calls",
    fullPath: "/api/calls",
    desc: "Returns recent call records.",
    params: [] as Param[],
    responseStatus: "200 OK",
    responseExample: [{ id: "call_019c...", status: "completed", type: "webCall" }],
    examples: {
      curl: (base: string) => `curl -H "Authorization: Bearer YOUR_API_KEY" "${base}/api/calls"`,
      js: (base: string) => `await fetch("${base}/api/calls", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});`,
      py: (base: string) => `requests.get("${base}/api/calls", headers={
    "Authorization": "Bearer YOUR_API_KEY"
})`,
    },
  },
] as const;


export default function DocsPane({
  apiBaseUrl,
  onCopyFeedback,
  isAuthenticated,
  apiKeyName,
  onApiKeyNameChange,
  onCreateApiKey,
  onRefreshApiKeys,
  isApiKeysLoading,
  apiKeysStatus,
  newlyCreatedApiKey,
  onCopyNewApiKey,
}: DocsPaneProps) {
  const [selectedId, setSelectedId] = useState<string>("tts");
  const [codeTab, setCodeTab] = useState<"curl" | "js" | "py">("curl");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const selectedEndpoint = ENDPOINTS.find(e => e.id === selectedId) || ENDPOINTS[0];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopyFeedback("Copied!");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  const handleSendRequest = async () => {
    setIsSending(true);
    const start = Date.now();
    // Simulate API request for demo
    setTimeout(() => {
      setLastResponse(selectedEndpoint.responseExample);
      setLastStatus(selectedEndpoint.responseStatus);
      setLatency(Date.now() - start);
      setIsSending(false);
    }, 800);
  };

  const filteredEndpoints = ENDPOINTS.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedEndpointUrl = `${apiBaseUrl}${selectedEndpoint.path}`;

  return (
    <div className="docs-playground">
      {/* Sidebar */}
      <aside className="docs-pg-sidebar">
        <div className="docs-pg-search">
          <Search size={14} className="docs-pg-search-icon" />
          <input 
            type="text" 
            placeholder="Search endpoints..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="docs-pg-sidebar-content scroll-soft">
          <div className="docs-pg-group">
            <div className="docs-pg-group-title">Voice APIs</div>
            {filteredEndpoints.filter(e => e.category === "Voice").map(ep => (
              <button
                key={ep.id}
                className={`docs-pg-item ${selectedId === ep.id ? "active" : ""}`}
                onClick={() => setSelectedId(ep.id)}
              >
                <span className={`docs-pg-method docs-pg-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <span className="docs-pg-label">{ep.title}</span>
              </button>
            ))}
          </div>

          <div className="docs-pg-group">
            <div className="docs-pg-group-title">Agents & Calls</div>
            {filteredEndpoints.filter(e => ["Agents", "Calls"].includes(e.category)).map(ep => (
              <button
                key={ep.id}
                className={`docs-pg-item ${selectedId === ep.id ? "active" : ""}`}
                onClick={() => setSelectedId(ep.id)}
              >
                <span className={`docs-pg-method docs-pg-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <span className="docs-pg-label">{ep.title}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Middle: Request Params */}
      <main className="docs-pg-request scroll-soft">
        <div className="docs-pg-header">
          <div className="docs-pg-url-bar">
            <span className={`docs-pg-method-badge docs-pg-method-${selectedEndpoint.method.toLowerCase()}`}>{selectedEndpoint.method}</span>
            <code className="docs-pg-url-path">{selectedEndpointUrl}</code>
          </div>
          <button 
            className="btn primary docs-pg-send-btn"
            onClick={handleSendRequest}
            disabled={isSending}
          >
            {isSending ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
            <span>Send</span>
          </button>
        </div>

        <div className="docs-pg-auth-notice">
          <div className="docs-pg-auth-top">
            <Key size={14} />
            <span className="docs-pg-auth-label">Authentication</span>
          </div>
          
          {newlyCreatedApiKey ? (
            <div className="docs-pg-key-card">
              <div className="docs-pg-key-card-main">
                <span className="docs-pg-key-card-label">New API Key</span>
                <code className="docs-pg-key-card-value">{newlyCreatedApiKey}</code>
              </div>
              <button 
                className="btn icon-only docs-pg-key-card-copy"
                onClick={onCopyNewApiKey}
                title="Copy Key"
              >
                <Copy size={14} />
              </button>
            </div>
          ) : isAuthenticated ? (
            <div className="docs-pg-auth-actions">
              <input
                type="text"
                className="docs-pg-auth-input"
                placeholder="Key name (e.g. My App)"
                value={apiKeyName}
                onChange={(e) => onApiKeyNameChange?.(e.target.value)}
              />
              <button 
                className="btn primary docs-pg-create-key-btn"
                onClick={onCreateApiKey}
                disabled={isApiKeysLoading || !apiKeyName}
              >
                {isApiKeysLoading ? "..." : "Create Key"}
              </button>
              {onRefreshApiKeys && (
                <button 
                  className="btn icon-only docs-pg-refresh-btn"
                  onClick={onRefreshApiKeys}
                  title="Refresh keys"
                >
                  <Clock size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="docs-pg-auth-helper">
              Sign in to manage API keys.
            </div>
          )}
          {apiKeysStatus && (
            <div className="docs-pg-auth-status">
              {apiKeysStatus}
            </div>
          )}
        </div>

        <div className="docs-pg-section">
          <h3 className="docs-pg-section-title">Request</h3>
          {selectedEndpoint.params && selectedEndpoint.params.length > 0 ? (
            <div className="docs-pg-params-box">
              <span className="docs-pg-params-count">{selectedEndpoint.params.length} properties</span>
              <div className="docs-pg-params-list">
                {selectedEndpoint.params.map(p => (
                  <div key={p.name} className="docs-pg-param-item">
                    <div className="docs-pg-param-meta">
                      <code className="docs-pg-param-name">{p.name}</code>
                      <span className="docs-pg-param-type">{p.type} {p.required && <span className="docs-pg-required">*</span>}</span>
                    </div>
                    <input 
                      type="text" 
                      className="docs-pg-param-input" 
                      defaultValue={p.default || ""} 
                      placeholder={p.name}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="docs-pg-empty-params">No parameters required</div>
          )}
        </div>

        <div className="docs-pg-footer">
          <button className="docs-pg-clear" onClick={() => { setLastResponse(null); setLastStatus(null); }}>Clear</button>
          <a href={selectedEndpointUrl} className="docs-pg-ref-link" target="_blank" rel="noreferrer">Open endpoint <Maximize2 size={12} /></a>
        </div>
      </main>

      {/* Right: Code & Response */}
      <section className="docs-pg-output">
        {/* Code Block */}
        <div className="docs-pg-panel docs-pg-code-panel">
          <div className="docs-pg-panel-header">
            <div className="docs-pg-tabs">
              {(["curl", "js", "py"] as const).map((t) => (
                <button 
                  key={t}
                  className={`docs-pg-tab ${codeTab === t ? "active" : ""}`}
                  onClick={() => setCodeTab(t)}
                >
                  {t === "curl" && <Terminal size={12} />}
                  {t === "js" && <Code2 size={12} />}
                  {t === "py" && <FileJson size={12} />}
                  <span className="capitalize">{t === "curl" ? "cURL" : t === "js" ? "JS" : "Python"}</span>
                </button>
              ))}
            </div>
            <button className="docs-pg-copy-btn" onClick={() => copyToClipboard(selectedEndpoint.examples[codeTab](apiBaseUrl))}>
              <Copy size={14} />
            </button>
          </div>
          <div className="docs-pg-panel-content scroll-soft">
            <pre className="docs-pg-code-pre"><code>{selectedEndpoint.examples[codeTab](apiBaseUrl)}</code></pre>
          </div>
        </div>

        {/* Response Block */}
        <div className="docs-pg-panel docs-pg-response-panel">
          <div className="docs-pg-panel-header">
            <span className="docs-pg-panel-title">Response</span>
            {lastStatus && (
              <div className="docs-pg-response-meta">
                <span className="docs-pg-response-status"><CheckCircle2 size={12} /> {lastStatus}</span>
                <span className="docs-pg-response-separator">·</span>
                <span className="docs-pg-response-time">{latency}ms</span>
              </div>
            )}
          </div>
          <div className="docs-pg-panel-content docs-pg-response-content scroll-soft">
            {lastResponse ? (
              <pre className="docs-pg-response-pre"><code>{JSON.stringify(lastResponse, null, 2)}</code></pre>
            ) : (
              <div className="docs-pg-response-placeholder">
                <Send size={24} />
                <span className="docs-pg-response-placeholder-label">Ready to test</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
