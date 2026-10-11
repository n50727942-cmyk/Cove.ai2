import React, { useState } from 'react';
import { KeyRound, X, AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser } from '../../types';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoverySuccess: (user: SafeUser) => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onClose,
  onRecoverySuccess,
}) => {
  const [username, setUsername] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRotatedPhrase, setNewRotatedPhrase] = useState<string | null>(null);
  const [recoveredUser, setRecoveredUser] = useState<SafeUser | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPhrase = recoveryPhrase.trim();

    if (!cleanUsername) {
      setError('Please provide your account username.');
      return;
    }
    if (!cleanPhrase) {
      setError('Please enter your 16-word recovery phrase.');
      return;
    }
    const words = cleanPhrase.split(/\s+/);
    if (words.length !== 16) {
      setError(`Recovery phrase must contain exactly 16 words (currently entered: ${words.length}).`);
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.recoverPassword({
        username: cleanUsername,
        recoveryPhrase: cleanPhrase,
        newPassword,
        confirmPassword,
      });

      setRecoveredUser(res.user);
      setNewRotatedPhrase(res.newRecoveryPhrase);
    } catch (err: any) {
      setError(err.message || 'Recovery failed. Please verify your username and 16-word phrase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    if (recoveredUser) {
      onRecoverySuccess(recoveredUser);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2D5AFF]/10 text-[#2D5AFF] flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 font-display">
              Recover Account Access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {newRotatedPhrase ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Password Successfully Reset</p>
                <p className="mt-0.5 text-emerald-700">
                  All prior sessions have been revoked. Per Cove security policy, your recovery key has been rotated. Save your new key below.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                New 16-Word Recovery Key:
              </span>
              <p className="font-mono text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200/80 break-words leading-relaxed">
                {newRotatedPhrase}
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] transition-all cursor-pointer"
            >
              <span>Continue to Feed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium leading-relaxed flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="rec-username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
              >
                Username
              </label>
              <input
                id="rec-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alexrivers"
                className="block w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="rec-phrase"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
              >
                16-Word Master Recovery Key
              </label>
              <textarea
                id="rec-phrase"
                rows={3}
                required
                value={recoveryPhrase}
                onChange={(e) => setRecoveryPhrase(e.target.value)}
                placeholder="Enter all 16 words separated by spaces..."
                className="block w-full px-3.5 py-2 text-xs text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] placeholder:text-slate-400 font-mono resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="rec-newpass"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="rec-newpass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="block w-full px-3.5 pr-10 py-2 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="rec-confirmpass"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="rec-confirmpass"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="block w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] placeholder:text-slate-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? 'Verifying...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
