import { SafeUser, Post, Comment, Conversation, Message, AISource, ExploreMember, UserStats, FollowRequest } from '../types';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('cove_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('cove_token', token);
      } else {
        localStorage.removeItem('cove_token');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // Auth Endpoints
  public async register(payload: {
    displayName: string;
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ user: SafeUser; sessionToken: string; recoveryPhrase: string }> {
    const res = await this.request<{ user: SafeUser; sessionToken: string; recoveryPhrase: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    this.setToken(res.sessionToken);
    return res;
  }

  public async login(payload: {
    username: string;
    password: string;
  }): Promise<{ user: SafeUser; sessionToken: string }> {
    const res = await this.request<{ user: SafeUser; sessionToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.sessionToken);
    return res;
  }

  public async me(): Promise<{ user: SafeUser }> {
    return this.request<{ user: SafeUser }>('/api/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async recoverPassword(payload: {
    username: string;
    recoveryPhrase: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ user: SafeUser; sessionToken: string; newRecoveryPhrase: string; message: string }> {
    const res = await this.request<{
      user: SafeUser;
      sessionToken: string;
      newRecoveryPhrase: string;
      message: string;
    }>('/api/auth/recover', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.sessionToken);
    return res;
  }

  // Onboarding & Profile
  public async completeOnboarding(payload: {
    bio?: string;
    avatarUrl?: string;
    isPrivate?: boolean;
  }): Promise<{ user: SafeUser }> {
    return this.request<{ user: SafeUser }>('/api/users/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getUserProfile(username: string): Promise<{ user: SafeUser; isFollowing: boolean; isPending?: boolean; stats?: UserStats }> {
    return this.request<{ user: SafeUser; isFollowing: boolean; isPending?: boolean; stats?: UserStats }>(`/api/users/${encodeURIComponent(username)}`);
  }

  public async toggleFollow(username: string): Promise<{ isFollowing: boolean; isPending?: boolean }> {
    return this.request<{ isFollowing: boolean; isPending?: boolean }>(`/api/users/${encodeURIComponent(username)}/follow`, {
      method: 'POST',
    });
  }

  public async getExploreMembers(): Promise<{ members: ExploreMember[] }> {
    return this.request<{ members: ExploreMember[] }>('/api/explore/members');
  }

  public async getUserPosts(username: string): Promise<{ posts: Post[] }> {
    return this.request<{ posts: Post[] }>(`/api/users/${encodeURIComponent(username)}/posts`);
  }

  public async getUserStats(): Promise<{ stats: UserStats }> {
    return this.request<{ stats: UserStats }>('/api/users/me/stats');
  }

  public async getFollowRequests(): Promise<{ requests: FollowRequest[] }> {
    return this.request<{ requests: FollowRequest[] }>('/api/users/me/follow-requests');
  }

  public async acceptFollowRequest(followerId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/users/follow-requests/${encodeURIComponent(followerId)}/accept`, {
      method: 'POST',
    });
  }

  public async rejectFollowRequest(followerId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/users/follow-requests/${encodeURIComponent(followerId)}/reject`, {
      method: 'POST',
    });
  }

  // Social Feed & Posts
  public async getFeed(): Promise<{ posts: Post[] }> {
    return this.request<{ posts: Post[] }>('/api/posts');
  }

  public async createPost(content: string, audience: 'public' | 'followers'): Promise<{ post: Post }> {
    return this.request<{ post: Post }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content, audience }),
    });
  }

  public async reactToPost(postId: string): Promise<{ hasLiked: boolean; likesCount: number }> {
    return this.request<{ hasLiked: boolean; likesCount: number }>(`/api/posts/${postId}/react`, {
      method: 'POST',
    });
  }

  public async addComment(postId: string, content: string): Promise<{ comment: Comment }> {
    return this.request<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  public async getComments(postId: string): Promise<{ comments: Comment[] }> {
    return this.request<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
  }

  public async recordSafety(payload: { targetId: string; actionType: 'block' | 'mute' | 'report'; reason?: string }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/safety/action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Messaging (Prototype Only - Not E2EE)
  public async getConversations(): Promise<{ conversations: Conversation[]; securityStatus: string }> {
    return this.request<{ conversations: Conversation[]; securityStatus: string }>('/api/conversations');
  }

  public async startConversation(targetUsername: string): Promise<{ conversation: Conversation; targetUser: SafeUser }> {
    return this.request<{ conversation: Conversation; targetUser: SafeUser }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUsername }),
    });
  }

  public async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
    return this.request<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`);
  }

  public async sendMessage(conversationId: string, content: string): Promise<{ message: Message }> {
    return this.request<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Gemini AI Chat & Grounding
  public async chatAi(payload: {
    prompt: string;
    history?: { role: string; text: string }[];
    enableSearch?: boolean;
    enableMaps?: boolean;
    mode?: 'auto' | 'search' | 'maps';
  }): Promise<{
    text: string;
    toolUsed: 'search' | 'maps' | 'none';
    sources?: AISource[];
    searchQueries?: string[];
    isQuotaFallback?: boolean;
    warning?: string;
  }> {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Messaging AI Assist
  public async messageAssist(payload: {
    action: 'rewrite' | 'shorten' | 'translate' | 'summarize' | 'draft_reply';
    text: string;
    tone?: string;
    targetLanguage?: string;
  }): Promise<{ suggestion: string; warning?: string }> {
    return this.request('/api/ai/message-assist', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Voice Input Audio Transcription
  public async transcribeAudio(audioData: string, mimeType: string = 'audio/webm'): Promise<{ text: string }> {
    return this.request('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioData, mimeType }),
    });
  }

  // Real-Time Presence
  public async getPresenceSnapshot(): Promise<{ presence: Record<string, { isOnline: boolean; lastSeen: string }> }> {
    return this.request<{ presence: Record<string, { isOnline: boolean; lastSeen: string }> }>('/api/presence/status');
  }

  public async sendHeartbeat(): Promise<{ ok: boolean; isOnline: boolean }> {
    return this.request<{ ok: boolean; isOnline: boolean }>('/api/presence/heartbeat', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
