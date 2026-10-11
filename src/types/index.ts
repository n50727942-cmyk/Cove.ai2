export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  hasCompletedOnboarding: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPresence {
  userId: string;
  username?: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface UserStats {
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

export interface ExploreMember {
  user: SafeUser;
  isFollowing: boolean;
  isPending: boolean;
  followersCount: number;
  postsCount: number;
}

export interface FollowRequest {
  followerId: string;
  followingId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  follower: SafeUser;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  audience: 'public' | 'followers';
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  author: SafeUser;
  hasLiked: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: SafeUser;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  updatedAt: string;
  otherParticipant: SafeUser;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface AISource {
  title?: string;
  uri?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  toolUsed?: 'search' | 'maps' | 'none';
  sources?: AISource[];
  searchQueries?: string[];
  warning?: string;
  isQuotaFallback?: boolean;
  timestamp: string;
}
