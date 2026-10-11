import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (user: SafeUser) => void;
  onNavigateRegister: () => void;
  onOpenRecovery: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  onOpenRecovery,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login({
        username: cleanUsername,
        password,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Lockup */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2D5AFF] text-white flex items-center justify-center shadow-lg shadow-[#2D5AFF]/25 mb-4">
            <span className="font-display text-2xl font-extrabold tracking-tight">C</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
            Cove
          </h1>
          <p className="mt-2 text-sm text-slate-600 text-center max-w-sm">
            Public for discovery. Private for conversations.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium leading-relaxed"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alexrivers"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={onOpenRecovery}
                  className="text-xs font-medium text-[#2D5AFF] hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D5AFF] shadow-sm active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Log in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onNavigateRegister}
              className="w-full h-11 flex items-center justify-center py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 shadow-2xs active:scale-[0.99] transition-all cursor-pointer"
            >
              Create a new account
            </button>
          </div>

          {/* Quick Exploratory Credentials Helper */}
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#00D1B2] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700">Quick Test Account:</span>{' '}
              Username <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800">cove</code> / Password{' '}
              <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800">Password123!</code> or create a new account to test registration and recovery.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
