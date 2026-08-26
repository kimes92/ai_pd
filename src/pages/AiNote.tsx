import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Check, Loader2, ArrowLeft, Save, Globe, Lock, Settings, Plus, LogOut, Youtube, X, Mic, Upload, Square, Rewind, FastForward, RefreshCw, Radio } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useShortcuts, expandTrailingTrigger, expandLastWord } from "@/hooks/useShortcuts";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { BIBLE_WHISPER_PROMPT } from "@/lib/bibleGlossary";
import { useLiveTranscription, type LiveSegment } from "@/hooks/useLiveTranscription";
import LiveTranscriptPanel from "@/components/LiveTranscriptPanel";
import { useTypingOrchestra, type OrchestraSegment } from "@/hooks/useTypingOrchestra";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NEW_DRAFT_KEY = "note:new";
const EDIT_DRAFT_PREFIX = "note:edit:";
const SETTINGS_KEY = "ainote_settings";
const YOUTUBE_KEY_PREFIX = "note:youtube:";

// === Composition-buffer flush triggers ===
// Path 1 (combined): buffer must be ≥ CHAR_MIN AND meet one of the α conditions:
//   - user paused typing for IDLE_MS
//   - buffer ends with a sentence-terminal punctuation
// Path 2 (immediate): Enter → flush regardless of length.
const FLUSH_CHAR_MIN = 200;
const FLUSH_IDLE_MS = 1000;
const SENTENCE_TERMINALS = /[.,?!。]\s*$/;

const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
};

interface NoteSettings {
  fontSize: "small" | "normal" | "large" | "xlarge";
  fontWeight: "normal" | "semibold" | "bold";
  fontFamily: "default" | "gothic" | "serif";
}

const defaultSettings: NoteSettings = {
  fontSize: "normal",
  fontWeight: "normal",
  fontFamily: "default",
};

const fontSizeMap = {
  small: "text-sm",
  normal: "text-base",
  large: "text-lg",
  xlarge: "text-xl",
};

const fontWeightMap = {
  normal: "font-normal",
  semibold: "font-semibold",
  bold: "font-bold",
};

const fontFamilyMap = {
  default: "",
  gothic: "font-gothic",
  serif: "font-serif",
};

const AiNote = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { id: editingId } = useParams<{ id: string }>();
  const isEditMode = Boolean(editingId);

  const storageKey = isEditMode ? `${EDIT_DRAFT_PREFIX}${editingId}` : NEW_DRAFT_KEY;
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(!isEditMode);

  const [correctedText, setCorrectedText] = useState("");
  const [currentLineText, setCurrentLineText] = useState("");
  const [title, setTitle] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<string>("");
  const [isPublic, setIsPublic] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isInsideQuote, setIsInsideQuote] = useState<"'" | '"' | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [isMyungjoMode, setIsMyungjoMode] = useState(false);
  const [settings, setSettings] = useState<NoteSettings>(defaultSettings);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeBoxRef = useRef<HTMLTextAreaElement>(null);
  const originalContentRef = useRef<string>("");
  // Refs used by long-lived live-transcription callbacks (declared here to
  // avoid TDZ issues; assigned during render/effects below).
  const insertRef = useRef<(text: string) => void>(() => {});
  const getFullTextRef = useRef<() => string>(() => "");

  // Highlight range for freshly appended corrected text (fades out via CSS).
  const [autoHighlight, setAutoHighlight] = useState<{ start: number; end: number; key: number } | null>(null);

  // Failed orchestra flushes — surface a compact "재교정" banner near the active box.
  type FailedSegment = { seq: number; original: string };
  const [failedSegments, setFailedSegments] = useState<FailedSegment[]>([]);
  const [pendingFlushes, setPendingFlushes] = useState(0);
  // Track which failed originals are currently being retried so we can splice
  // the corrected replacement back into `correctedText` in-place.
  const retryingOriginalsRef = useRef<Map<number, string>>(new Map());

  // YouTube embed (per-note, localStorage)
  const youtubeKey = `${YOUTUBE_KEY_PREFIX}${editingId ?? "new"}`;
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(youtubeKey);
    setYoutubeId(saved || null);
  }, [youtubeKey]);

  const handleApplyYoutube = () => {
    const id = extractYoutubeId(youtubeInput);
    if (!id) {
      toast.error("올바른 YouTube 링크가 아닙니다");
      return;
    }
    setYoutubeId(id);
    localStorage.setItem(youtubeKey, id);
    setYoutubeDialogOpen(false);
    setYoutubeInput("");
    handleCloseAudio(); // share the same left area
  };

  const handleCloseYoutube = () => {
    setYoutubeId(null);
    localStorage.removeItem(youtubeKey);
  };

  // Audio file upload (shares the same left area as YouTube)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);


  useEffect(() => {
    return () => {
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl);
      }
    };
  }, [audioObjectUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioPlaybackRate;
    }
  }, [audioPlaybackRate, audioObjectUrl]);


  const handleCloseAudio = () => {
    setAudioFile(null);
    setAudioTranscript("");
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      setAudioObjectUrl(null);
    }
  };

  const handleAudioUploadClick = () => {
    audioInputRef.current?.click();
  };

  const seekBy = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    const dur = isFinite(el.duration) ? el.duration : Infinity;
    el.currentTime = Math.max(0, Math.min(dur, el.currentTime + delta));
  };

  const TRANSCRIBE_SAFE_BYTES = 20 * 1024 * 1024;

  // Decode any audio file → split into ~45s mono 16kHz WAV chunks so each
  // stays well under the gateway's ~26MB request-body limit.
  const CHUNK_SECONDS = 45;
  const TARGET_SR = 16000;

  const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  };

  const splitAudioToWavChunks = async (file: File): Promise<Blob[]> => {
    const arrayBuf = await file.arrayBuffer();
    const AC: typeof AudioContext =
      (window.AudioContext as typeof AudioContext) ||
      // @ts-expect-error webkit fallback
      window.webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    await ctx.close();

    // Downmix to mono
    const ch = decoded.numberOfChannels;
    const len = decoded.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / ch;
    }

    // Resample to TARGET_SR (linear)
    const srcSR = decoded.sampleRate;
    const ratio = TARGET_SR / srcSR;
    const outLen = Math.floor(len * ratio);
    const resampled = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i / ratio;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(len - 1, i0 + 1);
      const t = srcIdx - i0;
      resampled[i] = mono[i0] * (1 - t) + mono[i1] * t;
    }

    const chunkSize = CHUNK_SECONDS * TARGET_SR;
    const chunks: Blob[] = [];
    for (let start = 0; start < resampled.length; start += chunkSize) {
      chunks.push(encodeWav(resampled.subarray(start, start + chunkSize), TARGET_SR));
    }
    return chunks;
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const transcribeAudioFile = async (file: File) => {
    setIsTranscribingAudio(true);
    try {
      let chunks: Blob[];
      try {
        chunks = await splitAudioToWavChunks(file);
      } catch (decodeErr) {
        console.error("audio decode error:", decodeErr);
        const msg = decodeErr instanceof Error ? decodeErr.message : String(decodeErr);
        setAudioTranscript(`변환 실패: 오디오 디코딩 오류 (${msg})`);
        toast.error("오디오 파일을 디코딩할 수 없습니다");
        return;
      }

      if (chunks.length === 0) {
        setAudioTranscript("");
        toast.info("변환된 텍스트가 비어있습니다");
        return;
      }

      const parts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) {
          toast.message(`음성 변환 중 (${i + 1}/${chunks.length})`);
        }
        const base64 = await blobToBase64(chunks[i]);
        const { data, error } = await supabase.functions.invoke("voice-to-text", {
          body: { audio: base64, mimeType: "audio/wav", prompt: BIBLE_WHISPER_PROMPT },
        });
        if (error) {
          console.error("voice-to-text invoke error:", error);
          const msg = error.message || "알 수 없는 오류";
          setAudioTranscript(`변환 실패 (${i + 1}/${chunks.length}): ${msg}`);
          toast.error(`음성 변환 실패: ${msg}`);
          return;
        }
        if (data?.error) {
          console.error("voice-to-text data.error:", data.error);
          setAudioTranscript(`변환 실패 (${i + 1}/${chunks.length}): ${data.error}`);
          toast.error(`음성 변환 실패: ${data.error}`);
          return;
        }
        const text = ((data?.text as string | undefined) ?? "").trim();
        if (text) parts.push(text);
        // Live update
        setAudioTranscript(parts.join(" "));
      }

      const finalText = parts.join(" ").trim();
      if (!finalText) {
        setAudioTranscript("");
        toast.info("변환된 텍스트가 비어있습니다");
        return;
      }
      setAudioTranscript(finalText);
      toast.success("음성 변환 완료");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Audio transcription error:", err);
      setAudioTranscript(`변환 실패: ${msg}`);
      toast.error(`음성 변환 오류: ${msg}`);
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("음성 파일만 업로드할 수 있습니다");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast.error("파일 크기는 150MB 이하여야 합니다");
      return;
    }

    // Files are chunked client-side (45s WAV chunks), so no size warning needed
    // below the 150MB hard cap above.

    // Close any active YouTube to share the same left area
    handleCloseYoutube();

    setAudioFile(file);
    setAudioObjectUrl(URL.createObjectURL(file));
    setAudioTranscript("");

    await transcribeAudioFile(file);

    // Reset input so the same file can be selected again
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const retryTranscription = async () => {
    if (!audioFile) return;
    setAudioTranscript("");
    await transcribeAudioFile(audioFile);
  };

  const handlePasteAudioTranscript = () => {
    if (!audioTranscript) return;
    insertTranscriptAtCursor(audioTranscript);
    toast.success("노트에 반영되었습니다");
  };

  // Insert transcribed text at the current cursor position of the textarea.
  // Handles the corrected/current-line split the same way as manual typing.
  const insertTranscriptAtCursor = (text: string) => {
    // Bulk transcripts (voice/audio) are already polished — append them to the
    // upper corrected stream so the active composition box stays clean.
    const clean = text.replace(/\s+$/g, "");
    if (!clean) return;
    setCorrectedText((prev) => {
      const next = prev ? prev + "\n" + clean : clean;
      const start = prev ? prev.length + 1 : 0;
      setAutoHighlight({ start, end: next.length, key: Date.now() });
      return next;
    });
    // Bring focus back to the active box for continued typing.
    requestAnimationFrame(() => activeBoxRef.current?.focus());
  };

  // Sync insert ref for live pipeline
  insertRef.current = insertTranscriptAtCursor;

  // ===== Live mic recording -> Whisper -> auto-insert =====
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingMic, setIsTranscribingMic] = useState(false);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  const startMicRecording = async () => {
    try {
      if (
        location.protocol !== "https:" &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1"
      ) {
        toast.error("음성 인식은 HTTPS 환경에서만 작동합니다");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      micChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) micChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(micChunksRef.current, { type: blobType });
        micChunksRef.current = [];
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        micRecorderRef.current = null;
        if (blob.size < 1024) {
          toast.info("녹음된 내용이 없습니다");
          return;
        }
        setIsTranscribingMic(true);
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const { data, error } = await supabase.functions.invoke("voice-to-text", {
            body: { audio: base64, mimeType: blobType, prompt: BIBLE_WHISPER_PROMPT },
          });
          if (error) throw error;
          const text = (data?.text || "").trim();
          if (!text) {
            toast.info("변환된 텍스트가 없습니다");
            return;
          }
          insertTranscriptAtCursor(text);
          toast.success("녹음 내용이 노트에 삽입되었습니다");
        } catch (err) {
          console.error("Mic transcription error:", err);
          toast.error("음성 변환 중 오류가 발생했습니다");
        } finally {
          setIsTranscribingMic(false);
        }
      };
      micRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast.success("녹음을 시작합니다");
    } catch (err: any) {
      console.error("Mic access error:", err);
      if (err?.name === "NotAllowedError") toast.error("마이크 권한을 허용해주세요");
      else if (err?.name === "NotFoundError") toast.error("마이크를 찾을 수 없습니다");
      else toast.error("마이크 접근 중 오류가 발생했습니다");
    }
  };

  const stopMicRecording = () => {
    const rec = micRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setIsRecording(false);
  };

  const toggleMicRecording = () => {
    if (isRecording) stopMicRecording();
    else startMicRecording();
  };

  useEffect(() => {
    return () => {
      if (micRecorderRef.current && micRecorderRef.current.state !== "inactive") {
        micRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ===== Live orchestra transcription (A/B STT + C correction) =====
  const [liveOpen, setLiveOpen] = useState(false);
  const rawBufferRef = useRef<string>("");
  const cModelFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushCModel = useCallback(async () => {
    const raw = rawBufferRef.current.trim();
    if (!raw) return;
    rawBufferRef.current = "";
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correct-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: raw, correctionType: "full" }),
      });
      const polished = response.ok
        ? ((await response.json())?.correctedText as string | undefined)?.trim() || raw
        : raw;
      const cur = getFullTextRef.current();
      const prefix = cur.endsWith("\n") || !cur ? "" : "\n";
      insertRef.current(prefix + polished + "\n");
    } catch (e) {
      console.error("C-model flush failed:", e);
      const cur = getFullTextRef.current();
      const prefix = cur.endsWith("\n") || !cur ? "" : "\n";
      insertRef.current(prefix + raw + "\n");
    }
  }, []);

  const handleLiveSegment = useCallback((seg: LiveSegment) => {
    if (!seg.text.trim()) return;
    rawBufferRef.current = rawBufferRef.current
      ? rawBufferRef.current + " " + seg.text.trim()
      : seg.text.trim();
    if (cModelFlushTimerRef.current) clearTimeout(cModelFlushTimerRef.current);
    cModelFlushTimerRef.current = setTimeout(() => {
      void flushCModel();
    }, 2000);
  }, [flushCModel]);

  const live = useLiveTranscription();

  const startLive = async () => {
    try {
      handleCloseYoutube();
      handleCloseAudio();
      await live.start({ windowMs: 60000, onSegment: handleLiveSegment });
    } catch (e: any) {
      toast.error(e?.message || "라이브 시작 실패");
    }
  };

  const stopLive = () => {
    live.stop();
    // ensure remaining buffer flushes shortly after final segment arrives
    setTimeout(() => {
      if (cModelFlushTimerRef.current) clearTimeout(cModelFlushTimerRef.current);
      void flushCModel();
    }, 500);
  };

  const closeLive = () => {
    if (live.isLive) live.stop();
    setLiveOpen(false);
  };

  useEffect(() => {
    return () => {
      if (cModelFlushTimerRef.current) clearTimeout(cModelFlushTimerRef.current);
    };
  }, []);

  // 단축어 사전 (전역, DB 저장)
  const { map: shortcutMap } = useShortcuts();

  // 1. 설정값 & 사용자 관심사 불러오기
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }

    const fetchInterests = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("interests").eq("id", user.id).single();
        if (profile?.interests) setInterests(profile.interests);
      }
    };
    fetchInterests();
  }, []);

  const updateSettings = (newSettings: NoteSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  // 전체 텍스트 합치기 (빈 줄바꿈 방지 로직 개선)
  const getFullText = useCallback(() => {
    if (!correctedText) return currentLineText;
    if (!currentLineText) return correctedText; // currentLineText가 비어있을 때 불필요한 줄바꿈(\n) 방지
    return correctedText + "\n" + currentLineText;
  }, [correctedText, currentLineText]);

  // Keep refs to the latest closures for use inside long-lived live-transcription callbacks
  useEffect(() => {
    getFullTextRef.current = getFullText;
  }, [getFullText]);

  // ===== Draft autosave (localStorage + IndexedDB, beforeunload flush) =====
  type DraftShape = {
    correctedText: string;
    currentLineText: string;
    title: string;
    noteDate: string;
    category: string;
    isPublic: boolean;
  };
  const draftData: DraftShape = {
    correctedText,
    currentLineText,
    title,
    noteDate,
    category,
    isPublic,
  };
  const draft = useDraftAutosave<DraftShape>(
    storageKey,
    draftData,
    isInitialLoadDone,
    (d) => Boolean(d.correctedText || d.currentLineText || d.title.trim()),
  );

  // ===== Edit-mode: load existing note from DB =====
  useEffect(() => {
    if (!isEditMode || !editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("로그인이 필요합니다");
          navigate("/auth");
          return;
        }
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", editingId)
          .single();
        if (error || !data) throw error || new Error("not found");
        if (data.user_id !== user.id) {
          toast.error("수정 권한이 없습니다");
          navigate(`/notes/${editingId}`);
          return;
        }
        if (cancelled) return;

        // Apply DB content first
        setCorrectedText(data.content || "");
        setCurrentLineText("");
        setTitle(data.title || "");
        setNoteDate(data.note_date || new Date().toISOString().split("T")[0]);
        setCategory(data.category || "");
        setIsPublic(Boolean(data.is_public));
        originalContentRef.current = data.content || "";

        // Then check for a newer local draft
        const restored = await draft.restore();
        if (restored?.data) {
          const r = restored.data;
          const draftFull = (r.correctedText || "") + (r.currentLineText ? "\n" + r.currentLineText : "");
          if (draftFull && draftFull !== (data.content || "")) {
            setCorrectedText(r.correctedText || "");
            setCurrentLineText(r.currentLineText || "");
            if (r.title) setTitle(r.title);
            if (r.noteDate) setNoteDate(r.noteDate);
            if (typeof r.category === "string") setCategory(r.category);
            if (typeof r.isPublic === "boolean") setIsPublic(r.isPublic);
            toast.info("이전에 작성 중이던 임시 데이터를 복원했습니다");
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("노트를 불러오지 못했습니다");
        navigate("/notes");
      } finally {
        if (!cancelled) setIsInitialLoadDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editingId, navigate]);

  // ===== New-mode: restore draft if any =====
  useEffect(() => {
    if (isEditMode) return;
    let cancelled = false;
    (async () => {
      const restored = await draft.restore();
      if (cancelled || !restored?.data) return;
      const r = restored.data;
      if (r.correctedText || r.currentLineText) {
        setCorrectedText(r.correctedText || "");
        setCurrentLineText(r.currentLineText || "");
        if (r.title) setTitle(r.title);
        if (r.noteDate) setNoteDate(r.noteDate);
        if (typeof r.category === "string") setCategory(r.category);
        if (typeof r.isPublic === "boolean") setIsPublic(r.isPublic);
        toast.info("작성 중이던 임시 데이터를 복원했습니다");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // ===== Initial load complete: focus the active composition box =====
  useEffect(() => {
    if (!isInitialLoadDone) return;
    const ta = activeBoxRef.current;
    if (!ta) return;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoadDone]);

  // Auto-scroll the corrected stream to the bottom whenever new content is
  // appended, leaving a small breathing space above the active box.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Only autoscroll when the user isn't actively editing in the middle of
    // the corrected stream — i.e. caret is at (or near) the end.
    const atEnd = ta.selectionStart >= ta.value.length - 2;
    if (atEnd) {
      ta.scrollTop = ta.scrollHeight;
    }
  }, [correctedText]);

  // UI 핸들러 함수들
  const handleBack = () => {
    const fullText = getFullText();
    const dirty = isEditMode
      ? fullText !== originalContentRef.current
      : Boolean(fullText.trim() || title.trim());
    if (dirty) {
      setShowExitDialog(true);
    } else {
      navigate(isEditMode && editingId ? `/notes/${editingId}` : "/notes");
    }
  };

  const confirmExit = () => {
    // NOTE: keep draft so user can recover by reopening — only clear on successful DB save
    navigate(isEditMode && editingId ? `/notes/${editingId}` : "/notes");
  };

  const handleNewNote = () => {
    const fullText = getFullText();
    if (fullText.trim() || title.trim()) {
      setShowNewNoteDialog(true);
    } else {
      goToNewNote();
    }
  };

  const goToNewNote = () => {
    if (isEditMode) {
      navigate("/");
      return;
    }
    void draft.clear();
    setCorrectedText("");
    setCurrentLineText("");
    setTitle("");
    setNoteDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setIsPublic(false);
    setIsMyungjoMode(false);
    originalContentRef.current = "";
    toast.success("새 노트가 시작되었습니다");
  };

  const handleSaveAndNew = async () => {
    setShowNewNoteDialog(false);
    setSaveDialogOpen(true);
  };

  const handleDiscardAndNew = () => {
    setShowNewNoteDialog(false);
    goToNewNote();
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
    await signOut();
    navigate("/auth");
  };

  const countLines = (text: string): number => {
    if (!text) return 0;
    return (text.match(/\n/g) || []).length + 1;
  };

  // 비동기 교정 함수
  const correctPendingLines = async (originalText: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correct-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: originalText, correctionType: "spacing-only" }),
      });

      if (!response.ok) throw new Error("교정 실패");

      const { correctedText: newCorrected } = await response.json();
      setCorrectedText((prev) => {
        const lastIndex = prev.lastIndexOf(originalText);
        if (lastIndex !== -1) {
          return prev.substring(0, lastIndex) + newCorrected + prev.substring(lastIndex + originalText.length);
        }
        return prev;
      });
    } catch (error) {
      console.error("교정 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear highlight after the CSS fade completes.
  useEffect(() => {
    if (!autoHighlight) return;
    const t = setTimeout(() => setAutoHighlight(null), 1500);
    return () => clearTimeout(t);
  }, [autoHighlight]);

  // === Orchestra: handle segment updates from A/B slots ===
  const handleOrchestraSegment = useCallback((seg: OrchestraSegment) => {
    if (seg.status === "pending") {
      setPendingFlushes((n) => n + 1);
      return;
    }
    setPendingFlushes((n) => Math.max(0, n - 1));

    // Retry path: if this seq is a retry for a previously failed original,
    // splice in-place in `correctedText` instead of appending.
    const retryTarget = retryingOriginalsRef.current.get(seg.seq);
    if (retryTarget) {
      retryingOriginalsRef.current.delete(seg.seq);
      if (seg.status === "done" && seg.corrected) {
        setCorrectedText((prev) => {
          const idx = prev.lastIndexOf(retryTarget);
          if (idx === -1) return prev + "\n" + seg.corrected;
          const next = prev.substring(0, idx) + seg.corrected + prev.substring(idx + retryTarget.length);
          setAutoHighlight({ start: idx, end: idx + seg.corrected!.length, key: Date.now() });
          return next;
        });
      } else {
        // Retry failed again — re-add to failed list.
        setFailedSegments((prev) => [...prev, { seq: seg.seq, original: seg.original }]);
        toast.error("재교정에 실패했습니다");
      }
      return;
    }

    // Normal append path.
    if (seg.status === "done" && seg.corrected) {
      setCorrectedText((prev) => {
        const next = prev ? prev + "\n" + seg.corrected : seg.corrected!;
        const start = prev ? prev.length + 1 : 0;
        setAutoHighlight({ start, end: next.length, key: Date.now() });
        return next;
      });
    } else if (seg.status === "failed") {
      setCorrectedText((prev) => (prev ? prev + "\n" + seg.original : seg.original));
      setFailedSegments((prev) => [...prev, { seq: seg.seq, original: seg.original }]);
      toast.error("AI 교정에 실패했습니다. 원문이 삽입되었습니다");
    }
  }, []);

  const orchestra = useTypingOrchestra({ onSegmentUpdate: handleOrchestraSegment });

  // Flush the active composition buffer through the orchestra.
  const flushActiveBuffer = useCallback(() => {
    setCurrentLineText((buf) => {
      const trimmed = buf.trim();
      if (!trimmed) return buf;
      orchestra.flush(buf);
      return "";
    });
  }, [orchestra]);

  const retryFailedSegment = useCallback(
    (seg: FailedSegment) => {
      setFailedSegments((prev) => prev.filter((f) => f.seq !== seg.seq));
      const newSeq = orchestra.retry(seg.original);
      if (newSeq !== null) {
        retryingOriginalsRef.current.set(newSeq, seg.original);
      }
    },
    [orchestra],
  );

  const dismissFailedSegment = useCallback((seq: number) => {
    setFailedSegments((prev) => prev.filter((f) => f.seq !== seq));
  }, []);

  // Idle-based flush (Path 1α: 200+ chars & 1s pause).
  const idleFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (idleFlushTimerRef.current) {
      clearTimeout(idleFlushTimerRef.current);
      idleFlushTimerRef.current = null;
    }
    if (currentLineText.length < FLUSH_CHAR_MIN) return;
    idleFlushTimerRef.current = setTimeout(() => {
      flushActiveBuffer();
    }, FLUSH_IDLE_MS);
    return () => {
      if (idleFlushTimerRef.current) clearTimeout(idleFlushTimerRef.current);
    };
  }, [currentLineText, flushActiveBuffer]);

  // 전체 텍스트 교정
  const correctFullText = async () => {
    const fullText = getFullText();
    if (!fullText.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correct-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: fullText, correctionType: "full" }),
      });

      if (!response.ok) throw new Error("교정 실패");

      const { correctedText: newCorrected } = await response.json();
      setCorrectedText(newCorrected);
      setCurrentLineText("");
      toast.success("교정 완료");
    } catch (error) {
      toast.error("교정에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  // DB 저장 (수정 vs 생성 로직 분기) — draft는 성공 응답 확인 후에만 삭제
  const saveNote = async () => {
    const fullText = getFullText();
    if (!fullText.trim()) return toast.error("내용을 입력해주세요");
    if (!title.trim()) return toast.error("제목을 입력해주세요");

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return toast.error("로그인이 필요합니다");

      const payload = {
        title: title.trim(),
        content: fullText.trim(),
        note_date: noteDate,
        category: category || null,
        is_public: isPublic,
      };

      if (isEditMode && editingId) {
        const { error } = await supabase.from("notes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("노트가 수정되었습니다");
        setSaveDialogOpen(false);
        await draft.clear();
        navigate(`/notes/${editingId}`);
      } else {
        const { error } = await supabase.from("notes").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("새 노트가 저장되었습니다");
        setSaveDialogOpen(false);
        await draft.clear();
        navigate("/notes");
      }
    } catch (error) {
      toast.error("저장에 실패했습니다 — 임시저장은 유지됩니다");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // 특수문자 삽입 핸들러
  const insertTextAtCursor = (insertText: string, cursorOffset: number) => {
    const textarea = activeBoxRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newCurrentLine =
      currentLineText.substring(0, start) + insertText + currentLineText.substring(end);
    setCurrentLineText(newCurrentLine);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset + 4);
    }, 0);
  };

  const insertMyungjo = () => {
    setIsMyungjoMode(true);
    insertTextAtCursor("[명]내용입력[/명]", 3);
  };
  const insertQuote = (quoteType: "'" | '"') => {
    setIsInsideQuote(quoteType);
    insertTextAtCursor(`${quoteType}내용입력${quoteType}`, 1);
  };
  const insertBracket = (openBracket: string, closeBracket: string) => {
    insertTextAtCursor(`${openBracket}내용입력${closeBracket}`, openBracket.length);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && isInsideQuote) {
      e.preventDefault();
      const textarea = activeBoxRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textAfterCursor = currentLineText.substring(cursorPos);
      const closingQuoteIndex = textAfterCursor.indexOf(isInsideQuote);

      if (closingQuoteIndex !== -1) {
        const newCursorPos = cursorPos + closingQuoteIndex + 1;
        setCurrentLineText((prev) => prev.substring(0, newCursorPos) + " " + prev.substring(newCursorPos));
        setIsInsideQuote(null);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos + 1, newCursorPos + 1);
        }, 0);
      } else {
        setIsInsideQuote(null);
      }
      return;
    }

    if (e.key === "Enter" && !isInsideQuote) {
      e.preventDefault();
      if (isMyungjoMode) setIsMyungjoMode(false);

      // 엔터 직전 마지막 단어가 단축어면 펼친 뒤 커밋
      const expanded = expandLastWord(currentLineText, shortcutMap);
      if (expanded.trim()) {
        // Enter → immediate flush to orchestra regardless of length.
        orchestra.flush(expanded);
      }
      setCurrentLineText("");
      requestAnimationFrame(() => activeBoxRef.current?.focus());
    }
  };

  // Active-box onChange: only manages the composition buffer.
  // Also implements Path-1 punctuation-terminal trigger when buffer ≥ 200 chars.
  const handleActiveChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    // Strip any accidental newlines (Enter is handled explicitly for flush).
    const noNewline = raw.replace(/\n/g, "");
    const expanded = expandTrailingTrigger(noNewline, shortcutMap);
    setCurrentLineText(expanded);

    if (expanded.length >= FLUSH_CHAR_MIN && SENTENCE_TERMINALS.test(expanded)) {
      // Defer to next tick so React commits the state clear cleanly.
      setTimeout(() => flushActiveBuffer(), 0);
    }
  };

  // Free-edit top area: user can revise finalized/corrected text at any time.
  const handleCorrectedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCorrectedText(e.target.value);
  };

  const fullText = getFullText();
  const totalLines = countLines(fullText);

  const textareaFontClasses = `${fontSizeMap[settings.fontSize]} ${fontWeightMap[settings.fontWeight]} ${fontFamilyMap[settings.fontFamily]}`;
  const textareaBaseClasses = `w-full p-2 resize-none border-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed ${textareaFontClasses}`;

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewNote} className="gap-1">
            <Plus className="h-4 w-4" />
            새노트
          </Button>
        </div>

        <h1 className="text-lg font-medium">{isEditMode ? "노트 수정" : "AI 교정노트"}</h1>

        <div className="flex items-center gap-1">
          <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="YouTube 영상 띄우기">
                <Youtube className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>YouTube 영상</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  autoFocus
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyYoutube();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  watch / youtu.be / shorts / embed 링크 모두 지원합니다.
                </p>
              </div>
              <DialogFooter>
                {youtubeId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleCloseYoutube();
                      setYoutubeDialogOpen(false);
                    }}
                  >
                    영상 제거
                  </Button>
                )}
                <Button onClick={handleApplyYoutube}>재생</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioFileSelect}
          />
          <Button
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            title={isRecording ? "녹음 중지 (자동 변환 후 삽입)" : "실시간 녹음 시작"}
            onClick={toggleMicRecording}
            disabled={isTranscribingMic}
          >
            {isTranscribingMic ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant={liveOpen ? "default" : "ghost"}
            size="icon"
            title="라이브 받아쓰기 (A/B 교차 + C 교정)"
            onClick={() => setLiveOpen((v) => !v)}
          >
            <Radio className={`h-5 w-5 ${live.isLive ? "text-destructive animate-pulse" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="음성 파일 업로드"
            onClick={handleAudioUploadClick}
            disabled={isTranscribingAudio}
          >
            {isTranscribingAudio ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </Button>

          <ShortcutsDialog />
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>노트 설정</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* 폰트 설정 영역 */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">폰트 크기</Label>
                  <RadioGroup
                    value={settings.fontSize}
                    onValueChange={(value) =>
                      updateSettings({ ...settings, fontSize: value as NoteSettings["fontSize"] })
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="small" id="size-small" />
                      <Label htmlFor="size-small" className="cursor-pointer text-sm">
                        작음
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal" id="size-normal" />
                      <Label htmlFor="size-normal" className="cursor-pointer">
                        보통
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="large" id="size-large" />
                      <Label htmlFor="size-large" className="cursor-pointer text-lg">
                        큼
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="xlarge" id="size-xlarge" />
                      <Label htmlFor="size-xlarge" className="cursor-pointer text-xl">
                        매우 큼
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">폰트 굵기</Label>
                  <RadioGroup
                    value={settings.fontWeight}
                    onValueChange={(value) =>
                      updateSettings({ ...settings, fontWeight: value as NoteSettings["fontWeight"] })
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal" id="weight-normal" />
                      <Label htmlFor="weight-normal" className="cursor-pointer font-normal">
                        보통
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="semibold" id="weight-semibold" />
                      <Label htmlFor="weight-semibold" className="cursor-pointer font-semibold">
                        굵게
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bold" id="weight-bold" />
                      <Label htmlFor="weight-bold" className="cursor-pointer font-bold">
                        매우 굵게
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">폰트 종류</Label>
                  <RadioGroup
                    value={settings.fontFamily}
                    onValueChange={(value) =>
                      updateSettings({ ...settings, fontFamily: value as NoteSettings["fontFamily"] })
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gothic" id="font-gothic" />
                      <Label htmlFor="font-gothic" className="cursor-pointer font-gothic">
                        고딕
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="serif" id="font-serif" />
                      <Label htmlFor="font-serif" className="cursor-pointer font-serif">
                        명조
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="default" id="font-default" />
                      <Label htmlFor="font-default" className="cursor-pointer">
                        기본폰트
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 로그아웃 */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> 로그아웃
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>사용 방법</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>• 엔터를 눌러 다음 줄로 넘어가면 위쪽 줄이 자동 교정됩니다.</p>
                <p>• 현재 작성 중인 줄은 교정 대기 상태입니다.</p>
                <p>• "전체 교정하기" 버튼을 누르면 전체가 맞춤법, 문법, 띄어쓰기 교정됩니다.</p>
                <p>• 작성 내용은 자동으로 임시 저장됩니다.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 min-h-0 flex flex-col p-4 pb-36 md:pb-32 gap-3 relative">
        <div
          className={`flex items-center justify-between text-xs px-3 py-2.5 rounded-lg transition-colors ${
            pendingFlushes > 0
              ? "bg-primary/10 text-primary"
              : currentLineText === "" && correctedText !== ""
                ? "bg-secondary/50 text-muted-foreground" // 이어쓰기 전 대기 상태
                : "bg-green-500/10 text-green-600"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {pendingFlushes > 0 ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI 교정 진행 중 ({pendingFlushes}건)... 계속 작성하세요
              </>
            ) : (
              `엔터 즉시 교정 · 200자 이상 + 1초 정지 또는 문장부호(. , ? !)에서 자동 교정`
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0">
          {liveOpen && (
            <LiveTranscriptPanel
              isLive={live.isLive}
              segments={live.segments}
              elapsedMs={live.elapsedMs}
              onStart={startLive}
              onStop={stopLive}
              onClose={closeLive}
              onSkipFailed={live.retrySegment}
            />
          )}
          {audioFile && (
            <div className="relative w-full md:w-[420px] md:shrink-0 rounded-lg overflow-hidden border border-border bg-background flex flex-col">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate" title={audioFile.name}>
                  {audioFile.name}
                </span>
              </div>
              <div className="p-3 space-y-3">
                {audioObjectUrl && (
                  <audio ref={audioRef} src={audioObjectUrl} controls className="w-full" />
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 h-7 flex-1 min-w-[60px] gap-1"
                    onClick={() => seekBy(-10)}
                    disabled={!audioObjectUrl}
                  >
                    <Rewind className="h-3 w-3" />
                    -10s
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 h-7 flex-1 min-w-[60px] gap-1"
                    onClick={() => seekBy(-5)}
                    disabled={!audioObjectUrl}
                  >
                    <Rewind className="h-3 w-3" />
                    -5s
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 h-7 flex-1 min-w-[60px] gap-1"
                    onClick={() => seekBy(5)}
                    disabled={!audioObjectUrl}
                  >
                    +5s
                    <FastForward className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 h-7 flex-1 min-w-[60px] gap-1"
                    onClick={() => seekBy(10)}
                    disabled={!audioObjectUrl}
                  >
                    +10s
                    <FastForward className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0.4, 0.5, 0.6, 0.7, 1, 1.25, 1.5, 2].map((rate) => (
                    <Button
                      key={rate}
                      variant={audioPlaybackRate === rate ? "default" : "outline"}
                      size="sm"
                      className="text-xs px-2 h-7 flex-1 min-w-[52px]"
                      onClick={() => setAudioPlaybackRate(rate)}
                    >
                      {rate}x
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-3 pt-0 min-h-[120px]">
                {isTranscribingAudio ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground h-full">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>음성 변환 중...</span>
                  </div>
                ) : audioTranscript.startsWith("변환 실패:") ? (
                  <div className="h-full flex flex-col gap-2">
                    <p className="text-xs text-destructive">변환 실패</p>
                    <div className="flex-1 overflow-y-auto text-sm whitespace-pre-wrap break-words rounded-md bg-destructive/10 text-destructive p-2">
                      {audioTranscript}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryTranscription}
                      className="gap-1 self-start"
                    >
                      <RefreshCw className="h-3 w-3" />
                      다시 시도
                    </Button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">변환된 텍스트</p>
                    <div className="flex-1 overflow-y-auto text-sm whitespace-pre-wrap break-words rounded-md bg-secondary/50 p-2">
                      {audioTranscript || "변환된 텍스트가 비어있습니다"}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 pt-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handlePasteAudioTranscript}
                  disabled={!audioTranscript || audioTranscript.startsWith("변환 실패:")}
                >
                  노트에 붙여넣기
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleCloseAudio}
                  className="shrink-0"
                  title="음성 닫기"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {youtubeId && !audioFile && (
            <div className="relative w-full md:w-[420px] md:shrink-0 rounded-lg overflow-hidden border border-border bg-black">
              <div className="aspect-video w-full">
                <iframe
                  key={youtubeId}
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title="YouTube video player"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleCloseYoutube}
                className="absolute top-1.5 right-1.5 h-7 w-7 opacity-80 hover:opacity-100"
                title="영상 닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {/* Corrected stream + always-visible active composition box */}
          <div className="relative flex-1 flex flex-col min-w-0 min-h-0 gap-3">
            <div className="flex-1 flex flex-col gap-2 min-h-0 rounded-lg border border-border/60 bg-background/60">
              {/* Upper: corrected stream (freely editable, fills available height) */}
              <div className="relative flex-1 min-h-0 p-1">
                {autoHighlight && correctedText && (
                  <div
                    aria-hidden
                    className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-transparent ${textareaBaseClasses}`}
                    style={{ overflow: "hidden" }}
                  >
                    {correctedText.substring(0, autoHighlight.start)}
                    <span key={autoHighlight.key} className="fade-highlight">
                      {correctedText.substring(autoHighlight.start, autoHighlight.end)}
                    </span>
                    {correctedText.substring(autoHighlight.end)}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={correctedText}
                  onChange={handleCorrectedChange}
                  placeholder="교정된 내용이 위에 정리됩니다. 여기서 자유롭게 수정할 수 있어요."
                  className={`${textareaBaseClasses} relative w-full h-full resize-none overflow-y-auto pb-8`}
                />
              </div>

              {/* Failed-flush banner */}
              {failedSegments.length > 0 && (
                <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-2 space-y-1.5 mx-1 mb-1">
                  <p className="text-xs text-destructive font-medium">
                    AI 교정 실패 ({failedSegments.length}건) — 원문이 상단에 삽입되었습니다
                  </p>
                  {failedSegments.map((seg) => (
                    <div
                      key={seg.seq}
                      className="flex items-center gap-2 text-xs bg-background/60 rounded p-1.5"
                    >
                      <span className="flex-1 truncate text-muted-foreground" title={seg.original}>
                        {seg.original.length > 60 ? seg.original.slice(0, 60) + "…" : seg.original}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => retryFailedSegment(seg)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        재교정
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => dismissFailedSegment(seg.seq)}
                        title="닫기"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Active composition box is outside the scroll area so it never disappears. */}
            <div className="shrink-0 z-20 rounded-lg border-2 border-primary bg-primary/10 shadow-lg ring-1 ring-primary/20 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  작성 중 · {currentLineText.length}자
                  {currentLineText.length >= FLUSH_CHAR_MIN && (
                    <span className="ml-1">· 곧 교정</span>
                  )}
                </span>
                {currentLineText.trim() && (
                  <button
                    type="button"
                    onClick={flushActiveBuffer}
                    className="shrink-0 text-[10px] font-medium text-primary hover:underline"
                  >
                    지금 교정
                  </button>
                )}
              </div>
              <textarea
                ref={activeBoxRef}
                value={currentLineText}
                onChange={handleActiveChange}
                onKeyDown={handleKeyDown}
                placeholder="여기에 이어서 작성하세요. 엔터로 넘기거나 문장 완성 시 자동 교정됩니다."
                className={`${textareaBaseClasses} min-h-[92px] max-h-[24vh] overflow-y-auto placeholder:text-primary/55`}
                autoFocus
              />
            </div>
          </div>
        </div>
      </div>


      {/* Bottom Toolbars */}
      <div className="fixed bottom-16 left-4 flex items-center gap-1.5 flex-wrap max-w-[70%] bg-background/80 backdrop-blur-sm p-1 rounded-lg">
        <Button variant="outline" size="sm" onClick={() => insertQuote("'")} className="h-8 px-2.5 font-mono text-sm">
          {"' '"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => insertQuote('"')} className="h-8 px-2.5 font-mono text-sm">
          {'" "'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => insertBracket("(", ")")}
          className="h-8 px-2.5 font-mono text-sm"
        >
          ( )
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => insertBracket("<", ">")}
          className="h-8 px-2.5 font-mono text-sm"
        >
          {"< >"}
        </Button>
        <Button
          variant={isMyungjoMode ? "default" : "outline"}
          size="sm"
          onClick={insertMyungjo}
          className="h-8 px-2.5 font-serif text-sm"
        >
          명
        </Button>
        <span className="text-xs text-muted-foreground ml-2 font-medium">
          {totalLines}줄 | {fullText.length}자
        </span>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={fullText.trim().length === 0}
              className="shadow-lg rounded-full px-6 bg-background"
            >
              <Save className="h-4 w-4 mr-2" /> 저장
            </Button>
          </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? "노트 수정 저장" : "새 노트 저장"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>제목</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="노트 제목을 입력하세요" />
              </div>
              <div className="space-y-2">
                <Label>날짜</Label>
                <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={category || "none"} onValueChange={(val) => setCategory(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음</SelectItem>
                    {interests.map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {interest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label className="cursor-pointer">{isPublic ? "공개" : "비공개"}</Label>
                    <p className="text-xs text-muted-foreground">
                      {isPublic ? "다른 사용자들이 볼 수 있습니다" : "나만 볼 수 있습니다"}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">취소</Button>
              </DialogClose>
              <Button onClick={saveNote} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 저장 중...
                  </>
                ) : (
                  "저장하기"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          onClick={correctFullText}
          disabled={isLoading || fullText.trim().length === 0}
          className="shadow-lg rounded-full px-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 교정 중...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" /> 전체 교정하기
            </>
          )}
        </Button>
      </div>

      {/* Exit Dialogs */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중인 내용이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              페이지를 나가시면 저장되지 않은 내용이 삭제됩니다. (임시저장 기능으로 나중에 복원 가능합니다)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 작성</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNewNoteDialog} onOpenChange={setShowNewNoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>새 노트 만들기</AlertDialogTitle>
            <AlertDialogDescription>현재 작업 중인 내용을 어떻게 하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardAndNew}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              저장 안하고 새로 만들기
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndNew}>저장 후 새로 만들기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AiNote;
