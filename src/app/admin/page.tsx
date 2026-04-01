"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Bot,
  Trash2,
  Copy,
  Save,
  Loader2,
} from "lucide-react";
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

      const sanitizeVoiceBrand = (name: string) =>
        name.replace(/elevenlabs|11labs|vapi/gi, "Eburon AI");
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
            opts.push({
              label: `Eburon Voice - ${sanitizeVoiceBrand(String(v.name))}`,
              value: `vapi:${v.voice_id}`,
            });
          }
        });
      }
      setVoiceOptions(opts);
    } catch {
      setVoiceOptions([{ label: "Eburon Voice - Elliot", value: "vapi:Elliot" }]);
    }
  }, [authedFetch]);

  useEffect(() => {
    loadAgents();
    loadVoices();
  }, [loadAgents, loadVoices]);

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

      await loadAgents();
      const newId = data?.id;
      if (typeof newId === "string") setSelectedId(newId);
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
      await loadAgents();
      const next = agents.filter((a) => a.id !== selectedId);
      if (next.length > 0) setSelectedId(next[0].id);
      else createNewAgent();
    } catch (err) {
      alert(sanitizeProviderBranding(err instanceof Error ? err.message : "Failed to delete agent"));
    }
  };

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
                <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="phone number id" />
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
