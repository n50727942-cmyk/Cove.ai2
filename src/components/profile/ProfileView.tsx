import React, { useState, useEffect } from 'react';
import { User, Shield, KeyRound, LogOut, Heart, Edit3, X, Check, Lock, Globe, Users, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { SafeUser, Post, UserStats, FollowRequest } from '../../types';

interface ProfileViewProps {
  currentUser: SafeUser;
  onLogout: () => void;
  onUserUpdated?: (user: SafeUser) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onLogout,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'requests' | 'security'>('posts');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<UserStats>({ followersCount: 0, followingCount: 0, postsCount: 0 });
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState(currentUser.displayName);
  const [editBio, setEditBio] = useState(currentUser.bio);
  const [editAvatar, setEditAvatar] = useState(currentUser.avatarUrl);
  const [editPrivate, setEditPrivate] = useState(currentUser.isPrivate);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, [currentUser.id]);

  const loadUserData = async () => {
    setIsLoadingPosts(true);
    try {
      const [feedRes, statsRes, reqRes] = await Promise.all([
        api.getUserPosts(currentUser.username).catch(() => ({ posts: [] })),
        api.getUserStats().catch(() => ({ stats: { followersCount: 0, followingCount: 0, postsCount: 0 } })),
        api.getFollowRequests().catch(() => ({ requests: [] })),
      ]);
      setMyPosts(feedRes.posts);
      setStats(statsRes.stats);
      setFollowRequests(reqRes.requests);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const res = await api.completeOnboarding({
        bio: editBio.trim(),
        avatarUrl: editAvatar.trim(),
        isPrivate: editPrivate,
      });
      if (onUserUpdated) {
        onUserUpdated(res.user);
      }
      setIsEditing(false);
      setSaveMessage('Profile settings successfully saved.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcceptRequest = async (followerId: string) => {
    try {
      await api.acceptFollowRequest(followerId);
      setFollowRequests((prev) => prev.filter((r) => r.followerId !== followerId));
      setStats((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
    } catch (err) {
      console.error('Failed to accept follow request:', err);
    }
  };

  const handleRejectRequest = async (followerId: string) => {
    try {
      await api.rejectFollowRequest(followerId);
      setFollowRequests((prev) => prev.filter((r) => r.followerId !== followerId));
    } catch (err) {
      console.error('Failed to reject follow request:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-5 sm:py-7 px-4 sm:px-6 space-y-6">
      {saveMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xs">
        {/* Subtle decorative cover banner */}
        <div className="h-24 sm:h-28 bg-gradient-to-r from-[#2D5AFF]/20 via-[#00D1B2]/15 to-[#FF7A5C]/20 border-b border-slate-100" />

        <div className="p-6 pt-0 relative">
          {/* Avatar positioning */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-14 mb-4 gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-1 border-2 border-white shadow-md overflow-hidden shrink-0">
              <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="font-extrabold text-slate-600 text-2xl font-display">
                    {currentUser.displayName.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditName(currentUser.displayName);
                  setEditBio(currentUser.bio);
                  setEditAvatar(currentUser.avatarUrl);
                  setEditPrivate(currentUser.isPrivate);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* User Names & Bio */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 font-display">
                {currentUser.displayName}
              </h1>
              {currentUser.isPrivate && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Private Account
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-mono block">
              @{currentUser.username}
            </span>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {currentUser.bio || 'No bio provided yet. Click "Edit Profile" to share your interests.'}
            </p>
          </div>

          {/* Zero-Pill Unboxed Stats */}
          <div className="flex items-center gap-5 text-xs text-slate-600 pt-3 border-t border-slate-100">
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

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'posts'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              My Posts ({myPosts.length})
            </button>

            {currentUser.isPrivate && (
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'requests'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Follow Requests</span>
                {followRequests.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#2D5AFF] text-white text-[10px] flex items-center justify-center font-bold">
                    {followRequests.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Privacy & Security
            </button>
          </div>
        </div>
      </div>

      {/* TAB CONTENT: MY POSTS */}
      {activeTab === 'posts' && (
        <div className="space-y-3">
          {isLoadingPosts ? (
            <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-200/80">
              Loading your posts...
            </div>
          ) : myPosts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs space-y-2">
              <p className="text-sm font-bold text-slate-700 font-display">No posts published yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Share your first thoughts or discoveries on the Home Feed.
              </p>
            </div>
          ) : (
            myPosts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    {post.audience === 'followers' ? (
                      <span className="inline-flex items-center gap-1 text-[#00D1B2] font-semibold">
                        <Users className="w-3.5 h-3.5" /> Followers only
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Globe className="w-3.5 h-3.5" /> Public
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {post.content}
                </p>

                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-[#FF7A5C]" /> {post.likesCount} likes
                  </span>
                  <span>·</span>
                  <span>{post.commentsCount} comments</span>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* TAB CONTENT: FOLLOW REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {followRequests.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-2xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-700 font-display">No pending requests</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                When other users request to follow your private account, they will appear here for approval.
              </p>
            </div>
          ) : (
            followRequests.map((req) => (
              <div
                key={req.followerId}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    {req.follower.avatarUrl ? (
                      <img src={req.follower.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                        {req.follower.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-900 block truncate">
                      {req.follower.displayName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block truncate">
                      @{req.follower.username}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAcceptRequest(req.followerId)}
                    className="px-3 py-1.5 bg-[#2D5AFF] text-white text-xs font-bold rounded-xl hover:bg-[#2448cc] cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectRequest(req.followerId)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB CONTENT: PRIVACY & SECURITY */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm font-display">
              <Shield className="w-4 h-4 text-[#2D5AFF]" />
              <span>Audience & Discovery Controls</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="space-y-0.5 max-w-sm">
                <span className="text-xs font-bold text-slate-900 block">Private Profile</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Only approved followers can view your posts and personal updates.
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${currentUser.isPrivate ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                {currentUser.isPrivate ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="space-y-0.5 max-w-sm">
                <span className="text-xs font-bold text-slate-900 block">16-Word Recovery Key</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cryptographically generated during signup. Used to regain account access without central email dependency.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Secured
              </span>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 font-display">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Bio / About
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell the community what you care about..."
                  className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5AFF]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be a valid http or https URL.
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="editPrivate"
                  checked={editPrivate}
                  onChange={(e) => setEditPrivate(e.target.checked)}
                  className="w-4 h-4 text-[#2D5AFF] rounded border-slate-300 focus:ring-[#2D5AFF]"
                />
                <label htmlFor="editPrivate" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Make my account private (requires approval for followers)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#2D5AFF] text-white rounded-xl text-xs font-bold hover:bg-[#2448cc] cursor-pointer shadow-2xs"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
