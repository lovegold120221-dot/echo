"use client";

import { useState, useEffect } from "react";
import {
  Copy,
  AudioWaveform,
  Mic,
  PhoneCall,
  Zap,
  Key,
  Play,
} from "lucide-react";

const INBOUND_CALL_NUMBER = "+1 (844) 418 2027";

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

type DocTab = "documentation" | "api-reference";

type Param = { name: string; type: string; required?: boolean };

const ENDPOINTS = [
  {
    id: "tts",
    category: "TTS",
    title: "Text to Speech",
    method: "POST",
    path: "/echo/tts",
    fullPath: "/api/echo/tts",
    desc: "Converts text to natural speech. Returns an audio blob (MP3, WAV, or PCM).",
    params: [
      { name: "voiceId", type: "string", required: true },
      { name: "text", type: "string", required: true },
      { name: "modelId", type: "string", required: true },
      { name: "outputFormat", type: "string", required: true },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { type: "audio/mpeg", blob: "..." },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/tts" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"voiceId":"EXAVITQu4vr4xnSDxMaL","text":"Hello world","modelId":"tts/echo_flash-v2.5","outputFormat":"mp3_44100_128"}' \\
  --output audio.mp3`,
      js: (base: string) => `const res = await fetch("${base}/echo/tts", {
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
});
const blob = await res.blob();`,
      py: (base: string) => `import requests
r = requests.post("${base}/echo/tts", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, json={
    "voiceId": "EXAVITQu4vr4xnSDxMaL",
    "text": "Hello world",
    "modelId": "tts/echo_flash-v2.5",
    "outputFormat": "mp3_44100_128"
})
with open("audio.mp3", "wb") as f:
    f.write(r.content)`,
    },
  },
  {
    id: "stt",
    category: "Speech",
    title: "Speech to Text",
    method: "POST",
    path: "/echo/stt",
    fullPath: "/api/echo/stt",
    desc: "Transcribes audio to text with Deepgram. Send either a multipart file or a JSON URL payload.",
    params: [
      { name: "file", type: "File (multipart)" },
      { name: "url", type: "string (audio URL)" },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { text: "Hello world", language: "en", provider: "deepgram", model: "nova-3" },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/stt" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"}'`,
      js: (base: string) => `const res = await fetch("${base}/echo/stt", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"
  })
});`,
      py: (base: string) => `r = requests.post("${base}/echo/stt", headers={
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}, json={
    "url": "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"
})`,
    },
  },
  {
    id: "clone",
    category: "Voice",
    title: "Clone",
    method: "POST",
    path: "/echo/clone",
    fullPath: "/api/echo/clone",
    desc: "Creates a custom voice from audio samples. Send name and files as multipart form data.",
    params: [
      { name: "name", type: "string", required: true },
      { name: "files", type: "File[]", required: true },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { voice_id: "..." },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/clone" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "name=My Voice" -F "files=@sample1.mp3" -F "files=@sample2.mp3"`,
      js: (base: string) => `const fd = new FormData();
fd.append("name", "My Voice");
fd.append("files", file1);
fd.append("files", file2);
await fetch("${base}/echo/clone", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY" },
  body: fd
});`,
      py: (base: string) => `r = requests.post("${base}/echo/clone", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, files=[("files", open("s.mp3", "rb"))], data={"name": "My Voice"})`,
    },
  },
  {
    id: "assistants",
    category: "Agents",
    title: "List Assistants",
    method: "GET",
    path: "/orbit/assistants",
    fullPath: "/api/orbit/assistants",
    desc: "Returns all configured voice agents.",
    params: null,
    responseStatus: "200 OK",
    responseExample: { assistants: [{ id: "asst_xxx", name: "..." }] },
    examples: {
      curl: (base: string) => `curl -H "Authorization: Bearer YOUR_API_KEY" "${base}/orbit/assistants"`,
      js: (base: string) => `const res = await fetch("${base}/orbit/assistants", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});`,
      py: (base: string) => `r = requests.get("${base}/orbit/assistants", headers={
    "Authorization": "Bearer YOUR_API_KEY"
})`,
    },
  },
  {
    id: "call",
    category: "Calls",
    title: "Create Call",
    method: "POST",
    path: "/orbit/call",
    fullPath: "/api/orbit/call",
    desc: "Initiates an outbound phone call to the specified customer number.",
    params: [
      { name: "assistantId", type: "string", required: true },
      { name: "customerNumber", type: "string (E.164)", required: true },
    ] as Param[],
    responseStatus: "201 Created",
    responseExample: { id: "call_xxx", status: "ringing" },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/orbit/call" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"assistantId":"asst_xxx","customerNumber":"+15551234567"}'`,
      js: (base: string) => `await fetch("${base}/orbit/call", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ assistantId: "asst_xxx", customerNumber: "+15551234567" })
});`,
      py: (base: string) => `requests.post("${base}/orbit/call", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, json={"assistantId":"asst_xxx","customerNumber":"+15551234567"})`,
    },
  },
  {
    id: "calls",
    category: "Calls",
    title: "List Calls",
    method: "GET",
    path: "/orbit/calls",
    fullPath: "/api/orbit/calls",
    desc: "Returns call history. Supports limit, assistantId, and phoneNumberId query parameters.",
    params: null,
    responseStatus: "200 OK",
    responseExample: { calls: [{ id: "call_xxx", type: "outboundPhoneCall" }] },
    examples: {
      curl: (base: string) => `curl -H "Authorization: Bearer YOUR_API_KEY" "${base}/orbit/calls?limit=100"`,
      js: (base: string) => `const res = await fetch("${base}/orbit/calls?limit=100", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});`,
      py: (base: string) => `r = requests.get("${base}/orbit/calls", headers={
    "Authorization": "Bearer YOUR_API_KEY"
}, params={"limit": 100})`,
    },
  },
] as const;

const CATEGORIES = [...new Set(ENDPOINTS.map((e) => e.category))];

export default function DocsPane({
  apiBaseUrl,
  onCopyFeedback,
  isAuthenticated = false,
  apiKeyName = "",
  onApiKeyNameChange,
  onCreateApiKey,
  onRefreshApiKeys,
  isApiKeysLoading = false,
  apiKeysStatus = "",
  newlyCreatedApiKey = "",
  onCopyNewApiKey,
}: DocsPaneProps) {
  const [docTab, setDocTab] = useState<DocTab>("documentation");
  const [selectedId, setSelectedId] = useState<string>("tts");
  const [codeTab, setCodeTab] = useState<Record<string, "curl" | "js" | "py">>({});

  const normalizedInboundCallNumber = INBOUND_CALL_NUMBER.replace(/[^\d+]/g, "");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopyFeedback("Copied!");
    } catch {
      onCopyFeedback("Copy failed");
    }
  };

  const scrollToEndpoint = (id: string) => {
    setSelectedId(id);
    const element = document.getElementById(`endpoint-${id}`);
    if (element) {
      // Adding a small timeout to allow UI layout update if necessary
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  useEffect(() => {
    if (docTab !== "api-reference") return;

    const observerOptions = {
      root: document.querySelector('.docs-api-main'),
      rootMargin: "0px 0px -60% 0px", // triggers when element crosses top 40% of viewport
      threshold: 0,
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find all intersecting entries
      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length > 0) {
        // If multiple are visible, pick the top one (first in DOM)
        // Entries usually come ordered, but we can rely on traversing or just picking the first intersecting id
        const targetId = visibleEntries[0].target.id.replace('endpoint-', '');
        setSelectedId(targetId);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    ENDPOINTS.forEach((ep) => {
      const el = document.getElementById(`endpoint-${ep.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [docTab]);

  return (
    <div className="docs-v2">
      {/* Top nav tabs */}
      <nav className="docs-nav">
        <button
          type="button"
          className={`docs-nav-tab ${docTab === "documentation" ? "active" : ""}`}
          onClick={() => setDocTab("documentation")}
        >
          Documentation
        </button>
        <button
          type="button"
          className={`docs-nav-tab ${docTab === "api-reference" ? "active" : ""}`}
          onClick={() => setDocTab("api-reference")}
        >
          API Reference
        </button>
      </nav>

      {docTab === "documentation" && (
        <div className="docs-doc-content docs-scroll-smooth">
          <div className="docs-content max-w-5xl mx-auto py-12 px-6 el-agents-landing">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-faint font-medium tracking-wide">Get started</span>
            <div className="hidden md:block text-sm text-faint">On this page</div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-12">
            {/* Main Content */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl font-bold text-white tracking-tight">Eburon Agents</h1>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm text-faint hover:text-white hover:bg-white/10 transition-colors">
                  <Copy size={14} /> Copy page
                </button>
              </div>

              <p className="text-lg text-muted mb-8 max-w-2xl leading-relaxed">
                Learn how to build, launch, and scale agents with EchoLabs.
              </p>

              <p className="text-base text-faint mb-12 max-w-3xl leading-relaxed">
                Agents accomplish tasks through natural dialogue - from quick requests to complex, open-ended workflows. 
                EchoLabs provides voice-rich, expressive models, developer tools for building multimodal agents, and tools to monitor and evaluate agent performance at scale.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
                {/* Card 1 */}
                <div className="el-feature-card bg-surface border border-stroke rounded-xl overflow-hidden hover:border-lime/50 transition-colors">
                  <div className="bg-linear-to-br from-blue-300 to-blue-600 flex items-center justify-center overflow-hidden h-44 relative">
                     {/* Simplified representation of the node graph UI from the screenshot */}
                     <div className="w-full flex items-center justify-center p-4">
                       <div className="bg-white/90 w-full h-full rounded-md shadow-lg p-3 border border-white/20 relative min-h-[100px]">
                         <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-20 h-8 bg-white border border-gray-200 rounded-sm shadow-sm flex items-center justify-center text-[9px] text-gray-500 font-medium">Start</div>
                         <div className="absolute bottom-1/4 left-4 w-20 h-8 bg-white border border-gray-200 rounded-sm shadow-sm flex items-center justify-center text-[9px] text-gray-500 font-medium">Handoff</div>
                         <div className="absolute bottom-1/4 right-4 w-20 h-8 bg-white border border-gray-200 rounded-sm shadow-sm flex items-center justify-center text-[9px] text-gray-500 font-medium">Summarize</div>
                       </div>
                     </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Configure</h3>
                    <p className="text-sm text-faint leading-relaxed">
                      Configure multimodal agents with our developer toolkit, dashboard, or visual workflow builder
                    </p>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="el-feature-card bg-surface border border-stroke rounded-xl overflow-hidden hover:border-lime/50 transition-colors">
                  <div className="bg-linear-to-br from-blue-400 to-blue-800 flex items-center justify-center overflow-hidden h-44 p-6">
                     {/* Simplified representation of the chat UI from the screenshot */}
                     <div className="w-full h-full bg-white/95 rounded-lg shadow-lg flex flex-col p-3 gap-2 overflow-hidden">
                       <div className="self-start bg-gray-100 rounded-lg p-2 max-w-[80%] text-[8px] text-gray-600 leading-tight">Hi there, welcome to the EchoLabs documentation. How can I help you?</div>
                       <div className="self-end bg-black text-white rounded-lg p-2 max-w-[80%] text-[8px] leading-tight">I&apos;m wondering how EchoLabs pricing compares to Acme Co...</div>
                     </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Deploy</h3>
                    <p className="text-sm text-faint leading-relaxed">
                      Integrate multimodal agents across telephony systems, web, and mobile
                    </p>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="el-feature-card bg-surface border border-stroke rounded-xl overflow-hidden hover:border-lime/50 transition-colors">
                  <div className="bg-linear-to-br from-blue-500 via-purple-400 to-orange-300 flex items-center justify-center overflow-hidden h-44">
                     <div className="flex items-end gap-1.5 h-16 pointer-events-none">
                       <div className="w-3 bg-white rounded-t-sm h-8 opacity-90 shadow-sm animate-pulse"></div>
                       <div className="w-3 bg-white rounded-t-sm h-14 opacity-90 shadow-sm animate-pulse [animation-delay:200ms]"></div>
                       <div className="w-3 bg-white rounded-t-sm h-10 opacity-90 shadow-sm animate-pulse [animation-delay:400ms]"></div>
                     </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Monitor</h3>
                    <p className="text-sm text-faint leading-relaxed">
                      Evaluate agent performance with built-in testing, evals, and analytics
                    </p>
                  </div>
                </div>
              </div>

              <div id="capabilities">
                <h2 className="text-2xl font-bold text-white mb-6">Platform capabilities</h2>
                <div className="space-y-4">
                  <div className="bg-surface/50 border border-stroke rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Zap size={18} className="text-lime" /> Design and configure</h3>
                    <p className="text-sm text-muted mb-4">Build voice agent logic with our powerful capabilities including Speech-to-Text and dynamic Text-to-Speech synthesis.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex gap-3 items-start">
                        <AudioWaveform size={16} className="text-faint mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-ink">Text-to-Speech</p>
                          <p className="text-xs text-faint">Lifelike speech generation</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <Mic size={16} className="text-faint mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-ink">Speech-to-Text</p>
                          <p className="text-xs text-faint">High-accuracy audio transcription</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface/50 border border-stroke rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><PhoneCall size={18} className="text-lime" /> Connect and deploy</h3>
                    <p className="text-sm text-muted mb-4">Connect agents seamlessly to web RTC endpoints or traditional PSTN phone numbers via Twilio.</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center bg-black/30 p-3 rounded border border-white/5">
                        <span className="text-sm text-faint">Test Inbound Line:</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-lime font-medium">{INBOUND_CALL_NUMBER}</span>
                          <button onClick={() => copyToClipboard(normalizedInboundCallNumber)} className="text-faint hover:text-white transition-colors" title="Copy Number"><Copy size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface/50 border border-stroke rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Key size={18} className="text-lime" /> Monitor and optimize</h3>
                    <p className="text-sm text-muted mb-4">Configure your workspace appropriately with the correct API keys for smooth operation.</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                       <div className="text-xs font-mono text-faint bg-black/20 p-2 rounded">TTS_PROVIDER_KEY</div>
                       <div className="text-xs font-mono text-faint bg-black/20 p-2 rounded">TWILIO_ACCOUNT_SID</div>
                       <div className="text-xs font-mono text-faint bg-black/20 p-2 rounded">ORBIT_SECRET</div>
                       <div className="text-xs font-mono text-faint bg-black/20 p-2 rounded">PHONE_NUMBER_ID</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Sidebar (Table of Contents) */}
            <div className="hidden md:block w-48 shrink-0">
               <div className="sticky top-8 border-l border-white/10 pl-4 py-1 flex flex-col gap-3">
                 <a href="#capabilities" className="text-sm text-white font-medium hover:text-lime transition-colors">Platform capabilities</a>
                 <a href="#capabilities" className="text-sm text-faint hover:text-white transition-colors pl-2 border-l border-white/20 -ml-4">Design and configure</a>
                 <a href="#capabilities" className="text-sm text-faint hover:text-white transition-colors pl-2 border-l border-white/20 -ml-4">Connect and deploy</a>
                 <a href="#capabilities" className="text-sm text-faint hover:text-white transition-colors pl-2 border-l border-white/20 -ml-4">Monitor and optimize</a>
                 <a href="#architecture" className="text-sm text-faint hover:text-white transition-colors pt-2 block border-l-transparent -ml-4 pl-4 border-l hover:border-white/20">Architecture</a>
               </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {docTab === "api-reference" && (
        <div className="docs-api-wrapper">
          <div className="docs-base-bar">
            <span className="docs-base-label">Base URL</span>
            <code className="docs-base-url">{apiBaseUrl}</code>
            <button
              type="button"
              className="docs-base-copy"
              onClick={() => copyToClipboard(apiBaseUrl)}
              title="Copy base URL"
            >
              <Copy size={16} strokeWidth={2.25} />
            </button>
          </div>
          <div className="docs-api-layout">
          <aside className="docs-sidebar">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="docs-sidebar-group">
                <div className="docs-sidebar-group-title">{cat}</div>
                {ENDPOINTS.filter((e) => e.category === cat).map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    className={`docs-sidebar-item ${selectedId === ep.id ? "active" : ""}`}
                    onClick={() => scrollToEndpoint(ep.id)}
                  >
                    <span className={`docs-method-badge docs-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                    <span className="docs-sidebar-label">{ep.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Main content */}
          <main className="docs-api-main docs-scroll-smooth">
            <div className="docs-api-scroll-padding">
            {ENDPOINTS.map((selected) => {
              const currentCodeTab = (codeTab[selected.id] ?? "curl") as "curl" | "js" | "py";
              return (
              <div key={selected.id} id={`endpoint-${selected.id}`} className="docs-endpoint-section">
              <section className="docs-endpoint-header docs-panel">
                <div className="docs-endpoint-title-row">
                  <h1 className="docs-endpoint-title">{selected.title}</h1>
                  <span className={`docs-method-badge docs-method-${selected.method.toLowerCase()}`}>{selected.method}</span>
                </div>
                <p className="docs-endpoint-summary">{selected.desc}</p>
                <div className="docs-endpoint-meta">
                  <span className="docs-endpoint-chip">{selected.category}</span>
                  <code className="docs-endpoint-url">{apiBaseUrl}{selected.path}</code>
                  <button
                    type="button"
                    className="docs-endpoint-copy"
                    onClick={() => copyToClipboard(`${apiBaseUrl}${selected.path}`)}
                    title="Copy endpoint URL"
                  >
                    <Copy size={16} strokeWidth={2.25} />
                  </button>
                </div>
              </section>

              <section className="docs-api-section docs-panel">
                <h3 className="docs-api-section-title">Authentication</h3>
                <p className="docs-api-section-desc">
                  Include your API key using either <code className="docs-code-inline">Authorization: Bearer ...</code> or <code className="docs-code-inline">x-api-key</code>.
                  Generate keys in the Docs <code className="docs-code-inline">API Access</code> panel (or <code className="docs-code-inline">Settings → API Keys</code>).
                </p>
                <div className="docs-auth-example">
                  <code>Authorization: Bearer YOUR_API_KEY</code>
                  <br />
                  <code>x-api-key: YOUR_API_KEY</code>
                </div>
                {isAuthenticated && onCreateApiKey && onApiKeyNameChange ? (
                  <div className="docs-auth-create">
                    <div className="api-keys-create-row docs-auth-create-row">
                      <input
                        type="text"
                        value={apiKeyName}
                        onChange={(e) => onApiKeyNameChange(e.target.value)}
                        placeholder="Key name (e.g., Production app)"
                        title="API key name"
                      />
                      <button
                        type="button"
                        className="btn primary"
                        onClick={onCreateApiKey}
                        disabled={isApiKeysLoading}
                      >
                        Create Key
                      </button>
                      {onRefreshApiKeys && (
                        <button
                          type="button"
                          className="btn"
                          onClick={onRefreshApiKeys}
                          disabled={isApiKeysLoading}
                        >
                          Refresh
                        </button>
                      )}
                    </div>
                    {newlyCreatedApiKey && (
                      <div className="api-key-secret">
                        <code>{newlyCreatedApiKey}</code>
                        <button
                          type="button"
                          className="btn"
                          onClick={onCopyNewApiKey}
                        >
                          Copy
                        </button>
                      </div>
                    )}
                    {apiKeysStatus && <div className="settings-note docs-auth-status">{apiKeysStatus}</div>}
                  </div>
                ) : (
                  <div className="settings-note docs-auth-status">
                    Sign in to create API keys directly from Docs.
                  </div>
                )}
              </section>

              <section className="docs-api-section docs-panel">
                <h3 className="docs-api-section-title">Request</h3>
                {selected.params && selected.params.length > 0 ? (
                  <div className="docs-params-table">
                    <div className="docs-params-header">
                      <span>Parameter</span>
                      <span>Type</span>
                      <span>Required</span>
                    </div>
                    {selected.params.map((p) => (
                      <div key={p.name} className="docs-param-row">
                        <code className="docs-param-name">{p.name}</code>
                        <span className="docs-param-type">{p.type}</span>
                        <span className={`docs-param-badge ${p.required ? "required" : "optional"}`}>
                          {p.required ? "Required" : "Optional"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="docs-empty-note">
                    No body parameters are required for this endpoint.
                  </p>
                )}
              </section>

              <div className="docs-code-response-row">
                <div className="docs-code-block">
                  <div className="docs-code-header">
                    <span className="docs-code-method">{selected.method} {selected.path}</span>
                    <div className="docs-code-actions">
                      <select
                        value={currentCodeTab}
                        onChange={(e) => setCodeTab((p) => ({ ...p, [selected.id]: e.target.value as "curl" | "js" | "py" }))}
                        className="docs-code-select"
                        title="Code language"
                        aria-label="Code language"
                      >
                        <option value="curl">cURL</option>
                        <option value="js">JavaScript</option>
                        <option value="py">Python</option>
                      </select>
                      <button type="button" className="docs-code-copy" onClick={() => copyToClipboard(selected.examples[currentCodeTab](apiBaseUrl))} title="Copy">
                        <Copy size={16} strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>
                  <pre className="docs-code-pre">{selected.examples[currentCodeTab](apiBaseUrl)}</pre>
                  <button type="button" className="docs-try-btn">
                    <Play size={16} />
                    Try it
                  </button>
                </div>

                <div className="docs-response-block">
                  <div className="docs-response-header">
                    <span className="docs-response-status">{selected.responseStatus}</span>
                    <button type="button" className="docs-code-copy" onClick={() => copyToClipboard(JSON.stringify(selected.responseExample, null, 2))} title="Copy">
                      <Copy size={16} strokeWidth={2.25} />
                    </button>
                  </div>
                  <pre className="docs-response-pre">{JSON.stringify(selected.responseExample, null, 2)}</pre>
                </div>
              </div>
              </div>
              );
            })}
            </div>
          </main>
          </div>
        </div>
      )}
    </div>
  );
}
