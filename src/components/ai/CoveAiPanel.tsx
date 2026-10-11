import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Globe, MapPin, Send, Trash2, ExternalLink, X, AlertCircle, Mic, MicOff, Loader2, ArrowUpRight, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { AIChatMessage } from '../../types';

interface CoveAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoveAiPanel: React.FC<CoveAiPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I am Cove AI, powered by Google Gemini. You can type questions or speak into your microphone. You can also toggle Google Search or Google Maps grounding on/off anytime using the controls above.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [isSearchEnabled, setIsSearchEnabled] = useState(true);
  const [isMapsEnabled, setIsMapsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Microphone & Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clean up mic on unmount or modal close
  useEffect(() => {
    return () => {
      stopVoiceInput();
    };
  }, []);

  if (!isOpen) return null;

  // --- SPEECH-TO-TEXT IMPLEMENTATION ---
  const startVoiceInput = async () => {
    setMicError(null);

    // 1. Check for native Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // More robust across mobile browsers
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          const text = (finalTranscript + currentInterim).trim();
          if (text) {
            setPrompt(text);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[Voice] SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setMicError('Microphone permission was denied. Please allow microphone access in your browser.');
          } else if (event.error !== 'no-speech') {
            setMicError(`Voice input error: ${event.error}`);
          }
          stopVoiceInput();
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err: any) {
        console.warn('[Voice] Web Speech failed, fallback to MediaRecorder:', err);
      }
    }

    // 2. Fallback using getUserMedia + MediaRecorder + Gemini Server Transcription
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsTranscribing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();

          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            if (base64Data) {
              try {
                const res = await api.transcribeAudio(base64Data, 'audio/webm');
                if (res.text) {
                  setPrompt((prev) => (prev ? `${prev} ${res.text}` : res.text).trim());
                }
              } catch (e: any) {
                setMicError('Could not transcribe audio. Please type your query.');
              } finally {
                setIsTranscribing(false);
              }
            } else {
              setIsTranscribing(false);
            }
          };

          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error('[Voice] MediaRecorder processing error:', err);
          setIsTranscribing(false);
        }

        // Clean up tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.error('[Voice] getUserMedia error:', err);
      if (err.name === 'NotAllowedError') {
        setMicError('Microphone permission was denied. Please allow microphone access in your browser.');
      } else {
        setMicError('Could not start microphone recording. Please type your query.');
      }
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  };

  const handleToggleVoice = () => {
    if (isListening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    if (isListening) {
      stopVoiceInput();
    }

    const userText = prompt.trim();
    setPrompt('');
    setError(null);

    const userMsg: AIChatMessage = {
      id: 'u_' + Date.now(),
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build conversation history (excluding initial greeting)
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await api.chatAi({
        prompt: userText,
        history,
        enableSearch: isSearchEnabled,
        enableMaps: isMapsEnabled,
      });

      const modelMsg: AIChatMessage = {
        id: 'm_' + Date.now(),
        role: 'model',
        text: res.text,
        toolUsed: res.toolUsed,
        sources: res.sources,
        searchQueries: res.searchQueries,
        warning: res.warning,
        isQuotaFallback: res.isQuotaFallback,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      setError(err.message || 'AI service temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: "Chat cleared. What can I help you explore or research today?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200/80">
        {/* Panel Header */}
        <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2D5AFF] to-[#00D1B2] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 font-display">Cove AI</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2D5AFF]/10 text-[#2D5AFF]">
                  Gemini 3.8 Flash
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Grounded Intelligence & Assistant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear conversation"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close panel"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grounding Controls Ribbon */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {/* Google Search Toggle */}
            <button
              type="button"
              onClick={() => setIsSearchEnabled(!isSearchEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isSearchEnabled
                  ? 'bg-[#2D5AFF] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Search Grounding: {isSearchEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Google Maps Toggle */}
            <button
              type="button"
              onClick={() => setIsMapsEnabled(!isMapsEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isMapsEnabled
                  ? 'bg-[#00D1B2] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Maps: {isMapsEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
            Live Citations
          </span>
        </div>

        {/* Chat History View */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/20">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#2D5AFF] text-white rounded-br-xs shadow-2xs'
                      : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Tool used tag */}
                  {m.toolUsed && m.toolUsed !== 'none' && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#2D5AFF]">
                      {m.toolUsed === 'search' ? (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          <span>Grounded by Google Search</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-[#00D1B2]" />
                          <span className="text-[#00D1B2]">Grounded by Google Maps</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Search Queries badge */}
                  {m.searchQueries && m.searchQueries.length > 0 && (
                    <div className="mt-2 text-[10px] text-slate-400 space-y-1">
                      <span className="font-semibold block text-slate-500">Searched:</span>
                      <div className="flex flex-wrap gap-1">
                        {m.searchQueries.map((q, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounding Source Citations */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Verified Web Sources ({m.sources.length})
                      </span>
                      <div className="space-y-1">
                        {m.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs transition-colors group"
                          >
                            <span className="truncate pr-2 font-medium">
                              {s.title || s.uri}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#2D5AFF] shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning Notice (e.g. Quota fallback or grounding rate notice) */}
                  {m.warning && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1.5">
                        <p className="font-medium text-[11px] leading-tight">{m.warning}</p>
                        {m.isQuotaFallback && isSearchEnabled && (
                          <button
                            type="button"
                            onClick={() => setIsSearchEnabled(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2D5AFF] hover:underline cursor-pointer"
                          >
                            <Globe className="w-3 h-3" />
                            Turn Search Grounding OFF for next query
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-white border border-slate-200/80 rounded-2xl w-fit shadow-2xs">
              <span className="w-4 h-4 border-2 border-slate-300 border-t-[#2D5AFF] rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Cove AI is researching...</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-rose-200/70">
                {isSearchEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchEnabled(false);
                      setError(null);
                    }}
                    className="px-2.5 py-1 bg-white border border-rose-300 text-rose-900 rounded-lg text-[11px] font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Toggle Search OFF & Dismiss
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {micError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{micError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="text-amber-800 hover:text-amber-950 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Voice Recording Active Banner */}
        {isListening && (
          <div className="px-5 py-2.5 bg-rose-50 border-t border-rose-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
              <span>Listening... Speak into your microphone</span>
            </div>
            <button
              type="button"
              onClick={stopVoiceInput}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
            >
              Done Speaking
            </button>
          </div>
        )}

        {isTranscribing && (
          <div className="px-5 py-2 bg-slate-100 border-t border-slate-200 flex items-center gap-2 text-slate-600 text-xs shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D5AFF]" />
            <span>Transcribing speech with Gemini...</span>
          </div>
        )}

        {/* Input Composer */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-[#2D5AFF] focus-within:border-transparent transition-all">
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isListening ? 'Stop listening' : 'Speak your query'}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-500 hover:text-[#2D5AFF] hover:bg-slate-200/60'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask anything, or use voice...'}
              className="flex-1 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="p-2.5 rounded-xl bg-[#2D5AFF] text-white hover:bg-[#2448cc] disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
