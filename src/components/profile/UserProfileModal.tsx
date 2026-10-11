import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Shield, ShieldAlert, UserCheck, UserPlus, Globe, Heart, AlertTriangle, Users, Lock, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { useUserPresence, formatLastSeen } from '../../lib/presence';
import { SafeUser, Post, UserStats } from '../../types';

interface UserProfileModalProps {
  username: string;
  currentUserId: string;
  onClose: () => void;
  onStartChat: (username: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  username,
  currentUserId,
  onClose,
  onStartChat,
}) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [safetySuccess, setSafetySuccess] = useState<string | null>(null);

  // Real-time presence subscription
  const livePresence = useUserPresence(user?.id);
  const isOnline = livePresence?.isOnline ?? user?.isOnline ?? false;
  const lastSeen = livePresence?.lastSeen ?? user?.lastSeen;

  useEffect(() => {
    loadUserData();
  }, [username]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        api.getUserProfile(username),
        api.getUserPosts(username).catch(() => ({ posts: [] })),
      ]);
      setUser(profileRes.user);
      setIsFollowing(profileRes.isFollowing);
      setIsPending(profileRes.isPending || false);
      if (profileRes.stats) {
        setStats(profileRes.stats);
      }
      setUserPosts(postsRes.posts);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!user || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      const res = await api.toggleFollow(user.username);
      setIsFollowing(res.isFollowing);
      setIsPending(res.isPending || false);
      if (stats) {
        setStats({
          ...stats,
          followersCount: res.isFollowing ? stats.followersCount + 1 : Math.max(0, stats.followersCount - 1),
        });
      }
      // Reload posts in case following unlocked private posts
      const postsRes = await api.getUserPosts(username).catch(() => ({ posts: [] }));
      setUserPosts(postsRes.posts);
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleSafetyAction = async (actionType: 'block' | 'mute' | 'report') => {
    if (!user) return;
    try {
      await api.recordSafety({
        targetId: user.id,
        actionType,
        reason: `User requested ${actionType} from profile modal.`,
      });
      setSafetySuccess(`Action recorded: ${actionType} @${user.username}`);
      setSafetyMenuOpen(false);
      setTimeout(() => {
        setSafetySuccess(null);
        if (actionType === 'block') onClose();
      }, 2000);
    } catch (err) {
      console.error('Safety action failed:', err);
    }
  };

  const isMe = user?.id === currentUserId;
  const isPrivateLocked = user?.isPrivate && !isFollowing && !isMe;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Top Header */}
        <div className="p-3.5 px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <span className="text-xs font-bold text-slate-700 font-display">Profile Overview</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <span className="w-6 h-6 border-2 border-slate-300 border-t-[#2D5AFF] rounded-full animate-spin" />
              <span className="text-xs">Loading profile...</span>
            </div>
          ) : !user ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              User not found.
            </div>
          ) : (
            <>
              {safetySuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  {safetySuccess}
                </div>
              )}

              {/* Header Info */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xl font-display">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    {/* Real-time Online/Offline Status Indicator */}
                    <span
                      className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                        isOnline
                          ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-slate-300'
                      }`}
                      title={isOnline ? 'Active Now' : formatLastSeen(lastSeen)}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-slate-900 font-display truncate">
                        {user.displayName}
                      </h2>
                      {/* Real-time Status Badge */}
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {isMe ? 'Active Now (You)' : 'Active Now'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {formatLastSeen(lastSeen)}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-mono block truncate mt-0.5">
                      @{user.username}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {!isMe && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isFollowLoading}
                      onClick={handleToggleFollow}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                        isFollowing
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-[#2D5AFF] text-white hover:bg-[#2448cc]'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Following</span>
                        </>
                      ) : isPending ? (
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
                      onClick={() => {
                        onClose();
                        onStartChat(user.username);
                      }}
                      title="Direct Message"
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-[#2D5AFF] hover:border-[#2D5AFF]/40 hover:bg-[#2D5AFF]/5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Bio */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {user.bio || 'Community member on Cove.'}
              </p>

              {/* Stats */}
              {stats && (
                <div className="flex items-center gap-5 text-xs text-slate-600 py-3 border-y border-slate-100">
                  <div>
                    <strong className="font-extrabold text-slate-900">{stats.followersCount}</strong> followers
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <strong className="font-extrabold text-slate-900">{stats.followingCount}</strong> following
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <strong className="font-extrabold text-slate-900">{stats.postsCount}</strong> posts
                  </div>
                </div>
              )}

              {/* Private Profile Wall or Posts Stream */}
              {isPrivateLocked ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <Lock className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <h3 className="text-sm font-extrabold text-slate-800 font-display">This Account is Private</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Follow @{user.username} to request access to their shared posts and media updates.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Posts ({userPosts.length})
                  </h3>

                  {userPosts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl">
                      No posts published by this member yet.
                    </div>
                  ) : (
                    userPosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-2"
                      >
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-[#FF7A5C]" /> {post.likesCount}
                          </span>
                          <span>·</span>
                          <span>{post.commentsCount} comments</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Safety Controls for Other Users */}
              {!isMe && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Safety & Moderation</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSafetyAction('mute')}
                      className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Mute
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => handleSafetyAction('block')}
                      className="text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      Block User
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => handleSafetyAction('report')}
                      className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                    >
                      Report
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
