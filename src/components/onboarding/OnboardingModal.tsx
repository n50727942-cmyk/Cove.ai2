import React, { useState } from 'react';
import { Sparkles, Shield, User, ArrowRight, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser } from '../../types';

interface OnboardingModalProps {
  currentUser: SafeUser;
  onFinish: (updatedUser: SafeUser) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  currentUser,
  onFinish,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatarUrl || '');
  const [isPrivate, setIsPrivate] = useState(currentUser.isPrivate);
  const [isSaving, setIsSaving] = useState(false);

  const avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  ];

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const res = await api.completeOnboarding({
        bio: bio.trim(),
        avatarUrl: selectedAvatar,
        isPrivate,
      });
      onFinish(res.user);
    } catch {
      // Fallback
      onFinish({
        ...currentUser,
        bio: bio.trim(),
        avatarUrl: selectedAvatar,
        isPrivate,
        hasCompletedOnboarding: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header with step indicator and skip */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#2D5AFF] bg-[#2D5AFF]/10 px-2.5 py-1 rounded-md">
              Step {step} of 3
            </span>
            <span className="text-xs text-slate-500 font-medium">Getting Started</span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Skip for now
          </button>
        </div>

        {/* STEP 1: Welcome & Mission */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#2D5AFF] text-white flex items-center justify-center shadow-md shadow-[#2D5AFF]/20">
              <span className="font-display text-xl font-bold">C</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                Welcome to Cove, {currentUser.displayName}!
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cove is designed around a singular principle:
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-bold text-slate-900 block mb-1">
                  1. Public for Discovery
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Share thoughts, discoveries, and creative updates with followers or the wider world on the public feed.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-bold text-slate-900 block mb-1">
                  2. Private for Conversations
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Direct messages remain isolated from algorithms and public indexing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-11 mt-4 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Profile Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Profile Customization */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                Set up your profile
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Choose an avatar and write a short bio. You can change these anytime in Settings.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Choose an Avatar
              </label>
              <div className="flex items-center gap-3">
                {avatarOptions.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedAvatar === url
                        ? 'border-[#2D5AFF] ring-2 ring-[#2D5AFF]/30 scale-105'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Avatar option ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedAvatar === url && (
                      <div className="absolute inset-0 bg-[#2D5AFF]/30 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="bio"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Short Bio (Optional)
              </label>
              <textarea
                id="bio"
                rows={3}
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What interests you? Photography, open source, architecture, design..."
                className="w-full p-3 text-xs text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] resize-none"
              />
              <span className="text-[11px] text-slate-400 text-right block mt-1">
                {bio.length}/160
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] transition-all cursor-pointer shadow-sm"
              >
                <span>Continue to Privacy Choices</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Privacy & AI Transparency */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                Privacy & Grounded AI
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                You control your audience and how AI assists your experience.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-[#00D1B2] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Audience Control
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    By default, your posts can be seen by the public or restricted to approved followers. You can change this per-post.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                <Sparkles className="w-4 h-4 text-[#FF7A5C] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Optional Grounded AI
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Cove AI is optional. When you ask questions, it grounds answers with real Google Search citations and Google Maps place attribution. Inside messaging, AI assistance is triggered only when you deliberately request a draft or rewrite.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleComplete}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSaving ? 'Finishing setup...' : 'Enter Home Feed'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
