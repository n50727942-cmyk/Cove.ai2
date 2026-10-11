import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AtSign, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser } from '../../types';

interface RegisterViewProps {
  onRegisterSuccess: (user: SafeUser, recoveryPhrase: string) => void;
  onNavigateLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordLengthOk = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanDisplay = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanDisplay) {
      setError('Please provide your name or display name.');
      return;
    }
    if (!cleanUsername) {
      setError('Please provide a unique username handle.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3-20 characters long and contain only letters, numbers, and underscores.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your entries.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.register({
        displayName: cleanDisplay,
        username: cleanUsername,
        password,
        confirmPassword,
      });

      onRegisterSuccess(res.user, res.recoveryPhrase);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2D5AFF] text-white flex items-center justify-center shadow-lg shadow-[#2D5AFF]/25 mb-4">
            <span className="font-display text-2xl font-extrabold tracking-tight">C</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
            Join Cove
          </h1>
          <p className="mt-2 text-sm text-slate-600 text-center max-w-sm">
            Create your account to start sharing and communicating securely.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium leading-relaxed flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="displayName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Name / Display Name
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  autoFocus
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Unique Username
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <AtSign className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="mayalin"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] focus:border-transparent transition-all placeholder:text-slate-400 font-mono text-xs"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Letters, numbers, and underscores (3-20 characters).
              </p>
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] focus:border-transparent transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && !passwordLengthOk && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Password must be at least 8 characters long.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] focus:border-transparent transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {passwordsMatch ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !passwordLengthOk || (confirmPassword.length > 0 && !passwordsMatch)}
                className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D5AFF] shadow-sm active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors focus:outline-none cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Already have an account? Log in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
