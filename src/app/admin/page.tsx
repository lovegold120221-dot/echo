"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Bot,
  Trash2,
  Copy,
  Save,
  Loader2,
  Phone,
  PhoneOff,
  X,
} from "lucide-react";
import OrbitCore from "@vapi-ai/web";
import { supabase } from "@/lib/supabase";

type Agent = {
  id: string;
  name?: string;
  firstMessage?: string;
  phoneNumberId?: string;
  transcriber?: { language?: string };
  model?: { messages?: { role?: string; content?: string }[] };
  voice?: { provider?: string; voiceId?: string };
};

type VoiceOption = {
  label: string;
  value: string;
};

function sanitizeProviderBranding(message: string) {
  return message.replace(/elevenlabs|11labs|vapi/gi, "Eburon AI");
}

const EXTENDED_BASE_LANGUAGE_OPTIONS = `Dutch Flemish Native
Abkhaz
Acehnese
Acholi
Afar
Afrikaans
Albanian
Alur
Amharic
Arabic
Armenian
Assamese
Avar
Awadhi
Aymara
Azerbaijani
Balinese
Baluchi
Bambara
Baoule
Bashkir
Basque
Batak Karo
Batak Simalungun
Batak Toba
Belarusian
Bemba
Bengali
Betawi
Bhojpuri
Bikol
Bosnian
Breton
Bulgarian
Buryat
Cantonese
Catalan
Cebuano
Chamorro
Chechen
Chichewa
Chinese (Simplified)
Chinese (Traditional)
Chuukese
Chuvash
Corsican
Crimean Tatar (Cyrillic)
Crimean Tatar (Latin)
Croatian
Czech
Danish
Dari
Dhivehi
Dinka
Dogri
Dombe
Dutch
Dyula
Dzongkha
check
English
Esperanto
Estonian
Ewe
Faroese
Fijian
Filipino
Finnish
Fon
French
French (Canada)
Frisian
Friulian
Fulani
Ga
Galician
Georgian
German
Greek
Guarani
Gujarati
Haitian Creole
Hakha Chin
Hausa
Hawaiian
Hebrew
Hiligaynon
Hindi
Hmong
Hungarian
Hunsrik
Iban
Icelandic
Igbo
Ilocano
Indonesian
Inuktut (Latin)
Inuktut (Syllabics)
Irish
Italian
Jamaican Patois
Japanese
Javanese
Jingpo
Kalaallisut
Kannada
Kanuri
Kapampangan
Kazakh
Khasi
Khmer
Kiga
Kikongo
Kinyarwanda
Kituba
Kokborok
Komi
Konkani
Korean
Krio
Kurdish (Kurmanji)
Kurdish (Sorani)
Kyrgyz
Lao
Latgalian
Latin
Latvian
Ligurian
Limburgish
Lingala
Lithuanian
Lombard
Luganda
Luo
Luxembourgish
Macedonian
Madurese
Maithili
Makassar
Malagasy
Malay
Malay (Jawi)
Malayalam
Maltese
Mam
Manx
Maori
Marathi
Marshallese
Marwadi
Mauritian Creole
Meadow Mari
Meiteilon (Manipuri)
Minang
Mizo
Mongolian
Myanmar (Burmese)
Nahuatl (Eastern Huasteca)
Ndau
Ndebele (South)
Nepalbhasa (Newari)
Nepali
NKo
Norwegian
Nuer
Occitan
Odia (Oriya)
Oromo
Ossetian
Pangasinan
Papiamento
Pashto
Persian
Polish
Portuguese (Brazil)
Portuguese (Portugal)
Punjabi (Gurmukhi)
Punjabi (Shahmukhi)
Quechua
Q'eqchi'
Romani
Romanian
Rundi
Russian
Sami (North)
Samoan
Sango
Sanskrit
Santali (Latin)
Santali (Ol Chiki)
Scots Gaelic
Sepedi
Serbian
Sesotho
Seychellois Creole
Shan
Shona
Sicilian
Silesian
Sindhi
Sinhala
Slovak
Slovenian
Somali
Spanish
Sundanese
Susu
Swahili
Swati
Swedish
Tahitian
Tajik
Tamazight
Tamazight (Tifinagh)
Tamil
Tatar
Telugu
Tetum
Thai
Tibetan
Tigrinya
Tiv
Tok Pisin
Tongan
Tshiluba
Tsonga
Tswana
Tulu
Tumbuka
Turkish
Turkmen
Tuvan
Twi
Udmurt
Ukrainian
Urdu
Uyghur
Uzbek
Venda
Venetian
Vietnamese
Waray
Welsh
Wolof
Xhosa
Yakut
Yiddish
Yoruba
Yucatec Maya
Zapotec
Zulu`
  .split("\n")
  .map((lang) => lang.trim())
  .filter(Boolean);

type PhoneOption = {
  id: string;
  number?: string;
  name?: string;
};

const DEFAULT_PHONE_OPTIONS: PhoneOption[] = [
  { id: "b05646d2-9c25-45fc-8862-b2203544afd2", number: "+1 (844) 756 0329", name: "Default US" },
  { id: "31272481-96ff-4c24-82c8-1f5f655c3a7f", number: "+1 (844) 935 0977", name: "Default US 2" },
];

export default function AdminPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLang, setFormLang] = useState("multilingual");
  const [formFirstTalk, setFormFirstTalk] = useState("Agent");
  const [formIntro, setFormIntro] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formKbUrl, setFormKbUrl] = useState("");
  const [formVoice, setFormVoice] = useState("vapi:Elliot");

  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>(DEFAULT_PHONE_OPTIONS);
  const [isTestCallOpen, setIsTestCallOpen] = useState(false);
  const [testCallStatus, setTestCallStatus] = useState<"idle" | "loading" | "active">("idle");
  const [testCallTranscript, setTestCallTranscript] = useState<{ text: string; role: "user" | "agent" }[]>([]);
  const [testCallLive, setTestCallLive] = useState<{ user: string; agent: string }>({ user: "", agent: "" });
  const pendingTestCallStartRef = useRef<symbol | null>(null);

  const orbit = useMemo(() => {
    if (typeof window === "undefined") return null;
    const token = process.env.NEXT_PUBLIC_ORBIT_TOKEN || "";
    if (!token) return null;
    return new OrbitCore(token);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const authedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const authHeaders = await getAuthHeaders();
      const headers = new Headers(init.headers ?? {});
      Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
      return fetch(input, { ...init, headers });
    },
    [getAuthHeaders]
  );

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authedFetch("/api/orbit/assistants", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setAgents(list);
      if (!selectedId && list.length > 0 && !isNew) {
        setSelectedId(list[0].id);
      }
    } catch {
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, selectedId, isNew]);

  const loadVoices = useCallback(async () => {
    try {
      const [vapiRes, elevenRes] = await Promise.all([
        authedFetch("/api/orbit/voices"),
        authedFetch("/api/echo/voices"),
      ]);

      const vapi = await vapiRes.json();
      const eleven = await elevenRes.json();
      const sanitizeVoiceBrand = (name: string) => name.replace(/elevenlabs|11labs|vapi/gi, "Eburon AI");
      const opts: VoiceOption[] = [];
      if (Array.isArray(eleven)) {
        eleven.forEach((v) => {
          if (v?.voice_id && v?.name) {
            opts.push({
              label: `Eburon Voice - ${sanitizeVoiceBrand(String(v.name))}`,
              value: `11labs:${v.voice_id}`,
            });
          }
        });
      }
      if (Array.isArray(vapi)) {
        vapi.forEach((v) => {
          if (v?.voice_id && v?.name) {
            opts.push({ label: `Eburon Voice - ${sanitizeVoiceBrand(String(v.name))}`, value: `vapi:${v.voice_id}` });
          }
        });
      }
      setVoiceOptions(opts);
    } catch {
      setVoiceOptions([{ label: "Eburon Voice - Elliot", value: "vapi:Elliot" }]);
    }
  }, [authedFetch]);

  const loadPhoneNumbers = useCallback(async () => {
    try {
      const res = await authedFetch("/api/orbit/phone-numbers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setPhoneOptions(DEFAULT_PHONE_OPTIONS);
        return;
      }

      const merged = [...DEFAULT_PHONE_OPTIONS, ...data]
        .filter((pn) => pn && typeof pn.id === "string")
        .reduce<PhoneOption[]>((acc, pn) => {
          if (acc.some((x) => x.id === pn.id)) return acc;
          acc.push({ id: pn.id, number: pn.number, name: pn.name });
          return acc;
        }, []);

      setPhoneOptions(merged);
    } catch {
      setPhoneOptions(DEFAULT_PHONE_OPTIONS);
    }
  }, [authedFetch]);

  useEffect(() => {
    loadAgents();
    loadVoices();
    loadPhoneNumbers();
  }, [loadAgents, loadVoices, loadPhoneNumbers]);

  useEffect(() => {
    if (isNew && !formPhone.trim() && phoneOptions.length > 0) {
      setFormPhone(phoneOptions[0].id);
    }
  }, [isNew, formPhone, phoneOptions]);

  const loadAgentDetails = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const res = await authedFetch(`/api/orbit/assistants/${id}`, { cache: "no-store" });
        const a = await res.json();
        if (!res.ok) return;
        setFormName(a.name || "");
        setFormPhone(a.phoneNumberId || a.phoneNumber?.id || "");
        setFormLang(a.transcriber?.language || "multilingual");
        setFormIntro(a.firstMessage || "");
        const sys = a.model?.messages?.find((m: { role?: string }) => m.role === "system")?.content;
        setFormPrompt(sys || "");
        if (a.voice?.provider && a.voice?.voiceId) {
          setFormVoice(`${a.voice.provider}:${a.voice.voiceId}`);
        } else {
          setFormVoice("vapi:Elliot");
        }
      } catch {
        // no-op
      }
    },
    [authedFetch]
  );

  useEffect(() => {
    if (selectedId && !isNew) {
      loadAgentDetails(selectedId);
    }
  }, [selectedId, isNew, loadAgentDetails]);

  const filtered = useMemo(
    () =>
      agents.filter((a) => {
        const q = search.toLowerCase();
        return (a.name || "").toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
      }),
    [agents, search]
  );

  const createNewAgent = () => {
    setIsNew(true);
    setSelectedId("");
    setFormName("");
    setFormPhone("");
    setFormLang("multilingual");
    setFormFirstTalk("Agent");
    setFormIntro("");
    setFormPrompt("");
    setFormKbUrl("");
    setFormVoice("vapi:Elliot");
  };

  const cloneAgent = () => {
    setIsNew(true);
    setSelectedId("");
    setFormName((prev) => (prev ? `${prev} (Copy)` : "Copy Agent"));
    setFormPhone("");
  };

  const saveAgent = async () => {
    if (!formName.trim()) return;
    setIsSaving(true);
    try {
      const [provider, ...rest] = formVoice.split(":");
      const voiceId = rest.join(":");
      const body: Record<string, unknown> = {
        name: formName.trim(),
        firstMessage: formIntro.trim() || undefined,
        systemPrompt: formPrompt.trim() || undefined,
        language: formLang,
        voice: voiceId ? { provider, voiceId } : undefined,
        phoneNumberId: formPhone.trim() || undefined,
      };

      if (!isNew && selectedId) {
        body.assistantId = selectedId;
      }

      const res = await authedFetch("/api/orbit/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save agent");

      const savedAssistantId = (typeof data?.id === "string" ? data.id : selectedId) || "";
      if (savedAssistantId) {
        const syncRes = await authedFetch("/api/admin-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistantId: savedAssistantId,
            name: formName.trim(),
            phoneNumberId: formPhone.trim() || null,
            voiceProvider: provider || null,
            voiceId: voiceId || null,
            language: formLang || "multilingual",
            firstMessage: formIntro.trim() || null,
            systemPrompt: formPrompt.trim() || null,
          }),
        });
        if (!syncRes.ok) {
          const syncErr = await syncRes.json().catch(() => ({}));
          throw new Error(syncErr?.error || "Saved assistant but failed to sync admin record");
        }
      }

      await loadAgents();
      if (savedAssistantId) setSelectedId(savedAssistantId);
      setIsNew(false);
      alert(isNew ? "Agent created" : "Agent updated");
    } catch (err) {
      alert(sanitizeProviderBranding(err instanceof Error ? err.message : "Failed to save agent"));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (!selectedId || isNew) return;
    if (!confirm("Delete this agent?")) return;
    try {
      const res = await authedFetch(`/api/orbit/assistants/${selectedId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete agent");

      const syncRes = await authedFetch("/api/admin-agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: selectedId }),
      });
      if (!syncRes.ok) {
        const syncErr = await syncRes.json().catch(() => ({}));
        console.warn("[admin-agents delete]", syncErr?.error || "Failed to remove admin record");
      }

      await loadAgents();
      const next = agents.filter((a) => a.id !== selectedId);
      if (next.length > 0) setSelectedId(next[0].id);
      else createNewAgent();
    } catch (err) {
      alert(sanitizeProviderBranding(err instanceof Error ? err.message : "Failed to delete agent"));
    }
  };

  const closeTestCall = useCallback(() => {
    pendingTestCallStartRef.current = null;
    setTestCallStatus("idle");
    setIsTestCallOpen(false);
    setTestCallTranscript([]);
    setTestCallLive({ user: "", agent: "" });
  }, []);

  const startTestCall = useCallback(async () => {
    if (!selectedId || isNew) return;
    if (!orbit) {
      alert("Voice call engine not initialized. Check your API token.");
      return;
    }

    setIsTestCallOpen(true);
    setTestCallStatus("loading");
    setTestCallTranscript([]);
    setTestCallLive({ user: "", agent: "" });

    try {
      const startToken = Symbol("admin-test-call-start");
      pendingTestCallStartRef.current = startToken;
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      if (pendingTestCallStartRef.current !== startToken) return;
      await orbit.start(selectedId);
    } catch (error) {
      console.error("Failed to start admin test call:", error);
      closeTestCall();
      alert("Failed to connect test call.");
    }
  }, [closeTestCall, isNew, orbit, selectedId]);

  useEffect(() => {
    if (!orbit) return;

    const onCallStart = () => {
      pendingTestCallStartRef.current = null;
      setTestCallStatus("active");
    };

    const onCallEnd = () => {
      closeTestCall();
    };

    const onError = (error: unknown) => {
      console.error("Admin test call error:", error);
      closeTestCall();
    };

    const onMessage = (message: { type: string; transcriptType?: string; transcript?: string; role?: string }) => {
      if (message.type !== "transcript" || !message.transcript || !message.role) return;

      const role = message.role === "user" ? "user" : "agent";
      const text = message.transcript.trim();
      if (!text) return;

      const isInterim = message.transcriptType === "interim" || message.transcriptType === "partial";
      if (isInterim) {
        setTestCallLive((prev) => ({ ...prev, [role]: text }));
        return;
      }

      setTestCallTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && last.text === text) return prev;
        return [...prev, { role, text }];
      });
      setTestCallLive((prev) => ({ ...prev, [role]: "" }));
    };

    orbit.on("call-start", onCallStart);
    orbit.on("call-end", onCallEnd);
    orbit.on("error", onError);
    orbit.on("message", onMessage);

    return () => {
      orbit.off("call-start", onCallStart);
      orbit.off("call-end", onCallEnd);
      orbit.off("error", onError);
      orbit.off("message", onMessage);
    };
  }, [closeTestCall, orbit]);

  useEffect(() => {
    return () => {
      pendingTestCallStartRef.current = null;
      orbit?.stop();
    };
  }, [orbit]);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon" />
            EBURON AI
          </div>
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-box"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="agent-list">
          {isLoading ? (
            <div className="list-empty">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-empty">No agents found</div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className={`agent-item ${!isNew && selectedId === a.id ? "active" : ""}`}
                onClick={() => {
                  setIsNew(false);
                  setSelectedId(a.id);
                }}
              >
                <div className="agent-avatar">
                  <Bot size={16} />
                </div>
                <div className="agent-meta-mini">
                  <h4>{a.name || "Unnamed Agent"}</h4>
                  <p>{a.transcriber?.language || "multi"} • {a.id.slice(0, 8)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="btn-add-new" onClick={createNewAgent}>
            <Plus size={14} /> Create New Agent
          </button>
          <div className="status-row">
            <div className="status-dot" />
            System Active & Connected
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <div className="panel-header">
          <div>
            <h2 id="displayAgentName">{isNew ? "New Agent" : formName || "Agent Metadata"}</h2>
            <p id="displayAgentID">ID: {isNew ? "--" : selectedId || "--"}</p>
          </div>
          <div className="header-actions">
            {!isNew && selectedId && (
              <button
                className="btn btn-test-call"
                onClick={startTestCall}
                disabled={testCallStatus === "loading"}
              >
                {testCallStatus === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />} Test Call
              </button>
            )}
            {!isNew && selectedId && (
              <button className="btn btn-delete" onClick={deleteAgent}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            {!isNew && selectedId && (
              <button className="btn btn-clone" onClick={cloneAgent}>
                <Copy size={14} /> Create as New
              </button>
            )}
            <button className="btn btn-save" onClick={saveAgent} disabled={isSaving || !formName.trim()}>
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
            </button>
          </div>
        </div>

        <div className="content-scroll">
          <div className="form-section">
            <h3>Identity & Contact</h3>
            <div className="grid">
              <div className="input-group">
                <label>Agent Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Dutch Support" />
              </div>
              <div className="input-group">
                <label>Phone Number to Use</label>
                <select value={formPhone} onChange={(e) => setFormPhone(e.target.value)}>
                  <option value="">Select phone number</option>
                  {formPhone && !phoneOptions.some((pn) => pn.id === formPhone) && (
                    <option value={formPhone}>{formPhone}</option>
                  )}
                  {phoneOptions.map((pn) => (
                    <option key={pn.id} value={pn.id}>
                      {pn.number || pn.name || pn.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Base Language</label>
                <select value={formLang} onChange={(e) => setFormLang(e.target.value)}>
                  <option value="multilingual">Multilingual (Auto-Detect)</option>
                  {EXTENDED_BASE_LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Agent ID (Internal)</label>
                <input type="text" readOnly value={isNew ? "(new)" : selectedId} className="readonly" />
              </div>
              <div className="input-group full-width">
                <label>Voice</label>
                <select value={formVoice} onChange={(e) => setFormVoice(e.target.value)}>
                  <option value="">Select voice</option>
                  {voiceOptions.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Behavioral Design</h3>
            <div className="grid">
              <div className="input-group">
                <label>First to Talk</label>
                <select value={formFirstTalk} onChange={(e) => setFormFirstTalk(e.target.value)}>
                  <option value="Agent">Agent (Outbound/Direct)</option>
                  <option value="User">User (Inbound/Wait)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Intro Message / Greeting</label>
                <input type="text" value={formIntro} onChange={(e) => setFormIntro(e.target.value)} placeholder="Hello, how can I help you today?" />
              </div>
              <div className="input-group full-width">
                <label>System Prompt (Instructions & Rules)</label>
                <textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} rows={8} placeholder="You are a professional support agent for..." />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Knowledge Base</h3>
            <div className="input-group full-width" style={{ marginBottom: 20 }}>
              <label>Documentation URL</label>
              <input type="url" value={formKbUrl} onChange={(e) => setFormKbUrl(e.target.value)} placeholder="https://your-docs.com/data" />
            </div>
            <div className="kb-zone">
              <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 600 }}>Upload Knowledge Files</div>
              <div style={{ color: "#888", fontSize: "0.75rem", marginTop: 4 }}>PDF, TXT, JSON (Max 50MB)</div>
            </div>
          </div>
        </div>
      </main>

      {isTestCallOpen && (
        <div className="admin-call-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-call-modal">
            <div className="admin-call-modal-header">
              <div>
                <strong>Test Call</strong>
                <p>{formName || selectedId}</p>
              </div>
              <button
                className="btn admin-call-close"
                onClick={() => {
                  pendingTestCallStartRef.current = null;
                  orbit?.stop();
                  closeTestCall();
                }}
              >
                <X size={14} /> Close
              </button>
            </div>

            <div className="admin-call-status">
              {testCallStatus === "loading" ? "Connecting..." : testCallStatus === "active" ? "Live" : "Idle"}
            </div>

            <div className="admin-call-transcript">
              {testCallTranscript.length === 0 && !testCallLive.user && !testCallLive.agent ? (
                <div className="admin-call-empty">Waiting for transcript...</div>
              ) : (
                <>
                  {testCallTranscript.map((item, idx) => (
                    <div key={`${item.role}-${idx}`} className={`admin-line ${item.role}`}>
                      <span>{item.role === "user" ? "You" : "Agent"}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                  {testCallLive.user && (
                    <div className="admin-line user interim">
                      <span>You</span>
                      <p>{testCallLive.user}</p>
                    </div>
                  )}
                  {testCallLive.agent && (
                    <div className="admin-line agent interim">
                      <span>Agent</span>
                      <p>{testCallLive.agent}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="admin-call-actions">
              <button
                className="btn btn-delete"
                onClick={() => {
                  pendingTestCallStartRef.current = null;
                  orbit?.stop();
                  closeTestCall();
                }}
              >
                <PhoneOff size={14} /> End Call
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .admin-shell {
          --bg-black: #0b0b0b;
          --panel-bg: #141414;
          --card-bg: #1a1a1a;
          --accent-green: #bfff00;
          --text-white: #ffffff;
          --text-gray: #888888;
          --border: #222222;
          --input-bg: #111111;
          --radius-lg: 24px;
          --radius-md: 12px;
          background: var(--bg-black);
          color: var(--text-white);
          height: 100dvh;
          display: flex;
          padding: 20px;
          gap: 20px;
          overflow: hidden;
          font-family: "Plus Jakarta Sans", sans-serif;
        }
        .sidebar {
          width: 320px;
          background: var(--panel-bg);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          height: calc(100dvh - 40px);
          position: sticky;
          top: 20px;
        }
        .sidebar-header { padding: 30px 24px 20px; }
        .brand {
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 25px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-icon { width: 12px; height: 24px; background: var(--accent-green); border-radius: 4px; }
        .search-wrap { position: relative; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-gray); }
        .search-box {
          background: var(--input-bg);
          border: 1px solid var(--border);
          padding: 12px 16px 12px 38px;
          border-radius: var(--radius-md);
          width: 100%;
          color: white;
          outline: none;
          font-size: 0.9rem;
        }
        .agent-list { flex: 1; overflow-y: auto; padding: 10px 16px; }
        .agent-item {
          padding: 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: 0.2s;
          margin-bottom: 8px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .agent-item:hover { background: rgba(255,255,255,0.03); }
        .agent-item.active { background: rgba(191,255,0,0.08); border-color: rgba(191,255,0,0.2); }
        .agent-avatar {
          width: 40px;
          height: 40px;
          background: var(--card-bg);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          color: #9aa0a6;
        }
        .agent-item.active .agent-avatar { color: var(--accent-green); border-color: var(--accent-green); }
        .agent-meta-mini h4 { font-size: 0.95rem; font-weight: 600; }
        .agent-meta-mini p { font-size: 0.75rem; color: var(--text-gray); margin-top: 2px; }
        .sidebar-footer { padding: 20px; border-top: 1px solid var(--border); }
        .btn-add-new {
          width: 100%;
          background: var(--accent-green);
          color: black;
          border: none;
          padding: 12px;
          border-radius: var(--radius-md);
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .status-row { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; color: var(--text-gray); }
        .status-dot { width: 8px; height: 8px; background: var(--accent-green); border-radius: 50%; }
        .main-panel {
          flex: 1;
          background: var(--panel-bg);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          height: calc(100dvh - 40px);
          position: sticky;
          top: 20px;
        }
        .panel-header {
          padding: 30px 40px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .panel-header p { color: var(--text-gray); font-size: 0.85rem; margin-top: 4px; }
        .header-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          border: 1px solid var(--border);
          transition: 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--card-bg);
          color: white;
        }
        .btn-save { background: var(--accent-green); color: black; border: none; }
        .btn-clone { background: var(--card-bg); color: white; }
        .btn-test-call { background: rgba(191,255,0,0.1); color: var(--accent-green); border: 1px solid rgba(191,255,0,0.3); }
        .btn-delete { background: rgba(255,68,68,0.1); color: #ff4444; border: 1px solid rgba(255,68,68,0.2); }
        .content-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 40px; }
        .form-section { margin-bottom: 40px; max-width: 900px; }
        .form-section h3 {
          font-size: 0.85rem;
          color: var(--text-gray);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 25px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .form-section h3::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 0.85rem; font-weight: 500; color: #ccc; }
        .input-group input,
        .input-group select,
        .input-group textarea {
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: white;
          padding: 14px;
          border-radius: var(--radius-md);
          font-size: 0.95rem;
          outline: none;
        }
        .input-group input:focus,
        .input-group select:focus,
        .input-group textarea:focus { border-color: var(--accent-green); }
        .readonly { opacity: 0.5; }
        .full-width { grid-column: 1 / -1; }
        .kb-zone {
          background: var(--card-bg);
          border: 1px dashed var(--border);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          transition: 0.2s;
        }
        .kb-zone:hover { border-color: var(--accent-green); background: rgba(191,255,0,0.02); }
        .list-empty { color: var(--text-gray); padding: 20px; text-align: center; display: flex; gap: 8px; justify-content: center; }
        .admin-call-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 50;
        }
        .admin-call-modal {
          width: min(760px, 100%);
          max-height: 82dvh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #111;
          border: 1px solid var(--border);
          border-radius: 16px;
        }
        .admin-call-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
        }
        .admin-call-modal-header p {
          margin-top: 4px;
          color: var(--text-gray);
          font-size: 0.8rem;
        }
        .admin-call-close {
          padding: 8px 12px;
        }
        .admin-call-status {
          padding: 10px 18px;
          font-size: 0.8rem;
          color: var(--text-gray);
          border-bottom: 1px solid var(--border);
        }
        .admin-call-transcript {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .admin-call-empty {
          color: var(--text-gray);
          font-size: 0.85rem;
        }
        .admin-line {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
          background: #171717;
        }
        .admin-line.user {
          border-color: rgba(191,255,0,0.35);
          background: rgba(191,255,0,0.08);
        }
        .admin-line span {
          display: block;
          font-size: 0.72rem;
          color: var(--text-gray);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .admin-line p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }
        .admin-line.interim {
          opacity: 0.8;
        }
        .admin-call-actions {
          padding: 14px 18px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
        }
        @media (max-width: 1024px) {
          .admin-shell { flex-direction: column; padding: 10px; }
          .sidebar { width: 100%; max-height: 300px; }
          .grid { grid-template-columns: 1fr; }
          .panel-header { padding: 20px; flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
