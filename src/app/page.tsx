"use client";
// cspell:ignore supabase SUPABASE Bicolano Bhojpuri Hiligaynon Waray Limburgish Hokkien Busan Jeju Minh

import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import {
  AudioWaveform,
  Mic,
  Copy,
  Users,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Download,
  Play,
  Key,
  Loader2,
  PhoneOff,
  Volume2,
  Phone,
  Upload,
  RefreshCw,
  FileText,
  Database,
  X,
  Maximize2,
  Minimize2
} from "lucide-react";

import OrbitCore from "@vapi-ai/web";
import { Voice, UserTtsHistoryItem } from "@/lib/services/echo";
import DocsPane from "@/components/DocsPane";
import { enhanceTextForTTS, normalizeForTTS, BREAK_TAG } from "@/lib/tts-enhancer";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

// type Voice moved to echo.ts

const orbit = typeof window !== "undefined" ? new OrbitCore(process.env.NEXT_PUBLIC_ORBIT_TOKEN || "") : null;

const languageDialectMap: Record<string, string[]> = {
  "Filipino": ["Tagalog", "Cebuano", "Ilocano", "Bicolano", "Hiligaynon", "Waray"],
  "English": ["USA", "UK", "Australia", "Canada", "India", "Ireland", "South Africa", "New Zealand", "Singapore"],
  "Spanish": ["Spain", "Mexico", "Argentina", "Colombia", "Chile", "Peru", "Puerto Rico", "USA"],
  "French": ["France", "Canada", "Belgium", "Switzerland", "Senegal", "Morocco"],
  "German": ["Germany", "Switzerland", "Austria", "Liechtenstein"],
  "Hindi": ["Standard Hindi", "Bhojpuri", "Punjabi", "Marathi", "Gujarati", "Bengali"],
  "Japanese": ["Tokyo", "Osaka", "Kyoto", "Fukuoka", "Nagoya"],
  "Dutch": ["Netherlands", "Belgium (Flemish)", "Limburgish", "Suriname"],
  "Portuguese": ["Brazil", "Portugal", "Angola", "Mozambique"],
  "Italian": ["Italy", "Switzerland"],
  "Chinese": ["Mandarin (Simplified)", "Mandarin (Traditional)", "Cantonese", "Hokkien"],
  "Korean": ["Seoul", "Busan", "Jeju"],
  "Arabic": ["Modern Standard", "Egypt", "Saudi Arabia", "UAE", "Levant", "Maghreb"],
  "Turkish": ["Istanbul", "Ankara", "Izmir"],
  "Vietnamese": ["Hanoi", "Ho Chi Minh City", "Da Nang"],
  "Indonesian": ["Standard", "Javanese", "Sundanese"],
  "Russian": ["Russia", "Belarus", "Kazakhstan"],
};

// Default sample agent (MorganCsr) for testing Orbit Web Call
const DEFAULT_SAMPLE_AGENT = {
  id: "019c51ea-8ce8-4962-9b83-70023ec0d6c2",
  name: "Customer Support Specialist",
} as const;

// Fallback defaults when Ivan not found
const DEFAULT_AGENT_NAME = "Customer Support Specialist";
const DEFAULT_AGENT_INTRO = "Hi there! I'm here to help you with any questions or issues you might have. What can I do for you today?";
const DEFAULT_AGENT_SKILLS = "You are an empathetic and knowledgeable Customer Support Specialist. Your goal is to resolve product issues and answer customer questions efficiently and kindly.";
const ECHO_MODEL_OPTIONS = [
  { id: "tts/echo_flash-v2.5", label: "⚡ Echo Flash v2.5" },
  { id: "tts/echo_multilingual-v2", label: "🌍 Echo Multilingual v2" },
  { id: "tts/echo_turbo-v2.5", label: "🚀 Echo Turbo v2.5" },
] as const;
const DEFAULT_ECHO_MODEL = ECHO_MODEL_OPTIONS[0].id;

type ApiKeyItem = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ApiUsageSummary = {
  days: number;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgLatencyMs: number;
  endpointStats: { endpoint: string; requests: number; errors: number; avgLatencyMs: number }[];
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("pane-audio");
  const [audioSubTab, setAudioSubTab] = useState<"voices" | "tts" | "stt" | "history">("voices");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceFilterCategory, setVoiceFilterCategory] = useState<string>("all");
  const [voiceFilterLanguage, setVoiceFilterLanguage] = useState<string>("all");
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [ttsText, setTtsText] = useState(
    "Okay, you are NOT going to believe this. You know how I've been totally stuck on that short story? Like, staring at the screen for HOURS, just... nothing? I was seriously about to just trash the whole thing. But then! Last night, this one little phrase popped into my head. And it was like... the FLOODGATES opened! It all just CLICKED. I am so incredibly PUMPED. It went from feeling like a chore to feeling like... MAGIC."
  );
  const [ttsStatus, setTtsStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancingExpression, setIsEnhancingExpression] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isFullWidthHeight, setIsFullWidthHeight] = useState(false);

  const [callStatus, setCallStatus] = useState<"idle" | "loading" | "active">("idle");
  const [activeAgentId, setActiveAgentId] = useState("");
  const [transcript, setTranscript] = useState<{ text: string; role: "user" | "agent" }[]>([]);
  const [liveInterimTranscript, setLiveInterimTranscript] = useState<{ user: string; agent: string }>({
    user: "",
    agent: "",
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callVolume, setCallVolume] = useState(0);
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const audioVizId = useId();
  const voicePreviewVizId = useId();
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [voicePreviewVolume, setVoicePreviewVolume] = useState(0);
  const voicePreviewCtxRef = useRef<AudioContext | null>(null);
  const voicePreviewAnalyserRef = useRef<AnalyserNode | null>(null);
  const voicePreviewAnimationRef = useRef<number | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const [history, setHistory] = useState<UserTtsHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement>(null);
  const playHistoryAbortRef = useRef<AbortController | null>(null);
  const [historyAudioUrl, setHistoryAudioUrl] = useState<string | null>(null);
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [docsCopyFeedback, setDocsCopyFeedback] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://your-domain.com/api/v1");
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isApiKeysLoading, setIsApiKeysLoading] = useState(false);
  const [apiKeysStatus, setApiKeysStatus] = useState("");
  const [newApiKeyName, setNewApiKeyName] = useState("Default key");
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState("");
  const [apiUsageSummary, setApiUsageSummary] = useState<ApiUsageSummary | null>(null);


  useEffect(() => {
    if (typeof window !== "undefined") {
      setApiBaseUrl(`${window.location.origin}/api/v1`);
    }
  }, []);

  useEffect(() => {
    if (!downloadMenuId) return;
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [downloadMenuId]);

  // Play history audio after React has updated the DOM (avoids AbortError from src update during play)
  useEffect(() => {
    if (!historyAudioUrl || !playingHistoryId || !historyAudioRef.current) return;
    const el = historyAudioRef.current;
    el.pause();
    el.play().catch(() => {});
  }, [historyAudioUrl, playingHistoryId]);

  const [models, setModels] = useState<{ model_id: string; name: string; languages: { language_id: string; name: string }[] }[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("echo-theme") as "dark" | "light" || "dark";
    setTheme(savedTheme);
    const isLight = savedTheme === "light";
    document.documentElement.classList.toggle("light-mode", isLight);
    document.body.classList.toggle("light-mode", isLight);

    if (!orbit) return;

    const onCallStart = () => {
      setCallStatus("active");
      setLiveInterimTranscript({ user: "", agent: "" });
    };
    const onCallEnd = () => {
      setCallStatus("idle");
      setActiveAgentId("");
      setTranscript([]);
      setLiveInterimTranscript({ user: "", agent: "" });
      setShowTestCallModal(false);
    };
    const onError = (e: unknown) => {
      console.error("Orbit Error:", e);
      setCallStatus("idle");
      setLiveInterimTranscript({ user: "", agent: "" });
      setShowTestCallModal(false);
    };
    const onMessage = (message: { type: string; transcriptType?: string; transcript?: string; role?: string }) => {
      if (message.type === "transcript" && message.transcript && message.role) {
        const role = message.role === "user" ? "user" : "agent";
        const text = message.transcript.trim();
        if (!text) return;
        const isInterim = message.transcriptType === "interim" || message.transcriptType === "partial";
        if (isInterim) {
          setLiveInterimTranscript((prev) => ({ ...prev, [role]: text }));
        } else {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.text === text) return prev;
            return [...prev, { text, role }];
          });
          setLiveInterimTranscript((prev) => ({ ...prev, [role]: "" }));
        }
      }
      if (message.type === "speech-start") setIsSpeaking(true);
      if (message.type === "speech-end") setIsSpeaking(false);
    };
    const onVolumeLevel = (volume: number) => setCallVolume(volume);

    orbit.on("call-start", onCallStart);
    orbit.on("call-end", onCallEnd);
    orbit.on("error", onError);
    orbit.on("message", (message) => {
      console.log("Vapi Message:", message.type, message);
      onMessage(message);
    });
    orbit.on("volume-level", onVolumeLevel);

    return () => {
      orbit.off("call-start", onCallStart);
      orbit.off("call-end", onCallEnd);
      orbit.off("error", onError);
      orbit.off("message", onMessage);
      orbit.off("volume-level", onVolumeLevel);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then((response: any) => {
      const { data: { session } } = response;
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setAuthStatus("Email and password required.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthStatus(error.message);
    setIsAuthProcessing(false);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setAuthStatus("Passwords do not match.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const response = await supabase.auth.signUp({
      email,
      password
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, data } = response as { error: any; data: any };
    if (error) {
      setAuthStatus(error.message);
    } else if (data.user && data.user.email_confirmed_at) {
      setAuthStatus("Registration successful! You are now logged in.");
      // User is automatically logged in if email is confirmed
      setUser(data.user);
    } else {
      setAuthStatus("Registration successful! You can now log in.");
    }
    setIsAuthProcessing(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setAuthStatus("Email required.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setAuthStatus(error.message);
    else setAuthStatus("Reset link sent! Check your email.");
    setIsAuthProcessing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("echo-theme", newTheme);
    const isLight = newTheme === "light";
    document.documentElement.classList.toggle("light-mode", isLight);
    document.body.classList.toggle("light-mode", isLight);
  };

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const authedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const authHeaders = await getAuthHeaders();
    const headers = new Headers(init.headers ?? {});
    Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
    return fetch(input, { ...init, headers });
  }, [getAuthHeaders]);

  const fetchRealTimeHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await authedFetch("/api/echo/history?page_size=50&sort_direction=desc");
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody as { error?: string })?.error || `Failed to load history (${res.status})`;
        setHistoryError(msg);
        setHistory([]);
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      setHistory(items.map((h: { history_item_id: string; text: string; voice_id: string; voice_name: string; date_unix: number }) => ({
        id: h.history_item_id,
        text: h.text,
        voice_id: h.voice_id,
        voice_name: h.voice_name,
        audio_path: "",
        created_at: new Date(h.date_unix * 1000).toISOString(),
      })));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch history.";
      setHistoryError(msg);
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (activeTab === "pane-audio" && audioSubTab === "history") {
      fetchRealTimeHistory();
    }
  }, [activeTab, audioSubTab, fetchRealTimeHistory]);

  const fetchCallLogs = useCallback(async () => {
    setIsCallLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      const res = await authedFetch(`/api/orbit/calls?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setCallLogs(data);
      else setCallLogs([]);
    } catch {
      setCallLogs([]);
    } finally {
      setIsCallLogsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (activeTab === "pane-agents" || activeTab === "pane-Create") fetchCallLogs();
  }, [activeTab, fetchCallLogs]);

  useEffect(() => {
    if (activeTab === "pane-call-logs") fetchCallLogs();
  }, [activeTab, fetchCallLogs]);

  const handleToggleCall = async (assistantId: string) => {
    if (callStatus === "active") {
      orbit?.stop();
      return;
    }
    const idToUse = assistantId || DEFAULT_SAMPLE_AGENT.id;
    setShowTestCallModal(true);
    setCallVolume(0);
    setTranscript([]);
    setLiveInterimTranscript({ user: "", agent: "" });
    setActiveAgentId(idToUse);
    setCallStatus("loading");
    try {
      await orbit?.start(idToUse);
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallStatus("idle");
      setActiveAgentId("");
      setShowTestCallModal(false);
    }
  };

  const navItems = [
    { id: "pane-audio", label: "Audio", icon: <Volume2 size={18} />, desc: "Voices, Text to Speech, Speech to Text, History" },
    { id: "pane-clone", label: "Clone", icon: <Copy size={18} />, desc: "Instantly clone voices with full metadata tagging" },
    { id: "pane-Create", label: "Create", icon: <Mic size={18} />, desc: "Describe your agent with voice or text" },
    { id: "pane-agents", label: "Templates", icon: <Users size={18} />, desc: "Create and connect to AI templates" },
    { id: "pane-call-logs", label: "Call Logs", icon: <Phone size={18} />, desc: "All call history" },
    { id: "pane-docs", label: "Docs", icon: <FileText size={18} />, desc: "API documentation and test inbound" },
    { id: "pane-settings", label: "Settings", icon: <SettingsIcon size={18} />, desc: "Configure default Echo models and format" },
  ];

  const userId = user?.id ?? null;

  const loadVoicesAndModels = useCallback(async () => {
    try {
      const res = await authedFetch("/api/echo/voices");
      const data = await res.json();
      if (Array.isArray(data)) {
        setVoices(data);
        if (data.length > 0) setSelectedVoice(data[0].voice_id);
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    }

    try {
      const res = await authedFetch("/api/echo/models");
      const data = await res.json();
      if (Array.isArray(data)) setModels(data);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (!userId) return;
    loadVoicesAndModels();
  }, [loadVoicesAndModels, userId]);

  const [sttFile, setSttFile] = useState<File | null>(null);
  const [sttStatus, setSttStatus] = useState("");
  const [sttOutput, setSttOutput] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneLanguage, setCloneLanguage] = useState("Filipino");
  const [cloneLocation, setCloneLocation] = useState("Cebuano");
  const [cloneGender, setCloneGender] = useState("Male");
  const [cloneAge, setCloneAge] = useState("Young");
  const [cloneConsent, setCloneConsent] = useState(false);
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneStatus, setCloneStatus] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    if (languageDialectMap[cloneLanguage]) {
      setCloneLocation(languageDialectMap[cloneLanguage][0]);
    } else {
      setCloneLocation("General");
    }
  }, [cloneLanguage]);

  const handleAddExpression = async () => {
    if (!ttsText.trim()) return;
    setIsEnhancingExpression(true);
    setTtsStatus("");
    try {
      const res = await fetch("/api/tts-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, mode: "expression" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      if (typeof data.enhanced === "string") setTtsText(data.enhanced);
      setTtsStatus("Expression added.");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error: " + (err instanceof Error ? err.message : "Could not add expression."));
    } finally {
      setIsEnhancingExpression(false);
    }
  };

  const handleEnhanced = async () => {
    if (!ttsText.trim()) return;
    setIsEnhancingExpression(true);
    setTtsStatus("");
    try {
      const res = await fetch("/api/tts-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, mode: "enhance" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      if (typeof data.enhanced === "string") setTtsText(data.enhanced);
      setTtsStatus("Enhanced.");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error: " + (err instanceof Error ? err.message : "Could not enhance."));
    } finally {
      setIsEnhancingExpression(false);
    }
  };

  const handleGenerateTTS = async () => {
    if (!selectedVoice || !ttsText.trim()) {
      setTtsStatus("Select a voice and enter text.");
      return;
    }

    setIsGenerating(true);
    setTtsStatus("Synthesizing...");

    try {
      const res = await authedFetch("/api/echo/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: selectedVoice,
          text: ttsText,
          modelId: "tts/echo_flash-v2.5",
          outputFormat: "mp3_44100_128"
        }),
      });

      if (!res.ok) throw new Error("Synthesis failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setTtsStatus("Ready");

      // Save to user TTS history when logged in
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const formData = new FormData();
          formData.set("text", ttsText.trim());
          formData.set("voice_id", selectedVoice);
          formData.set("voice_name", voices.find(v => v.voice_id === selectedVoice)?.name ?? "Unknown");
          formData.set("audio", new File([blob], "tts.mp3", { type: "audio/mpeg" }));
          try {
            const saveRes = await fetch("/api/tts-history", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: formData,
            });
            if (saveRes.ok) {
              const saved = await saveRes.json();
              setHistory(prev => [saved, ...prev]);
              setTtsStatus("Ready · Saved to history");
            } else {
              const errData = await saveRes.json().catch(() => ({}));
              console.warn("TTS history save failed:", saveRes.status, errData);
              setTtsStatus("Ready · Could not save to history");
            }
          } catch (err) {
            console.warn("TTS history save error:", err);
            setTtsStatus("Ready · Could not save to history");
          }
        } else {
          setTtsStatus("Ready · Sign in to save history");
        }
      }
    } catch (error) {
      console.error(error);
      setTtsStatus("Error: Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranscribe = async () => {
    if (!sttFile) return;

    setIsTranscribing(true);
    setSttStatus("Uploading & Transcribing...");

    try {
      const formData = new FormData();
      formData.append("file", sttFile);
      const res = await authedFetch("/api/echo/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Transcription failed");
      }

      const data = await res.json();
      const transcriptText =
        typeof data?.text === "string" && data.text.trim()
          ? data.text.trim()
          : JSON.stringify(data, null, 2);
      setSttOutput(transcriptText);
      if (typeof data?.text === "string" && data.text.trim()) {
        setAgentVoiceDescription(data.text.trim());
        setAgentVoiceStatus("STT transcript loaded. Review it in Create, then click Generate now.");
      }
      setSttStatus("Transcription Complete");
    } catch (error) {
      console.error(error);
      setSttOutput("Error: Transcription failed.");
      setSttStatus("Failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClone = async () => {
    if (!cloneName || cloneFiles.length === 0) {
      setCloneStatus("Name and files are required.");
      return;
    }
    if (!cloneConsent) {
      setCloneStatus("Please confirm the legal disclaimer.");
      return;
    }

    setIsCloning(true);
    setCloneStatus("Cloning...");

    try {
      const formData = new FormData();
      formData.append("name", cloneName);
      formData.append("description", cloneDesc);
      const labels = {
        language: cloneLanguage,
        accent: cloneLocation,
        gender: cloneGender,
        age: cloneAge,
        cloned: "true"
      };
      formData.append("labels", JSON.stringify(labels));
      cloneFiles.forEach(f => formData.append("files", f));

      const res = await authedFetch("/api/echo/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Cloning failed");

      setCloneStatus("Voice cloned successfully!");
      setCloneName("");
      setCloneDesc("");
      setCloneFiles([]);
      setCloneConsent(false);
    } catch (error) {
      console.error(error);
      setCloneStatus("Error: Cloning failed.");
    } finally {
      setIsCloning(false);
    }
  };

  const handlePlayPreview = useCallback((url?: string) => {
    if (!url) return;
    if (currentAudio) {
      currentAudio.pause();
      voicePreviewAudioRef.current = null;
      setCurrentAudio(null);
    }
    if (voicePreviewAnimationRef.current) {
      cancelAnimationFrame(voicePreviewAnimationRef.current);
      voicePreviewAnimationRef.current = null;
    }
    voicePreviewCtxRef.current?.close();
    voicePreviewCtxRef.current = null;
    voicePreviewAnalyserRef.current = null;
    setVoicePreviewVolume(0);

    const audio = new Audio(url);

    const stopVisualizer = () => {
      if (voicePreviewAnimationRef.current) {
        cancelAnimationFrame(voicePreviewAnimationRef.current);
        voicePreviewAnimationRef.current = null;
      }
      voicePreviewCtxRef.current?.close();
      voicePreviewCtxRef.current = null;
      voicePreviewAnalyserRef.current = null;
      setVoicePreviewVolume(0);
    };

    audio.onended = () => {
      stopVisualizer();
      voicePreviewAudioRef.current = null;
      setCurrentAudio(null);
    };
    audio.onpause = () => {
      stopVisualizer();
      voicePreviewAudioRef.current = null;
      setCurrentAudio(null);
    };

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      voicePreviewCtxRef.current = ctx;
      voicePreviewAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!voicePreviewAnalyserRef.current) return;
        voicePreviewAnalyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVoicePreviewVolume(Math.min(100, (avg / 128) * 100));
        voicePreviewAnimationRef.current = requestAnimationFrame(tick);
      };
      voicePreviewAnimationRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext not supported or failed
    }

    voicePreviewAudioRef.current = audio;
    audio.play();
    setCurrentAudio(audio);
  }, [currentAudio]);

  const handlePlayHistory = async (id: string) => {
    if (currentAudio) currentAudio.pause();
    playHistoryAbortRef.current?.abort();
    playHistoryAbortRef.current = new AbortController();
    const signal = playHistoryAbortRef.current.signal;
    setLoadingHistoryId(id);
    setTtsStatus("Fetching audio...");
    try {
      const res = await authedFetch(`/api/echo/history/${id}`, { signal });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody as { error?: string })?.error || res.statusText || "Failed to fetch history audio";
        throw new Error(`${msg} (${res.status})`);
      }
      const blob = await res.blob();
      if (signal.aborted) return;
      if (historyAudioUrl) URL.revokeObjectURL(historyAudioUrl);
      const url = URL.createObjectURL(blob);
      setHistoryAudioUrl(url);
      setPlayingHistoryId(id);
      setTtsStatus("Playing");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error(err);
      setTtsStatus("Error playing history");
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const handleDownloadHistory = async (id: string, text: string, format: "mp3" | "wav") => {
    setTtsStatus("Preparing download...");
    try {
      const res = await authedFetch(`/api/echo/history/${id}?format=${format}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody as { error?: string })?.error || res.statusText || "Failed to fetch history audio";
        throw new Error(`${msg} (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === "wav" ? "wav" : "mp3";
      const a = document.createElement("a");
      a.href = url;
      a.download = `EburonAI_${text.substring(0, 20).replace(/[^a-z0-9]/gi, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTtsStatus("");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error downloading audio");
    }
  };

  const [agentBases, setAgentBases] = useState<{ id: string; name?: string }[]>([]);
  const [agentBasesError, setAgentBasesError] = useState<string | null>(null);
  const [isFetchingBases, setIsFetchingBases] = useState(false);
  const [userAssistantId, setUserAssistantId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState(DEFAULT_AGENT_NAME);
  const [agentStatus, setAgentStatus] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Create-from-scratch form (beside iPhone dialer)
  const [agentLanguage, setAgentLanguage] = useState("en-US");
  const [agentVoice, setAgentVoice] = useState("vapi:Nico");
  const [agentIntroSpiel, setAgentIntroSpiel] = useState(DEFAULT_AGENT_INTRO);
  const [agentSkillsPrompt, setAgentSkillsPrompt] = useState(DEFAULT_AGENT_SKILLS);
  const [agentKnowledgeFiles, setAgentKnowledgeFiles] = useState<{ id: string; name: string }[]>([]);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
  const [agentVoiceDescription, setAgentVoiceDescription] = useState("");
  const [isAgentVoiceRecording, setIsAgentVoiceRecording] = useState(false);
  const [agentVoiceTimerSeconds, setAgentVoiceTimerSeconds] = useState(120);
  const [agentVoiceLevel, setAgentVoiceLevel] = useState(0);
  const [isAgentVoiceGenerating, setIsAgentVoiceGenerating] = useState(false);
  const [agentVoiceStatus, setAgentVoiceStatus] = useState("");
  const agentVoiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentVoiceRecognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const agentVoiceStreamRef = useRef<MediaStream | null>(null);
  const agentVoiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentVoiceAnimationRef = useRef<number | null>(null);
  const agentVoiceTranscriptRef = useRef<string[]>([]);
  const createFormRef = useRef<HTMLDivElement>(null);
  const createGenerateSectionRef = useRef<HTMLDivElement>(null);
  const [dialerNumber, setDialerNumber] = useState("");
  const [phonebookEntries, setPhonebookEntries] = useState<{ name: string; number: string }[]>([]);
  const [selectedDialerAgentId, setSelectedDialerAgentId] = useState<string>(DEFAULT_SAMPLE_AGENT.id);
  const [dialerCallStatus, setDialerCallStatus] = useState("");
  const [isDialerCalling, setIsDialerCalling] = useState(false);
  const [callLogs, setCallLogs] = useState<{ id: string; type?: string; status?: string; customer?: { number?: string }; assistantId?: string; createdAt?: string; endedAt?: string }[]>([]);
  const [isCallLogsLoading, setIsCallLogsLoading] = useState(false);
  const [playingCallLogId, setPlayingCallLogId] = useState<string | null>(null);
  const [callLogRecordingUrl, setCallLogRecordingUrl] = useState<string | null>(null);
  const [callLogPlaybackError, setCallLogPlaybackError] = useState<string | null>(null);
  const [loadingCallLogId, setLoadingCallLogId] = useState<string | null>(null);
  const [expandedCallLogId, setExpandedCallLogId] = useState<string | null>(null);
  const [expandedCallTranscript, setExpandedCallTranscript] = useState<string | null>(null);
  const [callLogTranscriptCopyFeedback, setCallLogTranscriptCopyFeedback] = useState(false);
  const [isExpandedCallLoading, setIsExpandedCallLoading] = useState(false);
  const callLogAudioRef = useRef<HTMLAudioElement>(null);
  const longPress0Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPress0HandledRef = useRef(false);

  const handlePlayCallLog = useCallback(async (callId: string) => {
    setCallLogPlaybackError(null);
    if (playingCallLogId === callId) {
      callLogAudioRef.current?.pause();
      setPlayingCallLogId(null);
      setCallLogRecordingUrl(null);
      return;
    }
    setLoadingCallLogId(callId);
    try {
      const res = await authedFetch(`/api/orbit/calls/${callId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch call");
      const url = data?.artifact?.recordingUrl || data?.artifact?.stereoRecordingUrl;
      if (!url) {
        setCallLogPlaybackError("No recording available for this call.");
        return;
      }
      setCallLogRecordingUrl(url);
      setPlayingCallLogId(callId);
    } catch (err) {
      setCallLogPlaybackError(err instanceof Error ? err.message : "Could not load recording");
    } finally {
      setLoadingCallLogId(null);
    }
  }, [authedFetch, playingCallLogId]);

  useEffect(() => {
    if (callLogRecordingUrl && callLogAudioRef.current) {
      callLogAudioRef.current.src = callLogRecordingUrl;
      callLogAudioRef.current.play().catch(() => {});
    }
  }, [callLogRecordingUrl]);

  const handleDownloadCallLog = useCallback(async (callId: string) => {
    try {
      const res = await authedFetch(`/api/orbit/calls/${callId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch call");
      const url = data?.artifact?.recordingUrl || data?.artifact?.stereoRecordingUrl;
      if (!url) {
        setCallLogPlaybackError("No recording available for this call.");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-${callId}.mp3`;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setCallLogPlaybackError(err instanceof Error ? err.message : "Could not download recording");
    }
  }, [authedFetch]);

  const handleExpandCallLog = useCallback(async (callId: string) => {
    if (expandedCallLogId === callId) {
      setExpandedCallLogId(null);
      setExpandedCallTranscript(null);
      return;
    }
    setExpandedCallLogId(callId);
    setExpandedCallTranscript(null);
    setIsExpandedCallLoading(true);
    try {
      const res = await authedFetch(`/api/orbit/calls/${callId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch call");
      const transcript = formatCallTranscript(data);
      setExpandedCallTranscript(transcript);
    } catch {
      setExpandedCallTranscript("(Could not load transcript)");
    } finally {
      setIsExpandedCallLoading(false);
    }
  }, [authedFetch, expandedCallLogId]);

  const formatCallTranscript = (call: { transcript?: unknown; messages?: unknown[]; artifact?: { transcript?: string } }) => {
    const art = (call as { artifact?: { transcript?: string } }).artifact;
    if (art?.transcript && typeof art.transcript === "string") return art.transcript;
    if (call.transcript && typeof call.transcript === "string") return call.transcript;
    const messages = call.messages ?? call.transcript;
    if (Array.isArray(messages)) {
      return messages
        .filter((m: { transcript?: string }) => m.transcript)
        .map((m: { role?: string; message?: string; content?: string; transcript?: string }) => {
          const text = m.message ?? m.content ?? m.transcript ?? "";
          const role = m.role ?? "unknown";
          const label = role === "user" ? "Customer" : role === "assistant" ? "Agent" : role;
          return `${label}: ${text}`;
        })
        .filter(Boolean)
        .join("\n");
    }
    return "(No transcript available)";
  };

  const getCallFromTo = (c: { type?: string; customer?: { number?: string } }) => {
    const num = c.customer?.number ?? "—";
    if (c.type === "inboundPhoneCall") return { from: num, to: "Our line" };
    if (c.type === "outboundPhoneCall") return { from: "Our line", to: num };
    return { from: "—", to: num || "—" };
  };

  const getCallDuration = (c: { createdAt?: string; endedAt?: string }) => {
    if (!c.createdAt || !c.endedAt) return "—";
    const start = new Date(c.createdAt).getTime();
    const end = new Date(c.endedAt).getTime();
    const sec = Math.round((end - start) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  const getAgentName = (assistantId?: string) => {
    if (!assistantId) return "—";
    const a = agentBases.find((x) => x.id === assistantId);
    return a?.name ?? assistantId.slice(0, 8) + "…";
  };

  const handleDialKeyDown = (digit: string) => {
    if (digit !== "0") {
      setDialerNumber((n) => (n + digit).slice(0, 15));
      return;
    }
    longPress0HandledRef.current = false;
    longPress0Ref.current = setTimeout(() => {
      longPress0Ref.current = null;
      longPress0HandledRef.current = true;
      setDialerNumber((n) => (n + "+").slice(0, 15));
    }, 500);
  };

  const handleDialKeyUp = (digit: string) => {
    if (digit !== "0") return;
    if (longPress0Ref.current) {
      clearTimeout(longPress0Ref.current);
      longPress0Ref.current = null;
    }
    if (!longPress0HandledRef.current) {
      setDialerNumber((n) => (n + "0").slice(0, 15));
    }
    longPress0HandledRef.current = false;
  };

  const fetchAgentBases = useCallback(async () => {
    setIsFetchingBases(true);
    setAgentBasesError(null);
    try {
      const res = await authedFetch("/api/orbit/assistants");
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Failed to load templates';
        setAgentBasesError(msg);
        setAgentBases([]);
        return;
      }
      setAgentBases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch bases:", error);
      setAgentBasesError("Could not load templates. Check your API key.");
      setAgentBases([]);
    } finally {
      setIsFetchingBases(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (activeTab === "pane-agents" || activeTab === "pane-Create" || activeTab === "pane-call-logs") {
      fetchAgentBases();
    }
  }, [activeTab, fetchAgentBases]);

  // Load agent form defaults: Ivan from VAPI, or user's assistant
  const loadAgentFormDefaults = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [userRes, assistantsRes] = await Promise.all([
        fetch("/api/user-assistant", {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        }),
        authedFetch("/api/orbit/assistants", { cache: "no-store" }),
      ]);
      const userData = await userRes.json();
      const assistantsRaw = await assistantsRes.json();
      const assistants = Array.isArray(assistantsRaw) ? assistantsRaw : [];
      const myAssistantId = userData?.assistantId ?? null;
      setUserAssistantId(myAssistantId);

      const ivanId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_IVAN_ID;
      const ivan = ivanId
        ? assistants.find((a: { id?: string }) => a.id === ivanId)
        : assistants.find((a: { name?: string }) => /ivan/i.test(a.name || ""));
      const defaultAssistant = myAssistantId
        ? assistants.find((a: { id?: string }) => a.id === myAssistantId) ?? ivan
        : ivan;

      if (defaultAssistant?.id) {
        const detailRes = await authedFetch(`/api/orbit/assistants/${defaultAssistant.id}`, { cache: "no-store" });
        const detail = await detailRes.json();
        if (detail?.id) {
          const sysMsg = detail.model?.messages?.find((m: { role?: string }) => m.role === "system");
          setNewAgentName(detail.name || DEFAULT_AGENT_NAME);
          setAgentIntroSpiel(detail.firstMessage || DEFAULT_AGENT_INTRO);
          setAgentSkillsPrompt(sysMsg?.content || DEFAULT_AGENT_SKILLS);
          const lang = detail.transcriber?.language;
          setAgentLanguage(lang === "multi" ? "multilingual" : lang || "en");
          const v = detail.voice;
          if (v?.provider && v?.voiceId) {
            setAgentVoice(`${v.provider}:${v.voiceId}`);
          }
        }
      }
    } catch {
      // Keep current defaults
    }
  }, [authedFetch, user]);

  useEffect(() => {
    if ((activeTab === "pane-agents" || activeTab === "pane-Create") && user) {
      loadAgentFormDefaults();
    }
  }, [activeTab, user, loadAgentFormDefaults]);

  // Always include default sample agent first, then fetched agents (no duplicate id)
  const displayAgents = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name?: string }[] = [{ ...DEFAULT_SAMPLE_AGENT }];
    seen.add(DEFAULT_SAMPLE_AGENT.id);
    agentBases.forEach((a) => {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        out.push(a);
      }
    });
    return out;
  }, [agentBases]);

  const [showUserProfile, setShowUserProfile] = useState(false);

  const handleEditAgain = useCallback(() => {
    setAgentStatus("");
    setAgentKnowledgeFiles([]);
    loadAgentFormDefaults();
  }, [loadAgentFormDefaults]);

  const fetchApiKeys = useCallback(async () => {
    setIsApiKeysLoading(true);
    setApiKeysStatus("");
    try {
      const res = await authedFetch("/api/api-keys", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load API keys");
      setApiKeys(Array.isArray(data?.keys) ? data.keys : []);
    } catch (err) {
      setApiKeys([]);
      setApiKeysStatus(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsApiKeysLoading(false);
    }
  }, [authedFetch]);

  const fetchApiUsage = useCallback(async () => {
    try {
      const res = await authedFetch("/api/api-keys/usage?days=7", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load usage");
      setApiUsageSummary(data);
    } catch {
      setApiUsageSummary(null);
    }
  }, [authedFetch]);

  const handleCreateApiKey = useCallback(async () => {
    setApiKeysStatus("");
    setNewlyCreatedApiKey("");
    try {
      const res = await authedFetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newApiKeyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create API key");
      if (typeof data?.rawApiKey === "string") setNewlyCreatedApiKey(data.rawApiKey);
      await Promise.all([fetchApiKeys(), fetchApiUsage()]);
      setApiKeysStatus("API key created. Copy it now; it will not be shown again.");
    } catch (err) {
      setApiKeysStatus(err instanceof Error ? err.message : "Failed to create API key");
    }
  }, [authedFetch, fetchApiKeys, fetchApiUsage, newApiKeyName]);

  const handleRevokeApiKey = useCallback(async (id: string) => {
    setApiKeysStatus("");
    try {
      const res = await authedFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to revoke API key");
      setApiKeysStatus("API key revoked.");
      await Promise.all([fetchApiKeys(), fetchApiUsage()]);
    } catch (err) {
      setApiKeysStatus(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  }, [authedFetch, fetchApiKeys, fetchApiUsage]);

  useEffect(() => {
    if ((activeTab !== "pane-settings" && activeTab !== "pane-docs") || !user) return;
    fetchApiKeys();
    fetchApiUsage();
  }, [activeTab, fetchApiKeys, fetchApiUsage, user]);

  const handleKnowledgeBaseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const allowed = ["txt", "pdf", "docx", "doc", "csv", "md", "tsv", "yaml", "yml", "json", "xml", "log"];
    const valid = files.filter((f) => {
      const ext = f.name?.split(".").pop()?.toLowerCase() || "";
      return allowed.includes(ext) && f.size <= 300 * 1024;
    });
    if (valid.length === 0) {
      setAgentStatus("Use .txt, .pdf, .docx, .csv, .md, .json, etc. (max 300KB each).");
      return;
    }
    setIsUploadingKnowledge(true);
    setAgentStatus("");
    try {
      const uploaded: { id: string; name: string }[] = [];
      for (const file of valid) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/orbit/file", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Upload failed");
        uploaded.push({ id: data.id, name: file.name });
      }
      setAgentKnowledgeFiles((prev) => [...prev, ...uploaded]);
      setAgentStatus(`${uploaded.length} file(s) added to knowledge base.`);
    } catch (err) {
      setAgentStatus("Error: " + (err instanceof Error ? err.message : "Upload failed"));
    } finally {
      setIsUploadingKnowledge(false);
      e.target.value = "";
    }
  }, []);

  const removeKnowledgeFile = useCallback((id: string) => {
    setAgentKnowledgeFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const stopAgentVoiceRecording = useCallback(() => {
    if (agentVoiceTimerRef.current) {
      clearInterval(agentVoiceTimerRef.current);
      agentVoiceTimerRef.current = null;
    }
    if (agentVoiceAnimationRef.current) {
      cancelAnimationFrame(agentVoiceAnimationRef.current);
      agentVoiceAnimationRef.current = null;
    }
    setAgentVoiceLevel(0);
    const recognition = agentVoiceRecognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
      agentVoiceRecognitionRef.current = null;
    }
    const stream = agentVoiceStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      agentVoiceStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (agentVoiceTimerRef.current) clearInterval(agentVoiceTimerRef.current);
      if (agentVoiceAnimationRef.current) cancelAnimationFrame(agentVoiceAnimationRef.current);
      agentVoiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (voicePreviewAnimationRef.current) cancelAnimationFrame(voicePreviewAnimationRef.current);
      voicePreviewCtxRef.current?.close();
      voicePreviewAudioRef.current?.pause();
    };
  }, []);

  const handleAgentVoiceRecord = useCallback(async () => {
    if (isAgentVoiceRecording) {
      stopAgentVoiceRecording();
      return;
    }
    const SpeechRecognitionAPI = typeof window !== "undefined" && ((window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) {
      setAgentVoiceStatus("Web Speech API not supported in this browser. Use Chrome or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      agentVoiceStreamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      agentVoiceAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!agentVoiceAnalyserRef.current) return;
        agentVoiceAnalyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAgentVoiceLevel(Math.min(100, (avg / 128) * 100));
        agentVoiceAnimationRef.current = requestAnimationFrame(tick);
      };
      agentVoiceAnimationRef.current = requestAnimationFrame(tick);

      const recognition = new SpeechRecognitionAPI() as {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start(): void;
        stop(): void;
        onresult: ((e: { resultIndex: number; results: Array<{ isFinal: boolean; 0?: { transcript: string } }> }) => void) | null;
        onend: (() => void) | null;
        onerror: ((e: { error: string }) => void) | null;
      };
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      agentVoiceTranscriptRef.current = [];

      recognition.onresult = (e: { resultIndex: number; results: Array<{ isFinal: boolean; 0?: { transcript: string } }> }) => {
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          const t = res[0]?.transcript?.trim() || "";
          if (res.isFinal && t && i >= e.resultIndex) {
            agentVoiceTranscriptRef.current.push(t);
          } else if (t) {
            interim = t;
          }
        }
        const finalText = agentVoiceTranscriptRef.current.join(" ");
        const display = interim ? `${finalText} ${interim}`.trim() : finalText;
        if (display) setAgentVoiceDescription(display);
      };

      recognition.onend = () => {
        const transcript = agentVoiceTranscriptRef.current.join(" ").trim();
        if (transcript) {
          setAgentVoiceDescription((prev) => {
            const trimmed = prev.trim();
            if (trimmed && trimmed !== transcript && !trimmed.endsWith(transcript)) return `${trimmed}\n\n${transcript}`;
            return transcript;
          });
          setAgentVoiceStatus("Transcribed. Review, edit if needed, then click Generate now.");
          createGenerateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          setAgentVoiceStatus("No speech detected. Speak clearly and try again.");
        }
        if (agentVoiceAnimationRef.current) cancelAnimationFrame(agentVoiceAnimationRef.current);
        agentVoiceStreamRef.current?.getTracks().forEach((t) => t.stop());
        agentVoiceStreamRef.current = null;
        setIsAgentVoiceRecording(false);
        setAgentVoiceTimerSeconds(120);
      };

      recognition.onerror = (e: { error: string }) => {
        if (e.error !== "aborted") {
          setAgentVoiceStatus("Error: " + (e.error === "no-speech" ? "No speech detected." : e.error));
        }
      };

      agentVoiceRecognitionRef.current = recognition;
      recognition.start();

      setIsAgentVoiceRecording(true);
      setAgentVoiceTimerSeconds(120);
      setAgentVoiceStatus("Recording... You have 2 minutes. Describe what your agent should do.");

      agentVoiceTimerRef.current = setInterval(() => {
        setAgentVoiceTimerSeconds((s) => {
          if (s <= 1) {
            stopAgentVoiceRecording();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setAgentVoiceStatus("Error: " + (err instanceof Error ? err.message : "Microphone access denied"));
      setIsAgentVoiceRecording(false);
    }
  }, [isAgentVoiceRecording, stopAgentVoiceRecording]);

  const streamAgentTemplateFromPrompt = useCallback(async (prompt: string) => {
    const agentRes = await fetch("/api/agent-from-voice?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: prompt }),
    });
    if (!agentRes.ok) {
      const errData = await agentRes.json().catch(() => ({}));
      throw new Error((errData as { error?: string })?.error || "Failed to create template");
    }
    const reader = agentRes.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { type: string; value?: string; name?: string; firstMessage?: string; systemPrompt?: string };
          if (chunk.type === "name" && chunk.value) setNewAgentName(chunk.value);
          if (chunk.type === "firstMessage" && chunk.value) setAgentIntroSpiel(chunk.value);
          if (chunk.type === "systemPrompt" && chunk.value) setAgentSkillsPrompt(chunk.value);
          if (chunk.type === "done") {
            if (chunk.name) setNewAgentName(chunk.name);
            if (chunk.firstMessage) setAgentIntroSpiel(chunk.firstMessage);
            if (chunk.systemPrompt) setAgentSkillsPrompt(chunk.systemPrompt);
            setAgentVoice("vapi:Nico");
          }
        } catch {
          /* skip invalid lines */
        }
      }
    }
  }, []);

  const handleAgentVoiceGenerate = useCallback(async () => {
    const text = agentVoiceDescription.trim();
    if (!text) {
      setAgentVoiceStatus("Describe your agent above first (use mic or type).");
      return;
    }
    setIsAgentVoiceGenerating(true);
    setAgentVoiceStatus("Streaming Ivan template...");
    try {
      await streamAgentTemplateFromPrompt(text);
      setAgentVoiceStatus("Done! Edit details below and click Use this agent.");
      setAgentStatus("Template filled. Review and adjust as needed.");
      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setAgentVoiceStatus("Error: " + (err instanceof Error ? err.message : "Failed"));
    } finally {
      setIsAgentVoiceGenerating(false);
    }
  }, [agentVoiceDescription, streamAgentTemplateFromPrompt]);

  const handleGenerateAgentTemplateFromTts = useCallback(async () => {
    const prompt = ttsText.trim();
    if (!prompt) {
      setTtsStatus("Error: Add text in TTS editor first.");
      return;
    }
    setAgentVoiceDescription(prompt);
    setActiveTab("pane-Create");
    setIsAgentVoiceGenerating(true);
    setAgentVoiceStatus("Generating template from TTS editor prompt...");
    try {
      await streamAgentTemplateFromPrompt(prompt);
      setAgentVoiceStatus("Done! Template generated from TTS prompt.");
      setAgentStatus("Template filled from TTS editor text. Review and adjust as needed.");
      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTtsStatus("Template sent to Create tab.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setAgentVoiceStatus(`Error: ${message}`);
      setTtsStatus("Error: Could not generate template from TTS text.");
    } finally {
      setIsAgentVoiceGenerating(false);
    }
  }, [streamAgentTemplateFromPrompt, ttsText]);

  const handleCreateMyAgent = async () => {
    if (!newAgentName.trim()) {
      setAgentStatus("Agent name is required.");
      return;
    }
    if (!user) {
      setAgentStatus("Sign in to create or update your agent.");
      return;
    }
    setIsCreatingAgent(true);
    const isUpdate = !!userAssistantId;
    setAgentStatus(isUpdate ? "Updating agent..." : "Creating agent...");
    try {
      const voiceParts = agentVoice.split(":");
      const voice = voiceParts.length >= 2
        ? { provider: voiceParts[0] as "vapi" | "11labs", voiceId: voiceParts.slice(1).join(":") }
        : undefined;
      const body: Record<string, unknown> = {
        name: newAgentName.trim(),
        firstMessage: agentIntroSpiel.trim() || undefined,
        systemPrompt: agentSkillsPrompt.trim() || "You are a helpful AI assistant.",
        language: agentLanguage,
        voice,
      };
      if (isUpdate) body.assistantId = userAssistantId;
      if (agentKnowledgeFiles.length > 0) {
        body.fileIds = agentKnowledgeFiles.map((f) => f.id);
      }
      const res = await fetch("/api/orbit/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || (isUpdate ? "Agent update failed" : "Agent creation failed"));
      const assistantId = data.id;
      setAgentStatus(isUpdate ? "Agent updated! Loading into dialer." : "Agent created! Loading into dialer.");
      setAgentKnowledgeFiles([]);
      setSelectedDialerAgentId(assistantId);
      setUserAssistantId(assistantId);
      setAgentBases((prev) => {
        const exists = prev.some((a) => a.id === assistantId);
        if (exists) return prev.map((a) => a.id === assistantId ? { ...a, name: data.name || newAgentName } : a);
        return [...prev, { id: assistantId, name: data.name || newAgentName }];
      });
      if (!isUpdate) {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch("/api/user-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ assistantId }),
        });
      }
      fetchAgentBases();
    } catch (error) {
      console.error(error);
      setAgentStatus("Error: " + (error instanceof Error ? error.message : (isUpdate ? "Update failed." : "Creation failed.")));
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleBulkPhonebookUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const lines = text.split(/\r?\n/).filter(Boolean);
      const entries: { name: string; number: string }[] = [];
      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        if (parts.length >= 2) {
          entries.push({ name: parts[0], number: parts[1].replace(/\D/g, "").slice(-10) });
        } else if (parts[0] && /^\d+$/.test(parts[0].replace(/\D/g, ""))) {
          entries.push({ name: "Unknown", number: parts[0].replace(/\D/g, "").slice(-10) });
        }
      }
      setPhonebookEntries((prev) => [...prev, ...entries]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const activeItem = navItems.find((item) => item.id === activeTab);

  if (isAuthLoading) {
    return (
      <div className="app bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-lime" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-header text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://eburon.ai/icon-eburon.svg"
              alt="Eburon"
              className="mx-auto mb-4 rounded-xl logo-img-lg"
            />
            <h1>Eburon AI</h1>
          </div>

          <div className="auth-tabs">
            <div
              className={`auth-tab ${authMode === "login" ? "active" : ""}`}
              onClick={() => { setAuthMode("login"); setAuthStatus(""); }}
            >
              Login
            </div>
            <div
              className={`auth-tab ${authMode === "register" ? "active" : ""}`}
              onClick={() => { setAuthMode("register"); setAuthStatus(""); }}
            >
              Register
            </div>
          </div>

          <form onSubmit={authMode === "login" ? handleEmailSignIn : authMode === "register" ? handleEmailSignUp : handleResetPassword}>
            <div className="field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {authMode !== "forgot" && (
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {authMode === "register" && (
              <div className="field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button className="btn primary w-full mt-4" disabled={isAuthProcessing}>
              {isAuthProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                authMode === "login" ? "Sign In" : authMode === "register" ? "Create Account" : "Send Reset Link"
              )}
            </button>

            {authStatus && (
              <p className={`text-2xs text-center mt-4 ${authStatus.toLowerCase().includes("error") || authStatus.toLowerCase().includes("fail") || authStatus.toLowerCase().includes("match") ? "text-bad" : "text-lime"}`}>
                {authStatus}
              </p>
            )}

            <div className="auth-footer">
              <span
                className="auth-link"
                onClick={() => {
                  setAuthMode(authMode === "forgot" ? "login" : "forgot");
                  setAuthStatus("");
                }}
              >
                {authMode === "forgot" ? "Back to Login" : "Forgot your password?"}
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${isFullWidthHeight ? "app-full-width-height" : ""}`}>
      {/* SIDEBAR */}
      <aside className="card">
        <div className="cardBody sidebar-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://eburon.ai/icon-eburon.svg"
              alt="Eburon"
              className="rounded-xl logo-img"
            />
            <div>
              <div className="brand-name">Eburon AI</div>
            </div>
          </div>

          <nav className="nav-menu">
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon} {item.label}
              </div>
            ))}
          </nav>

          {/* User Profile Area */}
          <div className="sidebar-profile">
            <div 
              className="profile-info cursor-pointer hover:bg-gray-800 rounded-lg p-2 transition-colors"
              onClick={() => setShowUserProfile(!showUserProfile)}
            >
              <div className="profile-avatar text-xs overflow-hidden bg-lime-500 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="profile-details">
                <div className="profile-name text-sm font-medium">{user.email}</div>
                <div className="profile-tier text-xs text-gray-400">Click for options</div>
              </div>
              <div className={`profile-chevron transition-transform ${showUserProfile ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </div>
            
            {showUserProfile && (
              <div className="profile-dropdown bg-gray-800 rounded-lg p-2 mt-2 border border-gray-700">
                <div className="profile-item text-sm text-gray-300 px-2 py-1">
                  {user.email}
                </div>
                <div className="profile-separator border-t border-gray-700 my-1"></div>
                <button 
                  onClick={handleLogout}
                  className="profile-logout text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors w-full text-left"
                >
                  Sign Out
                </button>
              </div>
            )}
            <div className="api-badge flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="status-dot ok"></div>
                <span>Connected</span>
              </div>
              <button
                className="btn icon-only scale-90"
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`card ${isFullWidthHeight ? "main-full-width-height" : ""}`}>
        <div className="cardHeader">
          <div className="title">
            <h1>{activeTab === "pane-audio" ? "Audio" : activeItem?.label}</h1>
            {activeTab === "pane-audio" ? (
              <small>{audioSubTab === "voices" ? "Voice Library" : audioSubTab === "tts" ? "Text to Speech" : audioSubTab === "stt" ? "Speech to Text" : "History"}</small>
            ) : activeTab !== "pane-call-logs" && <small>{activeItem?.desc}</small>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn icon-only"
              onClick={() => setIsFullWidthHeight((v) => !v)}
              title={isFullWidthHeight ? "Exit full width/height" : "Full width & height"}
              aria-label={isFullWidthHeight ? "Exit full width/height" : "Full width & height"}
            >
              {isFullWidthHeight ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="btn" onClick={() => setActiveTab("pane-settings")} title="API Key">
              <Key size={16} className="mr-2" /> <span className="text-lime">API Key</span>
            </button>
          </div>
        </div>

        <div className={`cardBody ${activeTab === "pane-audio" ? "cardBody-audio" : ""}`}>
          {activeTab === "pane-audio" && (
            <>
              <div className="audio-sub-tabs">
                <button type="button" className={`audio-sub-tab ${audioSubTab === "voices" ? "active" : ""}`} onClick={() => setAudioSubTab("voices")}>Voices</button>
                <button type="button" className={`audio-sub-tab ${audioSubTab === "tts" ? "active" : ""}`} onClick={() => setAudioSubTab("tts")}>Text to Speech</button>
                <button type="button" className={`audio-sub-tab ${audioSubTab === "stt" ? "active" : ""}`} onClick={() => setAudioSubTab("stt")}>Speech to Text</button>
                <button type="button" className={`audio-sub-tab ${audioSubTab === "history" ? "active" : ""}`} onClick={() => setAudioSubTab("history")}>History</button>
              </div>
              {audioSubTab === "voices" && (() => {
                // cspell:ignore premade
                // Inner voice sub-tabs
                const voiceViewTabs = ["explore", "my-voices", "default"] as const;
                type VoiceView = typeof voiceViewTabs[number];
                const voiceViewLabels: Record<VoiceView, string> = { explore: "Explore", "my-voices": "My Voices", default: "Default Voices" };

                // Derive use-case chips from voice labels
                const useCaseSet = new Set<string>();
                voices.forEach(v => { if (v.labels?.use_case) useCaseSet.add(v.labels.use_case); });
                const styles = [
                  "Action Hero", "Adventure", "Animation", "Architecture", "Audiobook", 
                  "Children's Stories", "Cinema", "Conversational", "Cooking", "Corporate", 
                  "Customer Support", "Design", "Documentary", "E-commerce", "E-learning", 
                  "Education", "Engineering", "Financial", "Folk Stories", "Gaming", 
                  "Government", "Healthcare", "History", "IT Services", "Inspiration", 
                  "K-Pop News", "Literature", "Local News", "Luxury", "Meditation", 
                  "Military", "Mythology", "Narrative", "Nature", "News", "Outdoors", 
                  "Poetry", "Politics", "Professional", "Radio", "Showbiz", "Social Media", 
                  "Sports", "Tech Support", "Tourism", "Traditional", "Travel", "Urban", 
                  "Vlog", "Weather", "Advertisement", "Characters Animation", "Conversational", 
                  "Entertainment TV", "Informative Educational", "Narrative Story", "Social Media"
                ];
                styles.forEach(s => useCaseSet.add(s));
                const useCaseChips = [...useCaseSet].sort();

                // Derive unique languages
                const allLanguages = [...new Set(voices.map(v => v.labels?.language || "").filter(Boolean))].sort();

                // Determine which view is active (reuse voiceFilterCategory as the inner tab state)
                const activeView: VoiceView = (voiceFilterCategory === "my-voices" || voiceFilterCategory === "default") ? voiceFilterCategory as VoiceView : "explore";

                // Filter by inner tab
                let tabFiltered = voices;
                if (activeView === "my-voices") {
                  tabFiltered = voices.filter(v => v.category === "cloned" || v.category === "generated");
                } else if (activeView === "default") {
                  tabFiltered = voices.filter(v => v.category !== "cloned" && v.category !== "generated");
                }

                // Filter by use-case chip (stored in voiceFilterLanguage as overloaded state)
                const activeUseCase = voiceFilterLanguage !== "all" && !allLanguages.includes(voiceFilterLanguage) ? voiceFilterLanguage : null;
                const activeLanguageFilter = voiceFilterLanguage !== "all" && allLanguages.includes(voiceFilterLanguage) ? voiceFilterLanguage : null;

                const filtered = tabFiltered.filter(v => {
                  if (activeUseCase && (v.labels?.use_case || "") !== activeUseCase) return false;
                  if (activeLanguageFilter && (v.labels?.language || "") !== activeLanguageFilter) return false;
                  if (voiceSearchQuery) {
                    const q = voiceSearchQuery.toLowerCase();
                    const matchesName = v.name.toLowerCase().includes(q);
                    const matchesLang = (v.labels?.language || "").toLowerCase().includes(q);
                    const matchesAccent = (v.labels?.accent || "").toLowerCase().includes(q);
                    const matchesDesc = (v.description || "").toLowerCase().includes(q);
                    if (!matchesName && !matchesLang && !matchesAccent && !matchesDesc) return false;
                  }
                  return true;
                });

                // Group by category for display
                const grouped: Record<string, Voice[]> = {};
                for (const v of filtered) {
                  const cat = v.category || "unknown";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(v);
                }
                const categoryOrder = ["cloned", "generated", "premade", "professional"];
                const sortedCats = Object.keys(grouped).sort((a, b) => {
                  const ai = categoryOrder.indexOf(a);
                  const bi = categoryOrder.indexOf(b);
                  if (ai !== -1 && bi !== -1) return ai - bi;
                  if (ai !== -1) return -1;
                  if (bi !== -1) return 1;
                  return a.localeCompare(b);
                });

                const sectionTitle = (cat: string) => {
                  const m: Record<string, string> = { cloned: "My Cloned Voices", premade: "Library Voices", generated: "Generated Voices", professional: "Professional Voices" };
                  return m[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                };

                return (
                <div className="tab-pane active vl-root">
                  {/* Inner sub-tabs */}
                  <div className="vl-tabs-row">
                    <div className="vl-tabs">
                      {voiceViewTabs.map(t => (
                        <button key={t} type="button" className={`vl-tab ${activeView === t ? "active" : ""}`} onClick={() => { setVoiceFilterCategory(t === "explore" ? "all" : t); }}>
                          {t === "explore" && <AudioWaveform size={14} />}
                          {voiceViewLabels[t]}
                        </button>
                      ))}
                    </div>
                    <span className="pane-meta">{filtered.length} voices</span>
                  </div>

                  {/* Search */}
                  <div className="vl-search-row">
                    <input
                      type="text"
                      className="vl-search"
                      placeholder="Search library voices…"
                      value={voiceSearchQuery}
                      onChange={e => setVoiceSearchQuery(e.target.value)}
                      title="Search"
                    />
                  </div>

                  {/* Filters row with dropdowns */}
                  <div className="vl-filters-row">
                    <div className="vl-filter-group">
                      <div className="vl-filter-label">🌐 Language</div>
                      <select 
                        className="vl-select" 
                        value={activeLanguageFilter || "all"} 
                        onChange={e => setVoiceFilterLanguage(e.target.value)}
                        title="Select Language"
                      >
                        <option value="all">All Languages</option>
                        {allLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    <div className="vl-filter-group">
                      <div className="vl-filter-label">🎯 Style</div>
                      <select 
                        className="vl-select" 
                        value={activeUseCase || "all"} 
                        onChange={e => setVoiceFilterLanguage(e.target.value)}
                        title="Select Style"
                      >
                        <option value="all">All Styles</option>
                        {useCaseChips.map(uc => <option key={uc} value={uc}>{uc}</option>)}
                      </select>
                    </div>

                    {(activeUseCase || activeLanguageFilter || voiceSearchQuery) && (
                      <button type="button" className="vl-filter-clear" onClick={() => { setVoiceFilterLanguage("all"); setVoiceSearchQuery(""); }}>
                        <X size={14} /> Clear
                      </button>
                    )}
                  </div>

                  {/* Audio visualizer */}
                  {currentAudio && (
                    <div className={`audio-visualizer audio-viz-${voicePreviewVizId.replace(/:/g, "")} mb-6`} aria-hidden>
                      <style>{`
                        ${Array.from({ length: 12 })
                          .map((_, i) => `.audio-viz-${voicePreviewVizId.replace(/:/g, "")} .audio-bar:nth-child(${i + 2}) { --bar-height: ${8 + Math.min(92, voicePreviewVolume * (0.5 + 0.5 * Math.sin(i * 0.6)))}%; }`)
                          .join("\n")}
                      `}</style>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="audio-bar" />
                      ))}
                    </div>
                  )}

                  {/* Voice cards by category */}
                  {voices.length === 0 ? (
                    <div className="placeholder-pane h-32 voice-grid-placeholder">Loading voices…</div>
                  ) : filtered.length === 0 ? (
                    <div className="placeholder-pane h-32 voice-grid-placeholder">No voices match your filters.</div>
                  ) : (
                    sortedCats.map(cat => (
                      <div key={cat} className="vl-section">
                        <div className="vl-section-header">
                          <span className="vl-section-title">{sectionTitle(cat)}</span>
                          <span className="vl-section-count">{grouped[cat].length}</span>
                        </div>
                        <div className="vl-grid">
                          {grouped[cat].map(v => (
                            <div 
                              key={v.voice_id} 
                              className={`vl-card ${currentAudio && currentAudio.src === v.preview_url ? "playing" : ""}`}
                              onClick={() => {
                                if (v.preview_url) handlePlayPreview(v.preview_url);
                              }}
                            >
                              <div className="vl-card-avatar">
                                <Volume2 
                                  size={16} 
                                  className={currentAudio && currentAudio.src === v.preview_url ? "text-lime animate-pulse" : ""}
                                />
                              </div>
                              <div className="vl-card-info">
                                <div className="vl-card-name" title={v.name}>{v.name}</div>
                                <div className="vl-card-category">{v.labels?.use_case || v.category || "General"}</div>
                                <div className="vl-card-lang">
                                  {v.labels?.language || v.labels?.accent || ""}
                                  {v.labels?.accent && v.labels?.language ? ` · ${v.labels.accent}` : ""}
                                </div>
                              </div>
                              {v.preview_url && (
                                <button
                                  type="button"
                                  className="vl-card-play-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayPreview(v.preview_url);
                                  }}
                                  title="Play Preview"
                                >
                                  {currentAudio && currentAudio.src === v.preview_url ? <PhoneOff size={14} /> : <Play size={14} />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                );
              })()}
              {audioSubTab === "tts" && (
                <div className="tab-pane active el-tts-layout">
                  {/* Left Pane: Text Editor */}
                  <div className="el-tts-left">
                    <div className="el-tts-editor-header">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn text-2xs" onClick={() => setTtsText(enhanceTextForTTS(ttsText))} title="Symbols only: @ → at, . → dot (emails, URLs)">
                          Enhance symbols
                        </button>
                        <button type="button" className="btn text-2xs text-lime border border-lime/50" onClick={() => setTtsText(normalizeForTTS(ttsText))} title="Normalize numbers, currency, phone, abbreviations for speech">
                          Normalize for TTS
                        </button>
                        <button type="button" className="btn text-2xs" onClick={() => setTtsText(ttsText + (ttsText.endsWith(" ") ? "" : " ") + BREAK_TAG)} title="Append [pause]">
                          Add pause
                        </button>
                        <button type="button" className="btn text-2xs" onClick={handleEnhanced} disabled={isEnhancingExpression || !ttsText.trim()} title="Add nuances for natural speech (no brackets)">
                          {isEnhancingExpression ? <Loader2 size={16} className="animate-spin" /> : "Enhanced"}
                        </button>
                        <button type="button" className="btn text-2xs text-lime border border-lime/50" onClick={handleAddExpression} disabled={isEnhancingExpression || !ttsText.trim()} title="Use AI to add expressive tags">
                          Add expression
                        </button>
                      </div>
                    </div>
                    <textarea
                      id="ttsText"
                      className="el-tts-textarea"
                      placeholder="Enter text..."
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                    ></textarea>
                    
                    {/* Bottom controls integrated into left pane footer */}
                    <div className="el-tts-footer">
                      <div className="el-tts-status">
                        <Loader2 size={14} className="text-muted" style={{ opacity: isGenerating ? 1 : 0 }} />
                        <span className="text-xs text-muted">{ttsText.length} characters</span>
                      </div>
                      <div className="el-tts-actions">
                        <button className="btn primary el-generate-btn" id="btnGenerateTTS" onClick={handleGenerateTTS} disabled={isGenerating}>
                          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : "Generate speech"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Pane: Settings */}
                  <div className="el-tts-right">
                    <div className="el-settings-tabs">
                      <button className="el-settings-tab active">Settings</button>
                      <button className="el-settings-tab">History</button>
                    </div>

                    <div className="el-settings-content">
                      <div className="el-field-group">
                        <label className="el-label">Voice</label>
                        <select
                          className="el-select"
                          value={selectedVoice}
                          onChange={(e) => setSelectedVoice(e.target.value)}
                          title="Select a voice for synthesis"
                          aria-label="Select Voice"
                        >
                          {voices.length === 0 ? (
                            <option value="">Loading voices...</option>
                          ) : (
                            voices.map((v) => (
                              <option key={v.voice_id} value={v.voice_id}>
                                {v.name} {v.labels?.accent ? `(${v.labels.accent})` : ""}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="el-field-group">
                        <label className="el-label">Model</label>
                        <div className="el-select-fake">{ECHO_MODEL_OPTIONS[0].label}</div>
                      </div>

                      <div className="el-field-group mt-auto">
                        <label className="el-label mb-2">Audio Preview</label>
                        <audio id="ttsAudio" controls className="el-audio-player w-full" ref={audioRef}></audio>
                      </div>

                      {ttsStatus && ttsStatus.startsWith("Error") && (
                        <div className="text-xs text-bad mt-4 p-3 border border-bad/30 rounded-lg bg-bad/5">
                          {ttsStatus}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn w-full justify-center mt-4"
                        onClick={handleGenerateAgentTemplateFromTts}
                        disabled={isAgentVoiceGenerating || !ttsText.trim()}
                        title="Use this TTS prompt to generate the Create agent template"
                      >
                        {isAgentVoiceGenerating ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                        Generate Agent Template
                      </button>

                    </div>
                  </div>
                </div>
              )}
              {audioSubTab === "history" && (
                <div className="tab-pane active tab-pane-full-height">
              <div className="history-pane-inner">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <label className="block">TTS History</label>
                  <button className="text-2xs text-lime bg-transparent hover:text-white" onClick={fetchRealTimeHistory}>Refresh</button>
                </div>
                {historyAudioUrl && (
                  <div className="mb-4 p-4 rounded-xl border border-border bg-panel flex items-center gap-4 shrink-0">
                    <audio
                      ref={historyAudioRef}
                      src={historyAudioUrl}
                      controls
                      className="flex-1 h-10"
                      onEnded={() => { setTtsStatus(""); setPlayingHistoryId(null); }}
                    />
                  </div>
                )}
                <div className="history-list">
                    {isHistoryLoading ? (
                      <div className="placeholder-pane h-32 flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>
                    ) : historyError ? (
                      <div className="placeholder-pane h-32 flex flex-col items-center justify-center gap-2 text-center">
                        <span className="text-bad">{historyError}</span>
                        <span className="text-2xs text-muted">Check API keys in configuration.</span>
                        <button className="btn text-2xs mt-2" onClick={fetchRealTimeHistory}>Retry</button>
                      </div>
                    ) : history.length === 0 ? (
                      <div className="placeholder-pane h-32 flex items-center justify-center text-muted">No history yet</div>
                    ) : (
                      history.slice(0, 50).map((h) => (
                        <div key={h.id} className="history-card">
                          <button
                            className={`history-play-btn ${playingHistoryId === h.id ? "playing" : ""} ${loadingHistoryId === h.id ? "loading" : ""}`}
                            onClick={() => handlePlayHistory(h.id)}
                            disabled={loadingHistoryId === h.id}
                            title="Play"
                            aria-label="Play"
                          >
                            {loadingHistoryId === h.id ? (
                              <Loader2 size={20} className="animate-spin text-inherit" />
                            ) : playingHistoryId === h.id ? (
                              <Volume2 size={20} className="text-inherit" />
                            ) : (
                              <Play size={20} fill="currentColor" stroke="currentColor" className="history-play-icon" />
                            )}
                          </button>
                          <div className="history-card-body">
                            <div className="history-card-text" title={h.text}>{h.text}</div>
                            <div className="history-card-meta">
                              <span className="voice-pill">{h.voice_name}</span>
                              <span className="history-card-date">{new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="history-card-actions">
                            <button
                              className="history-card-action"
                              onClick={() => { setTtsText(h.text); setSelectedVoice(h.voice_id); setActiveTab("pane-audio"); setAudioSubTab("tts"); }}
                              title="Re-synthesize"
                            >
                              <AudioWaveform size={20} />
                            </button>
                            <div className="relative" ref={downloadMenuId === h.id ? downloadMenuRef : undefined}>
                              <button
                                className="history-card-action"
                                onClick={(e) => { e.stopPropagation(); setDownloadMenuId(downloadMenuId === h.id ? null : h.id); }}
                                title="Download"
                              >
                                <Download size={20} />
                              </button>
                              {downloadMenuId === h.id && (
                                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-panel py-1 min-w-[90px] shadow-xl">
                                  <button className="block w-full text-left px-4 py-2 text-sm hover:bg-limeDim"
                                    onClick={() => { handleDownloadHistory(h.id, h.text, "mp3"); setDownloadMenuId(null); }}>MP3</button>
                                  <button className="block w-full text-left px-4 py-2 text-sm hover:bg-limeDim"
                                    onClick={() => { handleDownloadHistory(h.id, h.text, "wav"); setDownloadMenuId(null); }}>WAV</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                </div>
              </div>
            </div>
              )}
              {audioSubTab === "stt" && (
                <div className="tab-pane active">
              <div className="field">
                <label htmlFor="sttFile">Audio File</label>
                <input
                  type="file"
                  id="sttFile"
                  accept="audio/*"
                  onChange={(e) => setSttFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2.5 items-center mb-6">
                <button
                  className="btn primary"
                  onClick={handleTranscribe}
                  disabled={isTranscribing || !sttFile}
                >
                  {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  Transcribe Audio
                </button>
                {(sttStatus.includes("Error") || sttStatus === "Failed") && (
                  <span className="text-xs text-bad">{sttStatus}</span>
                )}
              </div>
              <div className="field flex-1">
                <label htmlFor="sttOutput">Transcription</label>
                <textarea
                  id="sttOutput"
                  readOnly
                  placeholder=""
                  value={sttOutput}
                ></textarea>
              </div>
              <div className="flex gap-2.5 items-center mt-3 flex-wrap">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const transcript = sttOutput.trim();
                    if (!transcript) return;
                    setAgentVoiceDescription(transcript);
                    setActiveTab("pane-Create");
                    setAgentVoiceStatus("Transcript inserted into Describe your agent.");
                  }}
                  disabled={!sttOutput.trim()}
                >
                  <Mic size={16} />
                  Use in Describe Agent
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    const transcript = sttOutput.trim();
                    if (!transcript) return;
                    setAgentVoiceDescription(transcript);
                    setActiveTab("pane-Create");
                    setIsAgentVoiceGenerating(true);
                    setAgentVoiceStatus("Generating template from STT transcript...");
                    try {
                      await streamAgentTemplateFromPrompt(transcript);
                      setAgentVoiceStatus("Done! Template generated from STT transcript.");
                      setAgentStatus("Template filled from STT transcript. Review and adjust as needed.");
                      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    } catch (err) {
                      setAgentVoiceStatus("Error: " + (err instanceof Error ? err.message : "Failed"));
                    } finally {
                      setIsAgentVoiceGenerating(false);
                    }
                  }}
                  disabled={isAgentVoiceGenerating || !sttOutput.trim()}
                >
                  {isAgentVoiceGenerating ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                  Generate Agent Template
                </button>
              </div>
                </div>
              )}
            </>
          )}

          {activeTab === "pane-clone" && (
            <div className="tab-pane active">
              <div className="field">
                <label htmlFor="cloneName">Voice Name</label>
                <input
                  type="text"
                  id="cloneName"
                  placeholder="Voice name"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cloneDesc">Description</label>
                <textarea
                  id="cloneDesc"
                  placeholder="Description"
                  value={cloneDesc}
                  onChange={(e) => setCloneDesc(e.target.value)}
                  className="h-20"
                ></textarea>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="cloneLanguage">Language & Model</label>
                  <select
                    id="cloneLanguage"
                    className="input-field"
                    value={cloneLanguage}
                    onChange={(e) => {
                      setCloneLanguage(e.target.value);
                      setCloneLocation("General");
                    }}
                  >
                    <option value="Filipino">Filipino</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Dutch">Dutch</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Italian">Italian</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Korean">Korean</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Turkish">Turkish</option>
                    <option value="Vietnamese">Vietnamese</option>
                    <option value="Indonesian">Indonesian</option>
                    <option value="Russian">Russian</option>
                    <option value="en">Auto Detect</option>
                    {models.find(m => m.model_id === "echo_multilingual_v2" || m.model_id === "eleven_multilingual_v2")?.languages.map(lang => (
                      <option key={lang.language_id} value={lang.language_id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cloneLocation">Regional Dialect / Accent</label>
                  <select
                    id="cloneLocation"
                    title="Select Accent or Dialect"
                    className="input-field"
                    value={cloneLocation}
                    onChange={(e) => setCloneLocation(e.target.value)}
                    disabled={!cloneLanguage}
                  >
                    <option value="">Auto-detect</option>
                    {cloneLanguage && languageDialectMap[cloneLanguage]?.map(dialect => (
                      <option key={dialect} value={dialect}>{dialect}</option>
                    ))}
                    {/* Fallback options if cloneLanguage is not set or not found in map */}
                    {!cloneLanguage || !languageDialectMap[cloneLanguage] && (
                      <>
                        <option value="General">General / Standard</option>
                        <option value="USA">USA / North America</option>
                        <option value="UK">UK / British</option>
                        <option value="Australia">Australian</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label htmlFor="cloneGender">Gender</label>
                  <select 
                    id="cloneGender" 
                    value={cloneGender}
                    onChange={(e) => setCloneGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cloneAge">Age Group</label>
                  <select 
                    id="cloneAge" 
                    value={cloneAge}
                    onChange={(e) => setCloneAge(e.target.value)}
                  >
                    <option value="Young">Young</option>
                    <option value="Middle-aged">Middle-aged</option>
                    <option value="Old">Old</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="cloneFiles">Sample Files (Multiple allowed)</label>
                <div className="upload-zone" onClick={() => document.getElementById("cloneFiles")?.click()}>
                  <Volume2 size={20} className="mb-2 mx-auto" />
                  <div>{cloneFiles.length > 0 ? `${cloneFiles.length} files selected` : "Drop samples here or click to browse"}</div>
                  <input 
                    type="file" 
                    id="cloneFiles" 
                    multiple 
                    accept="audio/*" 
                    onChange={(e) => setCloneFiles(Array.from(e.target.files || []))}
                  />
                </div>
              </div>
              <div className="field">
                <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl mb-4">
                  <input 
                    type="checkbox" 
                    id="cloneConsent" 
                    className="mt-1"
                    checked={cloneConsent}
                    onChange={(e) => setCloneConsent(e.target.checked)}
                  />
                  <label htmlFor="cloneConsent" className="text-2xs text-faint leading-relaxed cursor-pointer select-none">
                    I hereby confirm that I have all necessary rights or consents to upload and clone these voice samples and that I will not use the platform-generated content for any illegal, fraudulent, or harmful purpose. I reaffirm my obligation to abide by Eburon AI Terms of Service and Privacy Policy.
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 items-center">
                <button 
                  className="btn primary" 
                  onClick={handleClone}
                  disabled={isCloning || !cloneName || cloneFiles.length === 0 || !cloneConsent}
                >
                  {isCloning ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} 
                  Clone Voice
                </button>
                {cloneStatus.startsWith("Error") && (
                  <span className="text-xs text-bad">{cloneStatus}</span>
                )}
              </div>
            </div>
          )}

          {activeTab === "pane-Create" && (
            <div className="tab-pane active Create-pane">
              {/* Step 1: Describe your agent (voice or type) */}
              <div ref={createGenerateSectionRef} className="Create-hero">
                <div className="Create-hero-label">Describe your agent</div>
                <div className="Create-input-wrap">
                  <textarea
                    placeholder="Describe what your agent should do..."
                    value={agentVoiceDescription}
                    onChange={(e) => setAgentVoiceDescription(e.target.value)}
                    className="w-full min-h-[120px] px-4 py-3 rounded-xl border-0 bg-transparent text-sm resize-y focus:ring-0 focus:outline-none placeholder:text-faint"
                    disabled={isAgentVoiceRecording}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="btn primary text-2xs flex items-center gap-2"
                      onClick={handleAgentVoiceGenerate}
                      disabled={isAgentVoiceGenerating || !agentVoiceDescription.trim()}
                    >
                      {isAgentVoiceGenerating && <Loader2 size={16} className="animate-spin" />}
                      {isAgentVoiceGenerating ? "Generating..." : "Generate now"}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAgentVoiceRecording && (
                      <div className="flex items-end gap-1 h-6" aria-hidden>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const h = Math.max(4, (agentVoiceLevel / 100) * 20 * (0.6 + 0.4 * Math.sin((i + agentVoiceLevel) * 0.3)));
                          const heightClass = h >= 18 ? 'h-5' : h >= 14 ? 'h-4' : h >= 10 ? 'h-3' : h >= 6 ? 'h-2' : 'h-1';
                          return (
                            <div
                              key={i}
                              className={`w-1.5 rounded-full bg-lime/90 transition-all duration-75 ${heightClass}`}
                            />
                          );
                        })}
                      </div>
                    )}
                    <span className="text-2xs text-muted min-w-[4rem]">
                      {isAgentVoiceRecording
                        ? `${Math.floor(agentVoiceTimerSeconds / 60)}:${String(agentVoiceTimerSeconds % 60).padStart(2, "0")}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className={`p-2.5 rounded-xl transition-all shrink-0 ${isAgentVoiceRecording ? "bg-red-500/20 text-red-400" : "bg-white/5 hover:bg-limeDim text-lime border border-white/10"}`}
                      onClick={handleAgentVoiceRecord}
                      title={isAgentVoiceRecording ? "Click to stop (or wait for 2 min)" : "Record with mic (2 min max)"}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </div>
                {agentVoiceStatus && (agentVoiceStatus.startsWith("Error") || agentVoiceStatus.includes("not supported")) && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-2xs text-bad">
                    {agentVoiceStatus}
                  </div>
                )}
              </div>

              {/* Step 2: Create agent (prompt input, dialer) */}
              <div className="Create-divider">
                <div className="Create-divider-title">Create agent</div>
                <div className="Create-actions-row">
                  <div className="Create-action-phone flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                    <Phone size={20} className="text-lime" />
                    <span className="font-medium">Phone call</span>
                  </div>
                  <button
                    type="button"
                    className="btn primary Create-action-web flex items-center justify-center gap-2 px-4 py-3"
                    onClick={() => {
                      const agentId = selectedDialerAgentId || displayAgents[0]?.id || DEFAULT_SAMPLE_AGENT.id;
                      setSelectedDialerAgentId(agentId || "");
                      handleToggleCall(agentId);
                    }}
                    disabled={callStatus === "loading"}
                  >
                    <Volume2 size={20} />
                    Web call
                  </button>
                </div>
                {agentBasesError && (
                  <div className="mb-4 p-3 rounded border border-red-500/50 bg-red-500/10 text-red-200 text-2xs">
                    {agentBasesError}
                  </div>
                )}

                <div className="agents-layout">
                  {/* Left column: iPhone + Knowledge Base */}
                  <div className="agents-layout-left">
                    {/* iPhone Mockup Dialer */}
                    <div className="iphone-mockup">
                    <div className="iphone-frame">
                      <div className="iphone-notch"></div>
                      <div className="iphone-screen">
                        <div className="dialer-header">
                          <span className="dialer-time">Dialer</span>
                        </div>
                        <div className="dialer-agent-select">
                          <label className="text-2xs text-faint">Agent</label>
                          <select
                            title="Select agent for calls"
                            value={selectedDialerAgentId}
                            onChange={(e) => setSelectedDialerAgentId(e.target.value)}
                            className="dialer-select"
                          >
                            <option value="">Select agent</option>
                            {displayAgents.map((a) => (
                              <option key={a.id} value={a.id}>{a.name || a.id}</option>
                            ))}
                          </select>
                        </div>
                        <div className="dialer-number-display">
                          <input
                            type="tel"
                            placeholder="Number"
                            value={dialerNumber}
                            onChange={(e) => setDialerNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                            className="dialer-number-input"
                          />
                          {dialerNumber && (
                            <button
                              type="button"
                              className="dialer-backspace"
                              onClick={() => setDialerNumber((n) => n.slice(0, -1))}
                              title="Backspace"
                              aria-label="Backspace"
                            >
                              ←
                            </button>
                          )}
                        </div>
                        <div className="dialer-pad">
                          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                            <button
                              key={digit}
                              type="button"
                              className="dialer-key"
                              onClick={digit === "0" ? undefined : () => setDialerNumber((n) => (n + digit).slice(0, 15))}
                              onPointerDown={digit === "0" ? () => handleDialKeyDown(digit) : undefined}
                              onPointerUp={digit === "0" ? () => handleDialKeyUp(digit) : undefined}
                              onPointerLeave={digit === "0" ? () => { if (longPress0Ref.current) { clearTimeout(longPress0Ref.current); longPress0Ref.current = null; } } : undefined}
                            >
                              {digit === "0" ? (
                                <span className="dialer-key-0"><span>0</span><span className="dialer-key-plus">+</span></span>
                              ) : (
                                digit
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="dialer-actions">
                          {callStatus === "active" ? (
                            <button
                              type="button"
                              className="dialer-end-call-btn"
                              onClick={() => {
                                orbit?.stop();
                                setShowTestCallModal(false);
                              }}
                            >
                              <PhoneOff size={18} />
                              End call
                            </button>
                          ) : (
                            <button
                              className="btn primary dialer-call-btn"
                              onClick={async () => {
                                const num = dialerNumber.replace(/\s/g, "").replace(/[^\d+]/g, "");
                                if (!num) return;
                                if (!selectedDialerAgentId) {
                                  setDialerCallStatus("Select an agent first.");
                                  return;
                                }
                                setIsDialerCalling(true);
                                setDialerCallStatus("");
                                try {
                                  const res = await authedFetch("/api/orbit/call", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ assistantId: selectedDialerAgentId, customerNumber: num }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data?.error || "Outbound call failed");
                                  setDialerCallStatus("Call initiated. Calling the number.");
                                  fetchCallLogs();
                                } catch (err) {
                                  setDialerCallStatus("Error: " + (err instanceof Error ? err.message : "Call failed"));
                                } finally {
                                  setIsDialerCalling(false);
                                }
                              }}
                              disabled={!dialerNumber.trim() || isDialerCalling}
                            >
                              {isDialerCalling ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
                              {isDialerCalling ? "Calling…" : "Call"}
                            </button>
                          )}
                          <label className="upload-phonebook-btn">
                            <Upload size={16} />
                            Upload phonebook
                            <input
                              type="file"
                              accept=".csv,.txt"
                              onChange={handleBulkPhonebookUpload}
                              hidden
                            />
                          </label>
                        </div>
                        {dialerCallStatus && (
                          <span className={`text-2xs block text-center ${dialerCallStatus.startsWith("Error") ? "text-bad" : "text-muted"}`}>
                            {dialerCallStatus}
                          </span>
                        )}
                        {phonebookEntries.length > 0 && (
                          <div className="phonebook-list">
                            <div className="phonebook-header text-2xs text-faint">{phonebookEntries.length} contacts</div>
                            <div className="phonebook-scroll">
                              {phonebookEntries.slice(0, 8).map((p, i) => (
                                <div
                                  key={i}
                                  className="phonebook-row"
                                  onClick={() => setDialerNumber(p.number)}
                                >
                                  <span>{p.name}</span>
                                  <span className="text-lime">{p.number}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>

                    {/* Knowledge Base - below iPhone, parallel to form */}
                    <div className="knowledge-base-card Create-create-card">
                      <h4 className="knowledge-base-title">Knowledge Base</h4>
                      <div className="upload-zone upload-zone-compact" onClick={() => document.getElementById("agentKnowledgeFiles")?.click()}>
                        <Database size={20} className="mb-1" />
                        <span className="text-2xs">
                          {isUploadingKnowledge ? (
                            <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Uploading…</span>
                          ) : (
                            "Upload docs"
                          )}
                        </span>
                        <input
                          type="file"
                          id="agentKnowledgeFiles"
                          multiple
                          accept=".txt,.pdf,.docx,.doc,.csv,.md,.tsv,.yaml,.yml,.json,.xml,.log"
                          onChange={handleKnowledgeBaseUpload}
                          hidden
                        />
                      </div>
                      {agentKnowledgeFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {agentKnowledgeFiles.map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-2xs"
                            >
                              {f.name}
                              <button
                                type="button"
                                className="p-0.5 hover:bg-white/10 rounded"
                                onClick={() => removeKnowledgeFile(f.id)}
                                aria-label="Remove"
                              >
                                <X size={14} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Create Agent Form */}
                  <div ref={createFormRef} className="create-agent-form Create-create-card">
                    <h3 className="create-agent-title">Create My Agent</h3>
                    <div className="field">
                      <label>Agent Name</label>
                      <input
                        type="text"
                        placeholder="Agent name"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Voice</label>
                      <select
                        title="Select voice for agent"
                        value={agentVoice}
                        onChange={(e) => setAgentVoice(e.target.value)}
                        className="w-full"
                      >
                        <optgroup label="Built-in voices">
                          <option value="vapi:Nico">Nico (Ivan)</option>
                          <option value="vapi:elliot">Elliot</option>
                          <option value="vapi:savannah">Savannah</option>
                        </optgroup>
                        <optgroup label="Custom / Cloned">
                          {voices.length === 0 ? (
                            <option value="11labs:EXAVITQu4vr4xnSDxMaL" disabled>Loading voices…</option>
                          ) : (
                            voices.map((v) => (
                              <option key={v.voice_id} value={`11labs:${v.voice_id}`}>
                                {v.name}{v.labels?.cloned === "true" ? " (cloned)" : ""}
                              </option>
                            ))
                          )}
                        </optgroup>
                      </select>
                    </div>
                    <div className="field">
                      <label>Languages Spoken</label>
                      <select
                        title="Languages spoken by agent"
                        value={agentLanguage}
                        onChange={(e) => setAgentLanguage(e.target.value)}
                      >
                        <option value="multilingual">Multilingual</option>
                        <option value="en">English</option>
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="nl">Dutch</option>
                        <option value="pl">Polish</option>
                        <option value="ru">Russian</option>
                        <option value="ja">Japanese</option>
                        <option value="zh">Chinese</option>
                        <option value="ko">Korean</option>
                        <option value="hi">Hindi</option>
                        <option value="ar">Arabic</option>
                        <option value="tr">Turkish</option>
                        <option value="vi">Vietnamese</option>
                        <option value="id">Indonesian</option>
                        <option value="th">Thai</option>
                        <option value="fil">Filipino</option>
                        <option value="sv">Swedish</option>
                        <option value="da">Danish</option>
                        <option value="fi">Finnish</option>
                        <option value="no">Norwegian</option>
                        <option value="cs">Czech</option>
                        <option value="el">Greek</option>
                        <option value="he">Hebrew</option>
                        <option value="hu">Hungarian</option>
                        <option value="ro">Romanian</option>
                        <option value="uk">Ukrainian</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Intro Spiel (first message)</label>
                      <textarea
                        placeholder="Greeting message"
                        value={agentIntroSpiel}
                        onChange={(e) => setAgentIntroSpiel(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="field">
                      <label>Agent prompt</label>
                      <textarea
                        placeholder="Instructions for the agent..."
                        value={agentSkillsPrompt}
                        onChange={(e) => setAgentSkillsPrompt(e.target.value)}
                        rows={5}
                        className="Create-prompt-field w-full resize-y"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        className="btn primary flex-1 create-my-agent-btn"
                        onClick={handleCreateMyAgent}
                        disabled={isCreatingAgent || !newAgentName.trim()}
                      >
                        {isCreatingAgent ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                        Use this agent
                      </button>
                      <button
                        className="btn"
                        onClick={handleEditAgain}
                        disabled={isCreatingAgent}
                      >
                        Edit again
                      </button>
                    </div>
                    {agentStatus.startsWith("Error") && (
                      <span className="text-xs block mt-2 text-bad">{agentStatus}</span>
                    )}
                  </div>
                </div>

              <div className="mt-8 max-w-[980px]">
                <label className="mb-3 block text-2xs font-semibold text-faint uppercase tracking-wider">Active</label>
                <div className={`placeholder-pane h-24 text-2xs ${callStatus === "active" ? "border-lime" : ""}`}>
                  {callStatus === "active" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="status-dot ok animate-pulse"></div>
                      <div className="text-lime">Session Active: {activeAgentId}</div>
                    </div>
                  ) : (
                    "No active call"
                  )}
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === "pane-agents" && (
            <div className="tab-pane active">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <label className="block">Templates ({displayAgents.length})</label>
                <button
                  type="button"
                  className="btn icon-only"
                  onClick={fetchAgentBases}
                  disabled={isFetchingBases}
                  title="Refresh templates"
                >
                  {isFetchingBases ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
              </div>
              <div className="grid grid-2">
                {displayAgents.map((a) => (
                  <div key={a.id} className="card p-5 flex flex-col items-center text-center transition-all group relative overflow-hidden hover:border-lime">
                    <div className="w-12 h-12 rounded-full bg-limeDim flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users size={20} className="text-lime" />
                    </div>
                    <div className="font-bold mb-4">{a.name || "Unnamed Assistant"}</div>
                    <div className="flex gap-2 w-full mt-auto">
                      <button
                        className="btn flex-1 text-2xs"
                        onClick={() => handleToggleCall(a.id)}
                        disabled={callStatus === "loading" || (callStatus === "active" && activeAgentId !== a.id)}
                      >
                        {callStatus === "loading" && activeAgentId === a.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          "Test Call"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {displayAgents.length === 0 && !isFetchingBases && !agentBasesError && (
                  <div className="placeholder-pane h-20 text-2xs col-span-2">
                    No templates yet
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "pane-call-logs" && (
            <div className="tab-pane active tab-pane-full-height">
              {callLogPlaybackError && (
                <div className="mb-4 p-3 rounded border border-red-500/50 bg-red-500/10 text-red-200 text-2xs">
                  {callLogPlaybackError}
                </div>
              )}
              {callLogRecordingUrl && (
                <div className="call-logs-audio mb-4 p-3 rounded-xl border border-border bg-panel flex items-center gap-3">
                  <audio
                    ref={callLogAudioRef}
                    src={callLogRecordingUrl}
                    controls
                    className="flex-1 h-8"
                    onEnded={() => { setPlayingCallLogId(null); setCallLogRecordingUrl(null); }}
                  />
                </div>
              )}
              <div className="call-logs-table">
                {isCallLogsLoading && callLogs.length === 0 ? (
                  <div className="call-logs-loading">
                    <Loader2 size={20} className="animate-spin text-lime" />
                    <span>Loading call logs…</span>
                  </div>
                ) : (() => {
                  const filtered = callLogs;
                  return filtered.length === 0 ? (
                    <div className="call-logs-empty">
                      {callLogs.length === 0 ? "No calls yet" : "No calls match your filters"}
                    </div>
                  ) : (
                    <div className="call-logs-rows">
                      <div className="call-log-row call-log-header">
                        <span className="call-log-expand" title="Transcript"></span>
                        <span>Type</span>
                        <span>Status</span>
                        <span>From</span>
                        <span>To</span>
                        <span>Agent</span>
                        <span>Duration</span>
                        <span>Date</span>
                        <span className="call-log-actions">Actions</span>
                      </div>
                      {filtered.map((c) => {
                        const { from, to } = getCallFromTo(c);
                        const isExpanded = expandedCallLogId === c.id;
                        return (
                          <div key={c.id} className="call-log-row-wrapper">
                            <div className="call-log-row">
                              <span className="call-log-expand">
                                <button
                                  type="button"
                                  className={`call-log-icon-btn call-log-transcript-btn ${isExpanded ? "expanded" : ""}`}
                                  onClick={() => handleExpandCallLog(c.id)}
                                  title={isExpanded ? "Hide transcript" : "Show transcript"}
                                  aria-label={isExpanded ? "Hide transcript" : "Show transcript"}
                                >
                                  <FileText size={20} strokeWidth={2} />
                                </button>
                              </span>
                              <span className="call-log-type">
                                {c.type === "webCall" ? "Web" : c.type === "outboundPhoneCall" ? "Outbound" : c.type === "inboundPhoneCall" ? "Inbound" : c.type ?? "—"}
                              </span>
                              <span className="call-log-status">{c.status ? String(c.status).charAt(0).toUpperCase() + String(c.status).slice(1).toLowerCase() : "—"}</span>
                              <span className="call-log-number">{from}</span>
                              <span className="call-log-number">{to}</span>
                              <span className="call-log-agent">{getAgentName(c.assistantId)}</span>
                              <span className="call-log-duration">{getCallDuration(c)}</span>
                              <span className="call-log-date">
                                {c.createdAt ? new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                              </span>
                              <span className="call-log-actions">
                                <button
                                  type="button"
                                  className={`call-log-icon-btn call-log-play-btn ${playingCallLogId === c.id ? "playing" : ""} ${loadingCallLogId === c.id ? "loading" : ""}`}
                                  onClick={() => handlePlayCallLog(c.id)}
                                  disabled={loadingCallLogId === c.id}
                                  title="Play recording"
                                  aria-label="Play recording"
                                >
                                  {loadingCallLogId === c.id ? (
                                    <Loader2 size={20} className="animate-spin" />
                                  ) : (
                                    <Play size={20} fill="currentColor" stroke="currentColor" strokeWidth={2} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="call-log-icon-btn call-log-download-btn"
                                  onClick={() => handleDownloadCallLog(c.id)}
                                  title="Download recording"
                                  aria-label="Download recording"
                                >
                                  <Download size={20} strokeWidth={2} />
                                </button>
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="call-log-transcript">
                                <div className="call-log-transcript-inner">
                                {isExpandedCallLoading ? (
                                  <div className="flex items-center gap-2 text-muted text-2xs">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading transcript…
                                  </div>
                                ) : expandedCallTranscript && !["(No transcript available)", "(Could not load transcript)"].includes(expandedCallTranscript) ? (
                                  <>
                                    <div className="call-log-transcript-toolbar">
                                      <button
                                        type="button"
                                        className="btn text-2xs py-1 px-2 flex items-center gap-1.5"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(expandedCallTranscript);
                                            setCallLogTranscriptCopyFeedback(true);
                                            setTimeout(() => setCallLogTranscriptCopyFeedback(false), 2000);
                                          } catch {
                                            /* clipboard failed */
                                          }
                                        }}
                                        title="Copy to clipboard (use as knowledge base)"
                                      >
                                        <Copy size={16} />
                                        {callLogTranscriptCopyFeedback ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                    <pre className="call-log-transcript-text">{expandedCallTranscript}</pre>
                                  </>
                                ) : (
                                  <div className="call-log-transcript-empty">{expandedCallTranscript || "No transcript available"}</div>
                                )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === "pane-docs" && (
            <div className="tab-pane active docs-pane-wrapper">
              <DocsPane
                apiBaseUrl={apiBaseUrl}
                onCopyFeedback={(msg: string) => {
                  setDocsCopyFeedback(msg);
                  setTimeout(() => setDocsCopyFeedback(""), 2000);
                }}
                isAuthenticated={!!user}
                apiKeyName={newApiKeyName}
                onApiKeyNameChange={setNewApiKeyName}
                onCreateApiKey={handleCreateApiKey}
                onRefreshApiKeys={() => {
                  fetchApiKeys();
                  fetchApiUsage();
                }}
                isApiKeysLoading={isApiKeysLoading}
                apiKeysStatus={apiKeysStatus}
                newlyCreatedApiKey={newlyCreatedApiKey}
                onCopyNewApiKey={async () => {
                  try {
                    await navigator.clipboard.writeText(newlyCreatedApiKey);
                    setApiKeysStatus("API key copied.");
                  } catch {
                    setApiKeysStatus("Could not copy key.");
                  }
                }}
              />
              {docsCopyFeedback && (
                <div className="docs-copy-toast">
                  {docsCopyFeedback}
                </div>
              )}
            </div>
          )}

          {activeTab === "pane-settings" && (
            <div className="tab-pane active">
              <div className="settings-grid">
                <section className="settings-card">
                  <h3 className="settings-title">Audio Defaults</h3>
                  <div className="field">
                    <label>Default Echo Model</label>
                    <select title="Default model for TTS" defaultValue={DEFAULT_ECHO_MODEL}>
                      {ECHO_MODEL_OPTIONS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Output Format</label>
                    <select title="Default audio output format">
                      <option>mp3_44100_128</option>
                      <option>wav_44100</option>
                      <option>pcm_24000</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Stability (TTS)</label>
                    <input type="range" min="0" max="1" step="0.1" defaultValue="0.5" title="Adjust voice stability" />
                  </div>
                  <div className="field">
                    <label>Similarity Boost (TTS)</label>
                    <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" title="Adjust voice similarity" />
                  </div>
                  <div className="mt-4">
                    <button className="btn primary" onClick={() => alert("Settings saved locally (Simulated)")}>Save Settings</button>
                  </div>
                </section>

                <section className="settings-card">
                  <h3 className="settings-title">API Keys</h3>
                  <p className="settings-note">
                    Create per-user API keys for external usage. Keys are stored hashed on the server.
                  </p>
                  <div className="api-keys-create-row">
                    <input
                      type="text"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="Key name (e.g., Production app)"
                      title="API key name"
                    />
                    <button className="btn primary" onClick={handleCreateApiKey}>Create Key</button>
                  </div>
                  {newlyCreatedApiKey && (
                    <div className="api-key-secret">
                      <code>{newlyCreatedApiKey}</code>
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(newlyCreatedApiKey);
                            setApiKeysStatus("API key copied.");
                          } catch {
                            setApiKeysStatus("Could not copy key.");
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {apiKeysStatus && <div className="settings-note">{apiKeysStatus}</div>}
                  <div className="api-keys-list">
                    {isApiKeysLoading ? (
                      <div className="settings-note">Loading API keys...</div>
                    ) : apiKeys.length === 0 ? (
                      <div className="settings-note">No API keys yet.</div>
                    ) : (
                      apiKeys.map((k) => (
                        <div key={k.id} className="api-key-row">
                          <div className="api-key-meta">
                            <strong>{k.name}</strong>
                            <small>{k.key_prefix}… · Created {new Date(k.created_at).toLocaleString()}</small>
                            <small>
                              Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => handleRevokeApiKey(k.id)}
                            disabled={!!k.revoked_at}
                          >
                            {k.revoked_at ? "Revoked" : "Revoke"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
              <div className="settings-card settings-usage-card">
                <h3 className="settings-title">API Usage (Last 7 Days)</h3>
                {apiUsageSummary ? (
                  <>
                    <div className="usage-grid">
                      <div className="usage-metric"><span>Total</span><strong>{apiUsageSummary.totalRequests}</strong></div>
                      <div className="usage-metric"><span>Success</span><strong>{apiUsageSummary.successRequests}</strong></div>
                      <div className="usage-metric"><span>Errors</span><strong>{apiUsageSummary.errorRequests}</strong></div>
                      <div className="usage-metric"><span>Avg Latency</span><strong>{apiUsageSummary.avgLatencyMs} ms</strong></div>
                    </div>
                    <div className="usage-endpoints">
                      {apiUsageSummary.endpointStats.slice(0, 8).map((s) => (
                        <div key={s.endpoint} className="usage-endpoint-row">
                          <code>{s.endpoint}</code>
                          <span>{s.requests} req</span>
                          <span>{s.errors} err</span>
                          <span>{s.avgLatencyMs} ms</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="settings-note">No usage data yet.</div>
                )}
              </div>
            </div>
          )}

          {!["pane-audio", "pane-clone", "pane-Create", "pane-agents", "pane-call-logs", "pane-docs", "pane-settings"].includes(activeTab) && (
            <div className="tab-pane active placeholder-pane">
              Coming Soon: {activeItem?.label}
            </div>
          )}
        </div>
      </main>

      {/* Test Call Modal: orb, audio visualizer, live transcription */}
      {showTestCallModal && (
        <div className="call-overlay call-modal">
          <div className="call-content">
            <div className="orb-container">
              <div className={`orb active ${isSpeaking ? "speaking" : ""}`}></div>
              {callStatus === "loading" && (
                <div className="text-muted text-sm">Connecting...</div>
              )}
              {callStatus === "active" && (
                <>
                  <div className="text-lime font-bold tracking-widest uppercase text-xs">Web Call</div>
                  <div className="text-2xs text-faint">{activeAgentId}</div>
                  <div className="text-2xs text-muted">Live transcription on</div>
                  <div className={`audio-visualizer audio-viz-${audioVizId.replace(/:/g, "")} mt-4`} aria-hidden>
                    <style>{`
                      ${Array.from({ length: 12 })
                        .map(
                          (_, i) =>
                            `.audio-viz-${audioVizId.replace(/:/g, "")} .audio-bar:nth-child(${i + 2}) { --bar-height: ${8 + Math.min(92, callVolume * 100 * (0.5 + 0.5 * Math.sin(i * 0.6)))}%; }`
                        )
                        .join("\n")}
                    `}</style>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="audio-bar" />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="transcript-box">
              {transcript.length === 0 && !liveInterimTranscript.user && !liveInterimTranscript.agent ? (
                <div className="text-faint text-2xs">—</div>
              ) : (
                <>
                  {transcript.map((t, idx) => (
                    <div key={`${idx}-${t.role}`} className={`mb-4 ${t.role === "user" ? "text-right" : "text-left"}`}>
                      <div className={`inline-block p-3 rounded-xl ${t.role === "user" ? "bg-white/5" : "text-lime"}`}>
                        {t.text}
                      </div>
                    </div>
                  ))}
                  {liveInterimTranscript.user && (
                    <div className="mb-4 text-right">
                      <div className="inline-block p-3 rounded-xl bg-white/5 active-text">
                        {liveInterimTranscript.user}
                      </div>
                    </div>
                  )}
                  {liveInterimTranscript.agent && (
                    <div className="mb-4 text-left">
                      <div className="inline-block p-3 rounded-xl active-text">
                        {liveInterimTranscript.agent}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="call-controls">
              <button
                className="btn danger px-8 py-4 rounded-full"
                onClick={() => {
                  orbit?.stop();
                  setShowTestCallModal(false);
                }}
              >
                <PhoneOff size={20} /> End call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="modal-overlay flex">
          <div className="modal">
            <div className="title mb-5">
              <h1>🔑 Configuration</h1>
            </div>
            <div className="flex gap-2.5 justify-end mt-6">
              <button className="btn" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
