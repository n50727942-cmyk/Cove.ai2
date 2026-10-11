import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import { testFirestoreConnection } from './lib/firebase';
import { presenceManager } from './lib/presence';
import { SafeUser } from './types';
import { LoginView } from './components/auth/LoginView';
import { RegisterView } from './components/auth/RegisterView';
import { RecoveryModal } from './components/auth/RecoveryModal';
import { RecoveryPhraseDisplayModal } from './components/auth/RecoveryPhraseDisplayModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { FeedView } from './components/feed/FeedView';
import { ExploreView } from './components/explore/ExploreView';
import { MessagesView } from './components/messages/MessagesView';
import { ProfileView } from './components/profile/ProfileView';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { CoveAiPanel } from './components/ai/CoveAiPanel';
import { Home, Compass, MessageSquare, User, Sparkles, LogOut } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [pendingRecoveryPhrase, setPendingRecoveryPhrase] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Authenticated navigation & modals
  const [currentTab, setCurrentTab] = useState<'feed' | 'explore' | 'messages' | 'profile'>('feed');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [viewingProfileUsername, setViewingProfileUsername] = useState<string | null>(null);
  const [targetChatUsername, setTargetChatUsername] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection();
    checkCurrentSession();
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (currentUser && token) {
      presenceManager.init(token);
    } else {
      presenceManager.disconnect();
    }
    return () => {
      presenceManager.disconnect();
    };
  }, [currentUser]);

  const checkCurrentSession = async () => {
    setIsCheckingAuth(true);
    try {
      const res = await api.me();
      setCurrentUser(res.user);
      if (!res.user.hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (user: SafeUser) => {
    setCurrentUser(user);
    if (!user.hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  };

  const handleRegisterSuccess = (user: SafeUser, recoveryPhrase: string) => {
    setCurrentUser(user);
    setPendingRecoveryPhrase(recoveryPhrase);
  };

  const handleConfirmRecoveryPhrase = () => {
    setPendingRecoveryPhrase(null);
    setShowOnboarding(true);
  };

  const handleFinishOnboarding = (updatedUser: SafeUser) => {
    setCurrentUser(updatedUser);
    setShowOnboarding(false);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setAuthView('login');
  };

  const handleOpenUserProfile = (username: string) => {
    setViewingProfileUsername(username);
  };

  const handleStartChatWithUser = (username: string) => {
    setTargetChatUsername(username);
    setCurrentTab('messages');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#2D5AFF] text-white flex items-center justify-center shadow-md animate-pulse">
            <span className="font-display text-xl font-bold">C</span>
          </div>
          <span className="text-xs font-semibold text-slate-400">Loading Cove...</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // UNAUTHENTICATED EXPERIENCE (FIRST-OPEN SCREEN)
  // ==========================================
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {authView === 'login' ? (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setAuthView('register')}
            onOpenRecovery={() => setIsRecoveryOpen(true)}
          />
        ) : (
          <RegisterView
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateLogin={() => setAuthView('login')}
          />
        )}

        <RecoveryModal
          isOpen={isRecoveryOpen}
          onClose={() => setIsRecoveryOpen(false)}
          onRecoverySuccess={handleLoginSuccess}
        />

        {pendingRecoveryPhrase && (
          <RecoveryPhraseDisplayModal
            recoveryPhrase={pendingRecoveryPhrase}
            onConfirm={handleConfirmRecoveryPhrase}
          />
        )}
      </main>
    );
  }

  // ==========================================
  // AUTHENTICATED EXPERIENCE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* 16-word Master Phrase display for fresh registrations */}
      {pendingRecoveryPhrase && (
        <RecoveryPhraseDisplayModal
          recoveryPhrase={pendingRecoveryPhrase}
          onConfirm={handleConfirmRecoveryPhrase}
        />
      )}

      {/* Skippable Onboarding Modal for first-time users */}
      {showOnboarding && (
        <OnboardingModal
          currentUser={currentUser}
          onFinish={handleFinishOnboarding}
        />
      )}

      {/* Cove AI Assistant Panel with Grounding */}
      <CoveAiPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />

      {/* User Profile Inspection Modal */}
      {viewingProfileUsername && (
        <UserProfileModal
          username={viewingProfileUsername}
          currentUserId={currentUser.id}
          onClose={() => setViewingProfileUsername(null)}
          onStartChat={handleStartChatWithUser}
        />
      )}

      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 p-5 sticky top-0 h-screen shrink-0">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#2D5AFF] text-white flex items-center justify-center shadow-md shadow-[#2D5AFF]/20">
            <span className="font-display text-xl font-extrabold">C</span>
          </div>
          <div>
            <span className="font-display text-xl font-extrabold text-slate-900 tracking-tight block">
              Cove
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Public & Private Spaces
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1">
          <button
            type="button"
            onClick={() => setCurrentTab('feed')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'feed'
                ? 'bg-[#2D5AFF] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home Feed</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('explore')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'explore'
                ? 'bg-[#2D5AFF] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Explore</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('messages')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'messages'
                ? 'bg-[#2D5AFF] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Messages</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#2D5AFF] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Settings</span>
          </button>

          {/* Cove AI Button in Nav */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setIsAiOpen(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[#2D5AFF]/10 via-[#00D1B2]/10 to-[#FF7A5C]/10 border border-[#2D5AFF]/20 text-[#2D5AFF] font-bold text-xs hover:border-[#2D5AFF]/40 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2D5AFF]" />
                <span>Open Cove AI</span>
              </div>
              <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                Grounding
              </span>
            </button>
          </div>
        </nav>

        {/* User Card at Bottom of Sidebar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className="flex items-center gap-2.5 text-left truncate flex-1 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                  {currentUser.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="truncate min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {currentUser.displayName}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block truncate">
                @{currentUser.username}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2D5AFF] text-white flex items-center justify-center shadow-xs">
            <span className="font-display text-sm font-extrabold">C</span>
          </div>
          <span className="font-display text-base font-extrabold text-slate-900">Cove</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2D5AFF]/10 text-[#2D5AFF] text-xs font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden border border-slate-200 cursor-pointer"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                {currentUser.displayName.charAt(0)}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* MAIN VIEW CONTENT */}
      <main className="flex-1 pb-20 md:pb-6 overflow-y-auto">
        {currentTab === 'feed' && (
          <FeedView
            currentUser={currentUser}
            onOpenProfile={handleOpenUserProfile}
            onOpenAi={() => setIsAiOpen(true)}
          />
        )}
        {currentTab === 'explore' && (
          <ExploreView
            currentUser={currentUser}
            onOpenProfile={handleOpenUserProfile}
            onStartChat={handleStartChatWithUser}
          />
        )}
        {currentTab === 'messages' && (
          <MessagesView
            currentUser={currentUser}
            onOpenProfile={handleOpenUserProfile}
            targetUsername={targetChatUsername}
            onClearTargetUsername={() => setTargetChatUsername(null)}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onLogout={handleLogout}
            onUserUpdated={(updated) => setCurrentUser(updated)}
          />
        )}
      </main>

      {/* MOBILE BOTTOM DOCK (NAVIGATION ANCHOR) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setCurrentTab('feed')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            currentTab === 'feed' ? 'text-[#2D5AFF]' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('explore')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            currentTab === 'explore' ? 'text-[#2D5AFF]' : 'text-slate-500'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>Explore</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('messages')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            currentTab === 'messages' ? 'text-[#2D5AFF]' : 'text-slate-500'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span>Messages</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            currentTab === 'profile' ? 'text-[#2D5AFF]' : 'text-slate-500'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
