import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface User {
  id: string;
  username: string; // Lowercase unique handle
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  recoveryHash: string;
  recoverySalt: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SafeUser = Omit<User, 'passwordHash' | 'passwordSalt' | 'recoveryHash' | 'recoverySalt'>;

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  userAgent: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  audience: 'public' | 'followers';
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface PostLike {
  postId: string;
  userId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface SafetyAction {
  id: string;
  actorId: string;
  targetId: string;
  actionType: 'block' | 'mute' | 'report';
  reason?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  posts: Post[];
  postLikes: PostLike[];
  comments: Comment[];
  follows: Follow[];
  safetyActions: SafetyAction[];
  conversations: Conversation[];
  messages: Message[];
}

// 256 unambiguous English words for 16-word recovery phrases
const RECOVERY_WORDS = [
  'amber', 'anchor', 'angel', 'anthem', 'anvil', 'apple', 'arcade', 'arrow',
  'atlas', 'autumn', 'badge', 'banner', 'beacon', 'breeze', 'bridge', 'cabin',
  'calm', 'canyon', 'castle', 'cedar', 'cliff', 'cloud', 'clover', 'coast',
  'copper', 'coral', 'cove', 'crane', 'crest', 'crystal', 'cypress', 'dawn',
  'delta', 'desert', 'diamond', 'dove', 'drift', 'dune', 'eagle', 'echo',
  'ember', 'falcon', 'fawn', 'feather', 'fern', 'field', 'finch', 'flame',
  'flint', 'flora', 'forest', 'fountain', 'fox', 'frost', 'garden', 'glade',
  'glider', 'glen', 'granite', 'grove', 'harbor', 'haven', 'hawk', 'hazel',
  'heath', 'helix', 'heron', 'horizon', 'ice', 'inlet', 'iris', 'island',
  'ivy', 'jade', 'jasper', 'juniper', 'kite', 'lagoon', 'lake', 'lapis',
  'lark', 'laurel', 'leaf', 'ledge', 'light', 'lily', 'lime', 'linden',
  'lynx', 'maple', 'marble', 'marsh', 'meadow', 'merit', 'mesa', 'mist',
  'moon', 'moss', 'mountain', 'nebula', 'nest', 'nova', 'oak', 'oasis',
  'ocean', 'olive', 'onyx', 'opal', 'orbit', 'orchard', 'oriole', 'osprey',
  'otter', 'palm', 'peak', 'pearl', 'pebble', 'pelican', 'petal', 'pine',
  'planet', 'plaza', 'polar', 'pond', 'poppy', 'prairie', 'prism', 'quartz',
  'quiver', 'radius', 'rain', 'rapid', 'raven', 'reef', 'ridge', 'ripple',
  'river', 'robin', 'rock', 'rose', 'ruby', 'sage', 'sail', 'salmon',
  'sand', 'sapphire', 'scale', 'scenic', 'scout', 'sea', 'seal', 'shadow',
  'shell', 'shore', 'sierra', 'silver', 'slate', 'snow', 'solar', 'solace',
  'spark', 'spring', 'spruce', 'star', 'stone', 'storm', 'stream', 'summit',
  'sun', 'surf', 'swift', 'taiga', 'talon', 'teal', 'terrace', 'tide',
  'timber', 'topaz', 'trail', 'tree', 'tropic', 'tulip', 'tundra', 'valley',
  'vapor', 'velvet', 'verge', 'vessel', 'violet', 'vista', 'wave', 'willow',
  'wind', 'wood', 'zenith', 'zephyr', 'acorn', 'alder', 'alpine', 'aspen',
  'bamboo', 'basalt', 'birch', 'bluff', 'boulder', 'brook', 'canvas', 'cascada',
  'cavern', 'chalet', 'cinder', 'citrus', 'comet', 'cordon', 'covey', 'creek',
  'dewdrop', 'driftwood', 'emerald', 'estuary', 'fjord', 'foothill', 'galaxy', 'garnet',
  'geyser', 'glacier', 'grassland', 'habor', 'headland', 'highland', 'iceberg', 'keystone',
  'lookout', 'lowland', 'monolith', 'moraine', 'narrows', 'needle', 'outcrop', 'overlook',
  'palisade', 'passage', 'pasture', 'peninsula', 'plateau', 'quarry', 'rapids', 'ravine',
  'redwood', 'savanna', 'shoal', 'sound', 'spire', 'steppe', 'strand', 'tarn',
  'timberline', 'traverse', 'upland', 'vale', 'volcano', 'waterfall', 'wetland', 'wharf'
];

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath?: string) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = filePath || path.join(dataDir, 'cove.db.json');
    this.data = this.load();
    this.seedDefaultsIfEmpty();
  }

  private load(): DatabaseSchema {
    const defaultData: DatabaseSchema = {
      users: [],
      sessions: [],
      posts: [],
      postLikes: [],
      comments: [],
      follows: [],
      safetyActions: [],
      conversations: [],
      messages: [],
    };

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...defaultData, ...parsed };
      }
    } catch (err) {
      console.error('[DB] Failed to load database file, initializing clean default:', err);
    }

    return defaultData;
  }

  private persist(): void {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[DB] Failed to persist database:', err);
      throw new Error('Database write failure');
    }
  }

  private seedDefaultsIfEmpty(): void {
    // Only seed public exploratory accounts if explicit flag or test environment is active
    // Prevents predictable shared default accounts in production environments
    const isDevSeedEnabled = process.env.ENABLE_DEV_SEED === 'true' || process.env.NODE_ENV === 'test';
    if (!isDevSeedEnabled) {
      return;
    }

    if (this.data.users.length === 0) {
      const now = new Date().toISOString();
      const demoUsers = [
        {
          id: 'u_cove_official',
          username: 'cove',
          displayName: 'Cove Platform',
          bio: 'Public discovery, private conversations. Welcome to Cove.',
          avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
          isPrivate: false,
          hasCompletedOnboarding: true,
          // Generate a cryptographically randomized password for dev seed
          password: crypto.randomBytes(16).toString('hex') + '!Aa1',
          posts: [
            'Welcome to Cove! Here, public sharing connects you with the world, while your conversations remain strictly yours. Try asking Cove AI for grounded answers, or explore our privacy settings.',
            'Design philosophy: Zero clutter, uncompromised user sovereignty, and honest technology.'
          ]
        },
        {
          id: 'u_maya_lin',
          username: 'mayalin',
          displayName: 'Maya Lin',
          bio: 'Architectural photographer & urban explorer. Documenting spaces.',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isPrivate: false,
          hasCompletedOnboarding: true,
          password: crypto.randomBytes(16).toString('hex') + '!Aa1',
          posts: [
            'Morning light across the waterfront pier. The clean brutalist concrete lines always look best right as the sun clears the horizon.'
          ]
        },
        {
          id: 'u_devin_chen',
          username: 'devinchen',
          displayName: 'Devin Chen',
          bio: 'Distributed systems engineer. Coffee & open-source enthusiast.',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          isPrivate: false,
          hasCompletedOnboarding: true,
          password: crypto.randomBytes(16).toString('hex') + '!Aa1',
          posts: [
            'Really appreciating platforms that prioritize intentional communication over algorithmic outrage cycles. Looking forward to connecting here!'
          ]
        }
      ];

      for (const u of demoUsers) {
        const { hash, salt } = this.hashPassword(u.password);
        const recoveryPhrase = this.generateRecoveryPhrase();
        const { hash: rHash, salt: rSalt } = this.hashPassword(recoveryPhrase);

        this.data.users.push({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          passwordHash: hash,
          passwordSalt: salt,
          recoveryHash: rHash,
          recoverySalt: rSalt,
          bio: u.bio,
          avatarUrl: u.avatarUrl,
          isPrivate: u.isPrivate,
          hasCompletedOnboarding: u.hasCompletedOnboarding,
          createdAt: now,
          updatedAt: now,
        });

        for (const p of u.posts) {
          const postId = 'p_' + crypto.randomBytes(6).toString('hex');
          this.data.posts.push({
            id: postId,
            authorId: u.id,
            content: p,
            audience: 'public',
            likesCount: 1,
            commentsCount: 0,
            createdAt: now,
          });
          this.data.postLikes.push({
            postId,
            userId: u.id,
            createdAt: now,
          });
        }
      }

      this.persist();
      console.log('[DB] Development exploratory seed accounts populated with unique randomized credentials.');
    }
  }

  // --- CRYPTO & PASSWORDS ---
  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    return { hash, salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const derivedBuf = Buffer.from(derived, 'hex');
      if (hashBuf.length !== derivedBuf.length) return false;
      return crypto.timingSafeEqual(hashBuf, derivedBuf);
    } catch {
      return false;
    }
  }

  public generateRecoveryPhrase(): string {
    const words: string[] = [];
    for (let i = 0; i < 16; i++) {
      const idx = crypto.randomInt(0, RECOVERY_WORDS.length);
      words.push(RECOVERY_WORDS[idx]);
    }
    return words.join(' ');
  }

  public verifyRecoveryPhrase(phrase: string, hash: string, salt: string): boolean {
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    return this.verifyPassword(normalized, hash, salt);
  }

  public toSafeUser(user: User): SafeUser {
    const { passwordHash, passwordSalt, recoveryHash, recoverySalt, ...safe } = user;
    return safe;
  }

  // --- USERS ---
  public findUserByUsername(username: string): User | undefined {
    const norm = username.trim().toLowerCase();
    return this.data.users.find(u => u.username === norm);
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(params: {
    displayName: string;
    username: string;
    password: string;
  }): { user: SafeUser; recoveryPhrase: string } {
    const normUsername = params.username.trim().toLowerCase();
    if (this.findUserByUsername(normUsername)) {
      throw new Error('USERNAME_TAKEN');
    }

    const { hash, salt } = this.hashPassword(params.password);
    const recoveryPhrase = this.generateRecoveryPhrase();
    const { hash: rHash, salt: rSalt } = this.hashPassword(recoveryPhrase);
    const now = new Date().toISOString();

    const newUser: User = {
      id: 'u_' + crypto.randomBytes(8).toString('hex'),
      username: normUsername,
      displayName: params.displayName.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      recoveryHash: rHash,
      recoverySalt: rSalt,
      bio: '',
      avatarUrl: '',
      isPrivate: false,
      hasCompletedOnboarding: false,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(newUser);
    this.persist();

    return { user: this.toSafeUser(newUser), recoveryPhrase };
  }

  public updateUser(userId: string, updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'isPrivate' | 'hasCompletedOnboarding'>>): SafeUser {
    const user = this.findUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (updates.displayName !== undefined) user.displayName = updates.displayName.trim();
    if (updates.bio !== undefined) user.bio = updates.bio.trim();
    if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl.trim();
    if (updates.isPrivate !== undefined) user.isPrivate = updates.isPrivate;
    if (updates.hasCompletedOnboarding !== undefined) user.hasCompletedOnboarding = updates.hasCompletedOnboarding;
    user.updatedAt = new Date().toISOString();

    this.persist();
    return this.toSafeUser(user);
  }

  public resetPasswordWithRecovery(username: string, recoveryPhrase: string, newPassword: string): { user: SafeUser; newRecoveryPhrase: string } {
    const user = this.findUserByUsername(username);
    if (!user) {
      // Execute dummy scrypt verification to prevent timing attacks that enumerate valid usernames
      this.verifyPassword(recoveryPhrase, '00'.repeat(64), '00'.repeat(32));
      throw new Error('INVALID_RECOVERY');
    }

    const isValid = this.verifyRecoveryPhrase(recoveryPhrase, user.recoveryHash, user.recoverySalt);
    if (!isValid) throw new Error('INVALID_RECOVERY');

    // Update password
    const { hash, salt } = this.hashPassword(newPassword);
    // Rotate recovery phrase upon use
    const newRecoveryPhrase = this.generateRecoveryPhrase();
    const { hash: rHash, salt: rSalt } = this.hashPassword(newRecoveryPhrase);

    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.recoveryHash = rHash;
    user.recoverySalt = rSalt;
    user.updatedAt = new Date().toISOString();

    // Revoke all prior active sessions
    this.data.sessions = this.data.sessions.filter(s => s.userId !== user.id);

    this.persist();
    return { user: this.toSafeUser(user), newRecoveryPhrase };
  }

  // --- SESSIONS ---
  public createSession(userId: string, userAgent: string = 'web'): { session: Session; rawToken: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const session: Session = {
      id: 's_' + crypto.randomBytes(8).toString('hex'),
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      createdAt: now.toISOString(),
    };

    this.data.sessions.push(session);
    this.persist();
    return { session, rawToken };
  }

  public getSessionByToken(rawToken: string): { session: Session; user: SafeUser } | null {
    if (!rawToken) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = this.data.sessions.find(s => s.tokenHash === tokenHash);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      // Expired session
      this.data.sessions = this.data.sessions.filter(s => s.id !== session.id);
      this.persist();
      return null;
    }

    const user = this.findUserById(session.userId);
    if (!user) return null;

    return { session, user: this.toSafeUser(user) };
  }

  public revokeSession(rawToken: string): void {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    this.data.sessions = this.data.sessions.filter(s => s.tokenHash !== tokenHash);
    this.persist();
  }

  public revokeAllUserSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter(s => s.userId !== userId);
    this.persist();
  }

  // --- AUTHORIZATION & RELATIONSHIP HELPERS ---
  public isBlocked(userA: string, userB: string): boolean {
    return this.data.safetyActions.some(
      s => s.actionType === 'block' &&
      ((s.actorId === userA && s.targetId === userB) || (s.actorId === userB && s.targetId === userA))
    );
  }

  public isApprovedFollower(followerId: string, followingId: string): boolean {
    return this.data.follows.some(
      f => f.followerId === followerId && f.followingId === followingId && f.status === 'accepted'
    );
  }

  public isFollowing(followerId: string, followingId: string): boolean {
    return this.isApprovedFollower(followerId, followingId);
  }

  public canViewUserContent(viewerId: string | undefined, targetUserId: string): boolean {
    if (viewerId === targetUserId) return true;
    if (viewerId && this.isBlocked(viewerId, targetUserId)) return false;

    const targetUser = this.findUserById(targetUserId);
    if (!targetUser) return false;

    if (!targetUser.isPrivate) return true;
    if (!viewerId) return false;

    return this.isApprovedFollower(viewerId, targetUserId);
  }

  // --- SOCIAL FEED & POSTS ---
  public createPost(authorId: string, content: string, audience: 'public' | 'followers' = 'public'): Post {
    const post: Post = {
      id: 'p_' + crypto.randomBytes(8).toString('hex'),
      authorId,
      content: content.trim(),
      audience,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.posts.unshift(post);
    this.persist();
    return post;
  }

  public getPostById(postId: string): Post | undefined {
    return this.data.posts.find(p => p.id === postId);
  }

  public getFeed(viewerId?: string): (Post & { author: SafeUser; hasLiked: boolean })[] {
    const result: (Post & { author: SafeUser; hasLiked: boolean })[] = [];

    for (const p of this.data.posts) {
      if (viewerId && this.isBlocked(viewerId, p.authorId)) continue;

      const author = this.findUserById(p.authorId);
      if (!author) continue;

      // Private profile rule: If author is private, non-followers cannot see posts
      if (author.isPrivate && p.authorId !== viewerId && (!viewerId || !this.isApprovedFollower(viewerId, p.authorId))) {
        continue;
      }

      // Audience check: If audience is 'followers', non-followers cannot see
      if (p.audience === 'followers' && p.authorId !== viewerId && (!viewerId || !this.isApprovedFollower(viewerId, p.authorId))) {
        continue;
      }

      const hasLiked = viewerId
        ? this.data.postLikes.some(l => l.postId === p.id && l.userId === viewerId)
        : false;

      result.push({
        ...p,
        author: this.toSafeUser(author),
        hasLiked,
      });
    }

    return result;
  }

  public getUserPosts(username: string, viewerId?: string): (Post & { author: SafeUser; hasLiked: boolean })[] {
    const user = this.findUserByUsername(username);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (!this.canViewUserContent(viewerId, user.id)) {
      return [];
    }

    return this.data.posts
      .filter(p => p.authorId === user.id)
      .filter(p => {
        if (p.audience === 'followers' && user.id !== viewerId && (!viewerId || !this.isApprovedFollower(viewerId, user.id))) {
          return false;
        }
        return true;
      })
      .map(p => {
        const hasLiked = viewerId ? this.data.postLikes.some(l => l.postId === p.id && l.userId === viewerId) : false;
        return {
          ...p,
          author: this.toSafeUser(user),
          hasLiked,
        };
      });
  }

  public getUserStats(userId: string): { followersCount: number; followingCount: number; postsCount: number } {
    const followersCount = this.data.follows.filter(f => f.followingId === userId && f.status === 'accepted').length;
    const followingCount = this.data.follows.filter(f => f.followerId === userId && f.status === 'accepted').length;
    const postsCount = this.data.posts.filter(p => p.authorId === userId).length;
    return { followersCount, followingCount, postsCount };
  }

  public getExploreMembers(currentUserId?: string): {
    user: SafeUser;
    isFollowing: boolean;
    isPending: boolean;
    followersCount: number;
    postsCount: number;
  }[] {
    return this.data.users
      .filter(u => {
        if (currentUserId && u.id === currentUserId) return false;
        if (currentUserId && this.isBlocked(currentUserId, u.id)) return false;
        return true;
      })
      .map(u => {
        const stats = this.getUserStats(u.id);
        const followStatus = currentUserId ? this.getFollowStatus(currentUserId, u.id) : { isFollowing: false, isPending: false };
        return {
          user: this.toSafeUser(u),
          isFollowing: followStatus.isFollowing,
          isPending: followStatus.isPending,
          followersCount: stats.followersCount,
          postsCount: stats.postsCount,
        };
      })
      .sort((a, b) => b.followersCount - a.followersCount);
  }

  public toggleLike(postId: string, userId: string): { hasLiked: boolean; likesCount: number } {
    const post = this.data.posts.find(p => p.id === postId);
    if (!post) throw new Error('POST_NOT_FOUND');

    if (this.isBlocked(userId, post.authorId)) {
      throw new Error('BLOCKED');
    }

    if (!this.canViewUserContent(userId, post.authorId)) {
      throw new Error('UNAUTHORIZED');
    }

    const existingIdx = this.data.postLikes.findIndex(l => l.postId === postId && l.userId === userId);
    let hasLiked = false;

    if (existingIdx >= 0) {
      this.data.postLikes.splice(existingIdx, 1);
      post.likesCount = Math.max(0, post.likesCount - 1);
      hasLiked = false;
    } else {
      this.data.postLikes.push({
        postId,
        userId,
        createdAt: new Date().toISOString(),
      });
      post.likesCount += 1;
      hasLiked = true;
    }

    this.persist();
    return { hasLiked, likesCount: post.likesCount };
  }

  public addComment(postId: string, authorId: string, content: string): Comment & { author: SafeUser } {
    const post = this.data.posts.find(p => p.id === postId);
    if (!post) throw new Error('POST_NOT_FOUND');

    if (this.isBlocked(authorId, post.authorId)) {
      throw new Error('BLOCKED');
    }

    if (!this.canViewUserContent(authorId, post.authorId)) {
      throw new Error('UNAUTHORIZED');
    }

    const author = this.findUserById(authorId);
    if (!author) throw new Error('AUTHOR_NOT_FOUND');

    const comment: Comment = {
      id: 'c_' + crypto.randomBytes(8).toString('hex'),
      postId,
      authorId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    this.data.comments.push(comment);
    post.commentsCount = (post.commentsCount || 0) + 1;
    this.persist();

    return { ...comment, author: this.toSafeUser(author) };
  }

  public getPostComments(postId: string, viewerId?: string): (Comment & { author: SafeUser })[] {
    const post = this.data.posts.find(p => p.id === postId);
    if (!post) throw new Error('POST_NOT_FOUND');

    if (!this.canViewUserContent(viewerId, post.authorId)) {
      throw new Error('UNAUTHORIZED');
    }

    return this.data.comments
      .filter(c => c.postId === postId)
      .filter(c => !viewerId || !this.isBlocked(viewerId, c.authorId))
      .map(c => {
        const author = this.findUserById(c.authorId)!;
        return { ...c, author: this.toSafeUser(author) };
      });
  }

  // --- SOCIAL GRAPH (FOLLOWS & FOLLOW REQUESTS) ---
  public toggleFollow(followerId: string, targetUsername: string): { isFollowing: boolean; isPending: boolean } {
    const target = this.findUserByUsername(targetUsername);
    if (!target) throw new Error('USER_NOT_FOUND');
    if (target.id === followerId) throw new Error('CANNOT_FOLLOW_SELF');

    if (this.isBlocked(followerId, target.id)) {
      throw new Error('BLOCKED');
    }

    const existingIdx = this.data.follows.findIndex(f => f.followerId === followerId && f.followingId === target.id);

    if (existingIdx >= 0) {
      // Unfollow / cancel request
      this.data.follows.splice(existingIdx, 1);
      this.persist();
      return { isFollowing: false, isPending: false };
    } else {
      // If target account is private, status is pending approval
      const status: 'pending' | 'accepted' = target.isPrivate ? 'pending' : 'accepted';
      this.data.follows.push({
        followerId,
        followingId: target.id,
        status,
        createdAt: new Date().toISOString(),
      });
      this.persist();
      return {
        isFollowing: status === 'accepted',
        isPending: status === 'pending',
      };
    }
  }

  public getFollowStatus(followerId: string, targetId: string): { isFollowing: boolean; isPending: boolean } {
    const f = this.data.follows.find(fol => fol.followerId === followerId && fol.followingId === targetId);
    if (!f) return { isFollowing: false, isPending: false };
    return {
      isFollowing: f.status === 'accepted',
      isPending: f.status === 'pending',
    };
  }

  public getFollowRequests(targetUserId: string): (Follow & { follower: SafeUser })[] {
    return this.data.follows
      .filter(f => f.followingId === targetUserId && f.status === 'pending')
      .map(f => {
        const follower = this.findUserById(f.followerId)!;
        return {
          ...f,
          follower: this.toSafeUser(follower),
        };
      });
  }

  public acceptFollowRequest(targetUserId: string, followerId: string): void {
    const follow = this.data.follows.find(f => f.followingId === targetUserId && f.followerId === followerId && f.status === 'pending');
    if (!follow) throw new Error('REQUEST_NOT_FOUND');
    follow.status = 'accepted';
    this.persist();
  }

  public rejectFollowRequest(targetUserId: string, followerId: string): void {
    const idx = this.data.follows.findIndex(f => f.followingId === targetUserId && f.followerId === followerId && f.status === 'pending');
    if (idx < 0) throw new Error('REQUEST_NOT_FOUND');
    this.data.follows.splice(idx, 1);
    this.persist();
  }

  // --- SAFETY & BLOCKING ---
  public recordSafetyAction(actorId: string, targetId: string, actionType: 'block' | 'mute' | 'report', reason?: string): void {
    if (actorId === targetId) throw new Error('INVALID_TARGET');
    if (!this.findUserById(targetId)) throw new Error('USER_NOT_FOUND');

    // If blocking, also remove any existing follow relationships between them
    if (actionType === 'block') {
      this.data.follows = this.data.follows.filter(
        f => !(
          (f.followerId === actorId && f.followingId === targetId) ||
          (f.followerId === targetId && f.followingId === actorId)
        )
      );
    }

    this.data.safetyActions.push({
      id: 'sa_' + crypto.randomBytes(8).toString('hex'),
      actorId,
      targetId,
      actionType,
      reason,
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }

  public unblockUser(actorId: string, targetId: string): void {
    this.data.safetyActions = this.data.safetyActions.filter(
      s => !(s.actorId === actorId && s.targetId === targetId && s.actionType === 'block')
    );
    this.persist();
  }

  public getBlockedUsers(actorId: string): SafeUser[] {
    return this.data.safetyActions
      .filter(s => s.actorId === actorId && s.actionType === 'block')
      .map(s => this.findUserById(s.targetId))
      .filter((u): u is User => !!u)
      .map(u => this.toSafeUser(u));
  }

  // --- MESSAGING (HONEST STATUS & CONFIRMED DELIVERY STATES) ---
  public getOrCreateConversation(userId1: string, userId2: string): Conversation {
    if (userId1 === userId2) throw new Error('CANNOT_CHAT_SELF');
    if (this.isBlocked(userId1, userId2)) {
      throw new Error('BLOCKED');
    }

    const existing = this.data.conversations.find(c =>
      c.participantIds.includes(userId1) && c.participantIds.includes(userId2)
    );

    if (existing) return existing;

    const conv: Conversation = {
      id: 'conv_' + crypto.randomBytes(8).toString('hex'),
      participantIds: [userId1, userId2],
      updatedAt: new Date().toISOString(),
    };

    this.data.conversations.push(conv);
    this.persist();
    return conv;
  }

  public getUserConversations(userId: string): (Conversation & { otherParticipant: SafeUser; lastMessage?: Message })[] {
    const userConvs = this.data.conversations.filter(c => c.participantIds.includes(userId));
    return userConvs
      .filter(c => {
        const otherId = c.participantIds.find(id => id !== userId);
        return otherId && !this.isBlocked(userId, otherId);
      })
      .map(c => {
        const otherId = c.participantIds.find(id => id !== userId)!;
        const otherUser = this.findUserById(otherId)!;
        const msgs = this.data.messages.filter(m => m.conversationId === c.id);
        const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        return {
          ...c,
          otherParticipant: this.toSafeUser(otherUser),
          lastMessage,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public sendMessage(conversationId: string, senderId: string, content: string): Message {
    const conv = this.data.conversations.find(c => c.id === conversationId);
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
    if (!conv.participantIds.includes(senderId)) throw new Error('UNAUTHORIZED');

    const otherParticipantId = conv.participantIds.find(id => id !== senderId);
    if (otherParticipantId && this.isBlocked(senderId, otherParticipantId)) {
      throw new Error('BLOCKED');
    }

    // Real message lifecycle:
    // Message starts as 'sent'. Only becomes 'delivered' when recipient fetches the conversation,
    // and 'read' when recipient explicitly views or acknowledges the thread.
    const message: Message = {
      id: 'm_' + crypto.randomBytes(8).toString('hex'),
      conversationId,
      senderId,
      content: content.trim(),
      deliveryStatus: 'sent',
      createdAt: new Date().toISOString(),
    };

    this.data.messages.push(message);
    conv.updatedAt = message.createdAt;
    this.persist();
    return message;
  }

  public getConversationMessages(conversationId: string, requesterId: string): Message[] {
    const conv = this.data.conversations.find(c => c.id === conversationId);
    if (!conv || !conv.participantIds.includes(requesterId)) {
      throw new Error('UNAUTHORIZED');
    }

    const otherParticipantId = conv.participantIds.find(id => id !== requesterId);
    if (otherParticipantId && this.isBlocked(requesterId, otherParticipantId)) {
      throw new Error('BLOCKED');
    }

    // When the recipient fetches their messages, mark unconfirmed 'sent' messages addressed to them as 'delivered'
    let modified = false;
    for (const m of this.data.messages) {
      if (m.conversationId === conversationId && m.senderId !== requesterId && m.deliveryStatus === 'sent') {
        m.deliveryStatus = 'delivered';
        modified = true;
      }
    }
    if (modified) {
      this.persist();
    }

    return this.data.messages.filter(m => m.conversationId === conversationId);
  }

  public markConversationAsRead(conversationId: string, readerId: string): void {
    const conv = this.data.conversations.find(c => c.id === conversationId);
    if (!conv || !conv.participantIds.includes(readerId)) {
      throw new Error('UNAUTHORIZED');
    }

    let modified = false;
    for (const m of this.data.messages) {
      if (m.conversationId === conversationId && m.senderId !== readerId && m.deliveryStatus !== 'read') {
        m.deliveryStatus = 'read';
        modified = true;
      }
    }
    if (modified) {
      this.persist();
    }
  }
}

export const db = new Database();
