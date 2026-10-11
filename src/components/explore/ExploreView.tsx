import React, { useState, useEffect } from 'react';
import { Search, UserPlus, UserCheck, MessageSquare, Shield, Globe, Users, Sparkles, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser, ExploreMember } from '../../types';

interface ExploreViewProps {
  currentUser: SafeUser;
  onOpenProfile: (username: string) => void;
  onStartChat: (username: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  currentUser,
  onOpenProfile,
  onStartChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<ExploreMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExploreMembers();
  }, []);

  const loadExploreMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getExploreMembers();
      setMembers(res.members);
    } catch (err: any) {
      setError(err.message || 'Failed to load explore members.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async (username: string) => {
    try {
      const res = await api.toggleFollow(username);
      setMembers((prev) =>
        prev.map((m) =>
          m.user.username === username
            ? { ...m, isFollowing: res.isFollowing, isPending: res.isPending || false }
            : m
        )
      );
    } catch (err) {
      console.error('Follow failed:', err);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return true;
    return (
      m.user.username.toLowerCase().includes(q) ||
      m.user.displayName.toLowerCase().includes(q) ||
      m.user.bio.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-3xl mx-auto py-5 sm:py-7 px-4 sm:px-6 space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 font-display">
              Discover Community Members
            </h1>
            <p className="text-xs text-slate-500">
              Connect with thinkers, creators, and community participants across Cove.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 self-start sm:self-auto">
            {members.length} members active
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @handle, or interest..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Member Directory Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs">
          <span className="w-6 h-6 border-2 border-slate-300 border-t-[#2D5AFF] rounded-full animate-spin inline-block mb-3" />
          <p className="text-xs text-slate-400">Loading community directory...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs space-y-2">
          <p className="text-sm font-bold text-slate-800 font-display">No matching members found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try a different search query or clear the filter to view all active members.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMembers.map((m) => (
            <div
              key={m.user.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(m.user.username)}
                      className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                    >
                      {m.user.avatarUrl ? (
                        <img
                          src={m.user.avatarUrl}
                          alt={m.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-sm">
                          {m.user.displayName.charAt(0)}
                        </div>
                      )}
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(m.user.username)}
                        className="font-extrabold text-sm text-slate-900 block truncate hover:text-[#2D5AFF] transition-colors cursor-pointer text-left"
                      >
                        {m.user.displayName}
                      </button>
                      <span className="text-xs text-slate-400 font-mono block truncate">
                        @{m.user.username}
                      </span>
                    </div>
                  </div>

                  {m.user.isPrivate && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                      Private
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
                  {m.user.bio || 'Community member on Cove.'}
                </p>

                {/* Zero-Pill Unboxed Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <strong className="font-bold text-slate-900">{m.followersCount}</strong> followers
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <strong className="font-bold text-slate-900">{m.postsCount}</strong> posts
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleFollow(m.user.username)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 ${
                    m.isFollowing
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : m.isPending
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-[#2D5AFF] text-white hover:bg-[#2448cc]'
                  }`}
                >
                  {m.isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Following</span>
                    </>
                  ) : m.isPending ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onStartChat(m.user.username)}
                  title="Direct Message"
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-[#2D5AFF] hover:border-[#2D5AFF]/40 hover:bg-[#2D5AFF]/5 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
