import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, ShieldAlert, AlertCircle, ArrowLeft, Languages, FileText, Check, X, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { api } from '../../lib/api';
import { usePresenceMap, formatLastSeen } from '../../lib/presence';
import { SafeUser, Conversation, Message } from '../../types';

interface MessagesViewProps {
  currentUser: SafeUser;
  onOpenProfile: (username: string) => void;
  targetUsername?: string | null;
  onClearTargetUsername?: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  onOpenProfile,
  targetUsername,
  onClearTargetUsername,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  // Real-time presence map subscription
  const presenceMap = usePresenceMap();

  // Mobile navigation state: 'list' or 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // AI Assist State
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);
  const [aiAction, setAiAction] = useState<'rewrite' | 'shorten' | 'translate' | 'draft_reply'>('rewrite');
  const [aiTone, setAiTone] = useState('polite and clear');
  const [aiTargetLang, setAiTargetLang] = useState('Spanish');
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [targetUsername]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConv]);

  const loadConversations = async () => {
    setIsLoadingConvs(true);
    try {
      if (targetUsername) {
        // Automatically start or locate conversation with targetUsername
        const convRes = await api.startConversation(targetUsername);
        const listRes = await api.getConversations();
        setConversations(listRes.conversations);

        const found = listRes.conversations.find((c) => c.id === convRes.conversation.id);
        if (found) {
          selectConversation(found);
        } else {
          const newEntry = { ...convRes.conversation, otherParticipant: convRes.targetUser };
          setConversations([newEntry, ...listRes.conversations]);
          selectConversation(newEntry);
        }
        if (onClearTargetUsername) onClearTargetUsername();
      } else {
        const res = await api.getConversations();
        setConversations(res.conversations);
        if (res.conversations.length > 0 && !activeConv && window.innerWidth >= 640) {
          selectConversation(res.conversations[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConvs(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMobileView('chat');
    setIsLoadingMsgs(true);
    try {
      const res = await api.getMessages(conv.id);
      setMessages(res.messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingMsgs(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConv || isSending) return;

    setIsSending(true);
    try {
      const res = await api.sendMessage(activeConv.id, messageInput.trim());
      setMessages((prev) => [...prev, res.message]);
      setMessageInput('');
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRunAiAssist = async () => {
    if (!messageInput.trim() || aiIsLoading) return;

    setAiIsLoading(true);
    setAiSuggestion(null);
    try {
      const res = await api.messageAssist({
        action: aiAction,
        text: messageInput.trim(),
        tone: aiTone,
        targetLanguage: aiTargetLang,
      });
      setAiSuggestion(res.suggestion);
    } catch (err: any) {
      console.error('AI assist failed:', err);
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (aiSuggestion) {
      setMessageInput(aiSuggestion);
      setAiSuggestion(null);
      setAiAssistOpen(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 px-3 sm:px-6 h-[calc(100vh-125px)] md:h-[calc(100vh-80px)] min-h-[500px] flex flex-col">
      {/* Prominent Security Status Header (Truthful disclosure) */}
      <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-amber-900 min-w-0">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">
            <strong className="font-semibold">Security Notice:</strong> Prototype messaging (Transport TLS encrypted; not End-to-End Encrypted).
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSecurityModalOpen(true)}
          className="text-xs font-bold text-amber-700 hover:text-amber-900 underline shrink-0 cursor-pointer"
        >
          Details
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex min-h-0">
        {/* CONVERSATION LIST (Desktop: always visible left pane; Mobile: visible when mobileView === 'list') */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden sm:flex' : 'flex'
          } w-full sm:w-80 border-r border-slate-200/80 flex-col bg-slate-50/50 shrink-0 min-h-0`}
        >
          <div className="p-4 border-b border-slate-200/60 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 font-display">Conversations</h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {conversations.length}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Direct Messages</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
            {isLoadingConvs ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading inbox...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700">No conversations yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Find community members in the Explore tab and start a private conversation.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConv?.id === conv.id;
                const otherUserId = conv.otherParticipant.id;
                const pInfo = presenceMap[otherUserId];
                const isOnline = pInfo ? pInfo.isOnline : Boolean(conv.otherParticipant.isOnline);
                const lastSeen = pInfo?.lastSeen || conv.otherParticipant.lastSeen;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2D5AFF]/10 border-l-4 border-[#2D5AFF]'
                        : 'hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-200">
                        {conv.otherParticipant.avatarUrl ? (
                          <img
                            src={conv.otherParticipant.avatarUrl}
                            alt={conv.otherParticipant.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                            {conv.otherParticipant.displayName.charAt(0)}
                          </div>
                        )}
                      </div>
                      {/* Real-time online/offline indicator dot */}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-2xs ${
                          isOnline
                            ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-slate-300'
                        }`}
                        title={isOnline ? 'Online now' : formatLastSeen(lastSeen)}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {conv.otherParticipant.displayName}
                          </span>
                          {isOnline && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                          @{conv.otherParticipant.username}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-slate-500 truncate">
                          {conv.lastMessage?.content || 'No messages yet'}
                        </p>
                        {isOnline ? (
                          <span className="text-[10px] font-bold text-emerald-600 shrink-0">online</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">{formatLastSeen(lastSeen)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ACTIVE CONVERSATION PANE (Desktop: visible right pane; Mobile: visible when mobileView === 'chat') */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden sm:flex' : 'flex'
          } flex-1 flex-col bg-white min-h-0`}
        >
          {activeConv ? (
            (() => {
              const activeUserId = activeConv.otherParticipant.id;
              const activePInfo = presenceMap[activeUserId];
              const isActiveOnline = activePInfo ? activePInfo.isOnline : Boolean(activeConv.otherParticipant.isOnline);
              const activeLastSeen = activePInfo?.lastSeen || activeConv.otherParticipant.lastSeen;

              return (
                <>
                  {/* Thread Header with Mobile Back Button */}
                  <div className="p-3.5 px-4 sm:px-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Mobile Back Button to list */}
                      <button
                        type="button"
                        onClick={() => setMobileView('list')}
                        className="sm:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(activeConv.otherParticipant.username)}
                          className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden border border-slate-200 cursor-pointer block"
                        >
                          {activeConv.otherParticipant.avatarUrl ? (
                            <img
                              src={activeConv.otherParticipant.avatarUrl}
                              alt={activeConv.otherParticipant.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                              {activeConv.otherParticipant.displayName.charAt(0)}
                            </div>
                          )}
                        </button>
                        {/* Real-time status dot on active chat header avatar */}
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs ${
                            isActiveOnline
                              ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                              : 'bg-slate-300'
                          }`}
                          title={isActiveOnline ? 'Online now' : formatLastSeen(activeLastSeen)}
                        />
                      </div>

                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(activeConv.otherParticipant.username)}
                          className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate hover:text-[#2D5AFF] transition-colors cursor-pointer text-left"
                        >
                          {activeConv.otherParticipant.displayName}
                        </button>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-mono truncate">
                            @{activeConv.otherParticipant.username}
                          </span>
                          <span className="text-slate-300 text-xs">•</span>
                          {isActiveOnline ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              {formatLastSeen(activeLastSeen)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                {/* AI Assist Launcher Button in Header */}
                <button
                  type="button"
                  onClick={() => setAiAssistOpen(!aiAssistOpen)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aiAssistOpen
                      ? 'bg-[#2D5AFF] text-white shadow-xs'
                      : 'bg-[#2D5AFF]/10 text-[#2D5AFF] hover:bg-[#2D5AFF]/20'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">AI Assist</span>
                </button>
              </div>

              {/* Message Bubbles Area */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 min-h-0 bg-slate-50/20">
                {isLoadingMsgs ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading message history...</div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
                      <Send className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Start the conversation</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Send your first private note to @{activeConv.otherParticipant.username}.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === currentUser.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                            isMe
                              ? 'bg-[#2D5AFF] text-white rounded-br-xs'
                              : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-[10px] text-slate-400">
                            {formatMessageTime(m.createdAt)}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-mono text-slate-400 capitalize">
                              · {m.deliveryStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Assist Drawer (Conditional, explicitly user triggered) */}
              {aiAssistOpen && (
                <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 font-display">
                      <Sparkles className="w-4 h-4 text-[#2D5AFF]" />
                      <span>Messaging AI Assist</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiAssistOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {!aiDisclosureAccepted ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed text-[11px]">
                          <strong>Transparent Privacy Disclosure:</strong> Only your explicitly drafted text below will be sent to the Gemini AI API for editing. It will never read other conversation history or automatically send messages.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiDisclosureAccepted(true)}
                        className="px-3 py-1.5 bg-[#2D5AFF] text-white text-xs font-bold rounded-lg hover:bg-[#2448cc] cursor-pointer"
                      >
                        I understand, proceed
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setAiAction('rewrite')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            aiAction === 'rewrite' ? 'bg-[#2D5AFF] text-white' : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          Rewrite
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiAction('shorten')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            aiAction === 'shorten' ? 'bg-[#2D5AFF] text-white' : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          Make Concise
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiAction('draft_reply')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            aiAction === 'draft_reply' ? 'bg-[#2D5AFF] text-white' : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          Draft Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiAction('translate')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            aiAction === 'translate' ? 'bg-[#2D5AFF] text-white' : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          Translate
                        </button>
                      </div>

                      {aiAction === 'translate' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-semibold">Target:</span>
                          <select
                            value={aiTargetLang}
                            onChange={(e) => setAiTargetLang(e.target.value)}
                            className="text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                          >
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Mandarin Chinese">Mandarin</option>
                            <option value="Portuguese">Portuguese</option>
                          </select>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!messageInput.trim() || aiIsLoading}
                          onClick={handleRunAiAssist}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#2D5AFF] text-white hover:bg-[#2448cc] disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                          {aiIsLoading ? 'Generating suggestion...' : 'Process Draft'}
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Operates on your current text draft
                        </span>
                      </div>

                      {aiSuggestion && (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            AI Proposal
                          </span>
                          <p className="text-xs text-slate-800 leading-relaxed font-sans">
                            {aiSuggestion}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleApplyAiSuggestion}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                            >
                              Apply to Draft
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiSuggestion(null)}
                              className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-[#2D5AFF] focus-within:border-transparent transition-all">
                  <textarea
                    rows={1}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={`Message @${activeConv.otherParticipant.username}...`}
                    className="flex-1 p-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none max-h-32"
                  />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAiAssistOpen(true)}
                      title="AI drafting assistant"
                      className="p-2 text-[#2D5AFF] hover:bg-[#2D5AFF]/10 rounded-xl transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={!messageInput.trim() || isSending}
                      className="p-2.5 rounded-xl bg-[#2D5AFF] text-white hover:bg-[#2448cc] disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            </>
          );
        })()
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <User className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 font-display">Select a conversation</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Choose a dialogue from the inbox list or browse member profiles to begin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Security Status Detailed Modal */}
      {securityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 font-extrabold text-base font-display">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>Cove Cryptographic Disclosure</span>
              </div>
              <button
                type="button"
                onClick={() => setSecurityModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Current State:</strong> This is a working prototype. Direct messages are encrypted in transit via standard TLS (HTTPS) and stored on the server.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-medium">
                Cove intentionally refuses to display fake &quot;lock icons&quot; or claim End-to-End Encryption (E2EE) until true client-side cryptographic Double Ratchet / Signal Protocol libraries are compiled, verified, and audited.
              </div>
              <p>
                <strong>Honest Technology Promise:</strong> When you use AI assist, only the draft text you explicitly select is sent to Gemini. It will never silently scan or ingest your inbox.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSecurityModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
