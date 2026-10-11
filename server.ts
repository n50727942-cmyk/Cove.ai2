import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db, SafeUser } from './src/server/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Security Headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// In-memory sliding window rate limiter
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

const rateLimit = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);
    if (!record || now > record.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({ error: `Too many requests. Please wait ${retryAfter} seconds before trying again.` });
      return;
    }

    record.count++;
    next();
  };
};

function isValidHttpUrl(str: string): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Express Auth augmentation
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      sessionToken?: string;
    }
  }
}

// Authentication extraction middleware
const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/cove_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    const sessionData = db.getSessionByToken(token);
    if (sessionData) {
      req.user = sessionData.user;
      req.sessionToken = token;
    }
  }

  next();
};

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

app.use(authenticate);

// ==========================================
// REAL-TIME PRESENCE SERVICE
// ==========================================

interface PresenceEntry {
  userId: string;
  username: string;
  lastSeen: number; // ms
  activeConnections: Set<Response>;
}

class PresenceService {
  private presence = new Map<string, PresenceEntry>();
  private allStreams = new Set<Response>();

  constructor() {
    // Seed realistic baseline presence for exploratory profiles
    const now = Date.now();
    this.presence.set('u_maya', {
      userId: 'u_maya',
      username: 'maya_zen',
      lastSeen: now - 4 * 60 * 1000, // 4m ago
      activeConnections: new Set(),
    });
    this.presence.set('u_dev_elena', {
      userId: 'u_dev_elena',
      username: 'dev_elena',
      lastSeen: now - 18 * 60 * 1000, // 18m ago
      activeConnections: new Set(),
    });
    this.presence.set('u_kai', {
      userId: 'u_kai',
      username: 'kai_orbit',
      lastSeen: now - 72 * 60 * 1000, // 1h ago
      activeConnections: new Set(),
    });

    // Send keepalive comment to SSE streams every 15 seconds
    setInterval(() => {
      this.pingAll();
    }, 15000);
  }

  public addClient(user: SafeUser, res: Response) {
    let entry = this.presence.get(user.id);
    const wasOnline = this.isUserOnline(user.id);

    if (!entry) {
      entry = {
        userId: user.id,
        username: user.username,
        lastSeen: Date.now(),
        activeConnections: new Set(),
      };
      this.presence.set(user.id, entry);
    }

    entry.lastSeen = Date.now();
    entry.activeConnections.add(res);
    this.allStreams.add(res);

    if (!wasOnline) {
      this.broadcast({
        type: 'presence:update',
        userId: user.id,
        username: user.username,
        isOnline: true,
        lastSeen: new Date(entry.lastSeen).toISOString(),
      });
    }

    // Send initial snapshot
    const snapshot = this.getSnapshot();
    res.write(`event: presence:init\ndata: ${JSON.stringify(snapshot)}\n\n`);

    res.on('close', () => {
      this.removeClient(user.id, res);
    });
  }

  public heartbeat(user: SafeUser) {
    let entry = this.presence.get(user.id);
    const wasOnline = this.isUserOnline(user.id);

    if (!entry) {
      entry = {
        userId: user.id,
        username: user.username,
        lastSeen: Date.now(),
        activeConnections: new Set(),
      };
      this.presence.set(user.id, entry);
    }
    entry.lastSeen = Date.now();

    if (!wasOnline) {
      this.broadcast({
        type: 'presence:update',
        userId: user.id,
        username: user.username,
        isOnline: true,
        lastSeen: new Date(entry.lastSeen).toISOString(),
      });
    }
  }

  public removeClient(userId: string, res: Response) {
    this.allStreams.delete(res);
    const entry = this.presence.get(userId);
    if (!entry) return;

    entry.activeConnections.delete(res);
    entry.lastSeen = Date.now();

    if (entry.activeConnections.size === 0) {
      this.broadcast({
        type: 'presence:update',
        userId: entry.userId,
        username: entry.username,
        isOnline: false,
        lastSeen: new Date(entry.lastSeen).toISOString(),
      });
    }
  }

  public isUserOnline(userId: string): boolean {
    const entry = this.presence.get(userId);
    if (!entry) return false;
    if (entry.activeConnections.size > 0) return true;
    return Date.now() - entry.lastSeen < 45000;
  }

  public getUserPresence(userId: string): { isOnline: boolean; lastSeen: string } {
    const entry = this.presence.get(userId);
    if (!entry) {
      return { isOnline: false, lastSeen: new Date(0).toISOString() };
    }
    return {
      isOnline: this.isUserOnline(userId),
      lastSeen: new Date(entry.lastSeen).toISOString(),
    };
  }

  public getSnapshot(): Record<string, { isOnline: boolean; lastSeen: string }> {
    const snapshot: Record<string, { isOnline: boolean; lastSeen: string }> = {};
    for (const [userId, entry] of this.presence.entries()) {
      snapshot[userId] = {
        isOnline: this.isUserOnline(userId),
        lastSeen: new Date(entry.lastSeen).toISOString(),
      };
    }
    return snapshot;
  }

  private broadcast(data: any) {
    const msg = `event: presence:update\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.allStreams) {
      try {
        client.write(msg);
      } catch {
        this.allStreams.delete(client);
      }
    }
  }

  private pingAll() {
    for (const client of this.allStreams) {
      try {
        client.write(': ping\n\n');
      } catch {
        this.allStreams.delete(client);
      }
    }
  }
}

const presenceService = new PresenceService();

// ==========================================
// AUTHENTICATION & RECOVERY API
// ==========================================

// Register
app.post('/api/auth/register', rateLimit(10, 60000), (req: Request, res: Response) => {
  try {
    const { displayName, username, password, confirmPassword } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      res.status(400).json({ error: 'Display name is required (max 50 characters)' });
      return;
    }
    if (displayName.trim().length > 50) {
      res.status(400).json({ error: 'Display name cannot exceed 50 characters' });
      return;
    }

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Password and confirmation password do not match' });
      return;
    }

    try {
      const { user, recoveryPhrase } = db.createUser({
        displayName: displayName.trim(),
        username: cleanUsername,
        password,
      });

      const { rawToken } = db.createSession(user.id, req.headers['user-agent']);

      res.setHeader('Set-Cookie', `cove_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
      res.status(201).json({
        user,
        sessionToken: rawToken,
        recoveryPhrase,
      });
    } catch (err: any) {
      if (err.message === 'USERNAME_TAKEN') {
        res.status(409).json({ error: 'This username is already taken. Please choose another.' });
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error('[AUTH] Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Login
app.post('/api/auth/login', rateLimit(15, 60000), (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.findUserByUsername(cleanUsername);

    if (!user) {
      // Run dummy verification to prevent timing attacks
      db.verifyPassword(password, '00'.repeat(64), '00'.repeat(32));
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const isValid = db.verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { rawToken } = db.createSession(user.id, req.headers['user-agent']);
    const safeUser = db.toSafeUser(user);

    res.setHeader('Set-Cookie', `cove_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
    res.status(200).json({
      user: safeUser,
      sessionToken: rawToken,
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login' });
  }
});

// Current User Me
app.get('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.status(200).json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  if (req.sessionToken) {
    db.revokeSession(req.sessionToken);
  }
  res.setHeader('Set-Cookie', 'cove_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.status(200).json({ success: true });
});

// Recover Password
app.post('/api/auth/recover', rateLimit(10, 60000), (req: Request, res: Response) => {
  try {
    const { username, recoveryPhrase, newPassword, confirmPassword } = req.body;

    if (!username || !recoveryPhrase || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'All recovery fields are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password and confirmation do not match' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    try {
      const { user, newRecoveryPhrase } = db.resetPasswordWithRecovery(cleanUsername, recoveryPhrase, newPassword);
      const { rawToken } = db.createSession(user.id, req.headers['user-agent']);

      res.setHeader('Set-Cookie', `cove_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
      res.status(200).json({
        user,
        sessionToken: rawToken,
        newRecoveryPhrase,
        message: 'Password successfully reset. Older sessions have been revoked.',
      });
    } catch (err: any) {
      res.status(401).json({ error: 'Invalid recovery code or username' });
    }
  } catch (err) {
    console.error('[AUTH] Recovery error:', err);
    res.status(500).json({ error: 'Password recovery failed' });
  }
});

// ==========================================
// ONBOARDING & PROFILE API
// ==========================================

app.post('/api/users/onboarding', requireAuth, (req: Request, res: Response) => {
  try {
    const { bio, avatarUrl, isPrivate } = req.body;
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
      if (!isValidHttpUrl(avatarUrl.trim())) {
        res.status(400).json({ error: 'Avatar URL must be a valid http or https URL' });
        return;
      }
    }

    const updated = db.updateUser(req.user!.id, {
      bio: typeof bio === 'string' ? bio : undefined,
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : undefined,
      isPrivate: typeof isPrivate === 'boolean' ? isPrivate : undefined,
      hasCompletedOnboarding: true,
    });
    res.status(200).json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Explore Active Members
app.get('/api/explore/members', (req: Request, res: Response) => {
  const members = db.getExploreMembers(req.user?.id);
  res.status(200).json({ members });
});

// User Stats
app.get('/api/users/me/stats', requireAuth, (req: Request, res: Response) => {
  const stats = db.getUserStats(req.user!.id);
  res.status(200).json({ stats });
});

// Follow Requests (for private profiles)
app.get('/api/users/me/follow-requests', requireAuth, (req: Request, res: Response) => {
  const requests = db.getFollowRequests(req.user!.id);
  res.status(200).json({ requests });
});

app.post('/api/users/follow-requests/:followerId/accept', requireAuth, (req: Request, res: Response) => {
  try {
    db.acceptFollowRequest(req.user!.id, req.params.followerId);
    res.status(200).json({ success: true });
  } catch {
    res.status(404).json({ error: 'Follow request not found' });
  }
});

app.post('/api/users/follow-requests/:followerId/reject', requireAuth, (req: Request, res: Response) => {
  try {
    db.rejectFollowRequest(req.user!.id, req.params.followerId);
    res.status(200).json({ success: true });
  } catch {
    res.status(404).json({ error: 'Follow request not found' });
  }
});

// Specific User Posts
app.get('/api/users/:username/posts', (req: Request, res: Response) => {
  try {
    const posts = db.getUserPosts(req.params.username, req.user?.id);
    res.status(200).json({ posts });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

app.get('/api/users/:username', (req: Request, res: Response) => {
  const user = db.findUserByUsername(req.params.username);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const safe = db.toSafeUser(user);
  const isFollowing = req.user ? db.isFollowing(req.user.id, user.id) : false;
  const followStatus = req.user ? db.getFollowStatus(req.user.id, user.id) : { isFollowing: false, isPending: false };
  const stats = db.getUserStats(user.id);
  const presence = presenceService.getUserPresence(user.id);

  res.status(200).json({
    user: {
      ...safe,
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
    },
    isFollowing,
    isPending: followStatus.isPending,
    stats,
  });
});

app.post('/api/users/:username/follow', requireAuth, (req: Request, res: Response) => {
  try {
    const result = db.toggleFollow(req.user!.id, req.params.username);
    res.status(200).json(result);
  } catch (err: any) {
    if (err.message === 'CANNOT_FOLLOW_SELF') {
      res.status(400).json({ error: 'You cannot follow yourself' });
      return;
    }
    res.status(404).json({ error: 'User not found' });
  }
});

// ==========================================
// SOCIAL POSTS & FEED API
// ==========================================

app.get('/api/posts', (req: Request, res: Response) => {
  const viewerId = req.user ? req.user.id : undefined;
  const feed = db.getFeed(viewerId);
  res.status(200).json({ posts: feed });
});

app.post('/api/posts', requireAuth, (req: Request, res: Response) => {
  const { content, audience } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Post content cannot be empty' });
    return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: 'Post exceeds 2000 character limit' });
    return;
  }
  const validAudience = audience === 'followers' ? 'followers' : 'public';
  const post = db.createPost(req.user!.id, content, validAudience);
  res.status(201).json({ post: { ...post, author: req.user!, hasLiked: false } });
});

app.post('/api/posts/:id/react', requireAuth, (req: Request, res: Response) => {
  try {
    const result = db.toggleLike(req.params.id, req.user!.id);
    res.status(200).json(result);
  } catch {
    res.status(404).json({ error: 'Post not found' });
  }
});

app.post('/api/posts/:id/comments', requireAuth, (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment cannot be empty' });
      return;
    }
    const comment = db.addComment(req.params.id, req.user!.id, content);
    res.status(201).json({ comment });
  } catch {
    res.status(404).json({ error: 'Post not found' });
  }
});

app.get('/api/posts/:id/comments', (req: Request, res: Response) => {
  const comments = db.getPostComments(req.params.id);
  res.status(200).json({ comments });
});

app.post('/api/safety/action', requireAuth, (req: Request, res: Response) => {
  try {
    const { targetId, actionType, reason } = req.body;
    if (!['block', 'mute', 'report'].includes(actionType)) {
      res.status(400).json({ error: 'Invalid safety action type' });
      return;
    }
    db.recordSafetyAction(req.user!.id, targetId, actionType, reason);
    res.status(200).json({ success: true, message: `Action '${actionType}' recorded.` });
  } catch {
    res.status(400).json({ error: 'Invalid action target' });
  }
});

// ==========================================
// MESSAGING API (PROTOTYPE ONLY - NOT E2EE)
// ==========================================

app.get('/api/conversations', requireAuth, (req: Request, res: Response) => {
  const convs = db.getUserConversations(req.user!.id);
  const withPresence = convs.map((c) => {
    const presence = presenceService.getUserPresence(c.otherParticipant.id);
    return {
      ...c,
      otherParticipant: {
        ...c.otherParticipant,
        isOnline: presence.isOnline,
        lastSeen: presence.lastSeen,
      },
    };
  });
  res.status(200).json({ conversations: withPresence, securityStatus: 'PROTOTYPE ONLY — NOT END-TO-END ENCRYPTED' });
});

app.post('/api/conversations', requireAuth, (req: Request, res: Response) => {
  try {
    const { targetUsername } = req.body;
    const targetUser = db.findUserByUsername(targetUsername);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }
    const conv = db.getOrCreateConversation(req.user!.id, targetUser.id);
    const presence = presenceService.getUserPresence(targetUser.id);
    const targetWithPresence = {
      ...db.toSafeUser(targetUser),
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
    };
    res.status(200).json({ conversation: conv, targetUser: targetWithPresence });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Real-Time Presence SSE Stream
app.get('/api/presence/stream', requireAuth, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  presenceService.addClient(req.user!, res);
});

// Presence Heartbeat
app.post('/api/presence/heartbeat', requireAuth, (req: Request, res: Response) => {
  presenceService.heartbeat(req.user!);
  res.status(200).json({ ok: true, isOnline: true });
});

// Presence Status Snapshot
app.get('/api/presence/status', (_req: Request, res: Response) => {
  res.status(200).json({ presence: presenceService.getSnapshot() });
});

app.get('/api/conversations/:id/messages', requireAuth, (req: Request, res: Response) => {
  try {
    const messages = db.getConversationMessages(req.params.id, req.user!.id);
    res.status(200).json({ messages });
  } catch {
    res.status(403).json({ error: 'Unauthorized to view this conversation' });
  }
});

app.post('/api/conversations/:id/messages', requireAuth, (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }
    const message = db.sendMessage(req.params.id, req.user!.id, content);
    res.status(201).json({ message });
  } catch {
    res.status(403).json({ error: 'Unauthorized to send to this conversation' });
  }
});

// ==========================================
// GEMINI AI & GROUNDING API (SERVER ONLY)
// ==========================================

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

function isQuotaError(err: any): boolean {
  if (!err) return false;
  const str = (typeof err === 'string' ? err : (err.message || '') + ' ' + JSON.stringify(err)).toLowerCase();
  return (
    err.status === 429 ||
    err.status === 'RESOURCE_EXHAUSTED' ||
    err.statusCode === 429 ||
    err.code === 429 ||
    str.includes('429') ||
    str.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('rate-limit') ||
    str.includes('rate limit')
  );
}

// Cove AI Chatbot (with conditional Google Search or Google Maps grounding & quota resiliency)
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { prompt, history, mode, enableSearch, enableMaps } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    if (prompt.length > 4000) {
      res.status(400).json({ error: 'Prompt exceeds 4000 character limit' });
      return;
    }

    const ai = getAiClient();
    const model = 'gemini-3.8-flash';

    // Tool Routing governed by user controls:
    let tools: any[] | undefined = undefined;
    const lowerPrompt = prompt.toLowerCase();

    // Check if user explicitly toggled Search grounding
    if (enableSearch === true || mode === 'search') {
      tools = [{ googleSearch: {} }];
    } else if (enableMaps === true || mode === 'maps') {
      tools = [{ googleMaps: {} }];
    } else if (enableSearch === false) {
      // User explicitly turned search grounding OFF -> no search tool
      tools = undefined;
    } else {
      // Auto detect if neither explicitly toggled
      const isLocationIntent = /\b(where is|directions to|nearby|restaurant|cafe|hotel|city|address|map of|located in)\b/i.test(lowerPrompt);
      const isSearchIntent = /\b(latest|news|recent|weather|price|who is|what happened|2025|2026|today|update|research)\b/i.test(lowerPrompt);

      if (isLocationIntent) {
        tools = [{ googleMaps: {} }];
      } else if (isSearchIntent) {
        tools = [{ googleSearch: {} }];
      }
    }

    const systemInstruction = `You are Cove AI, a thoughtful, clear assistant inside the Cove social platform.
Cove stands for public discovery and private conversations with honest technology.
Provide concise, accurate, helpful answers. When sources or places are returned via tools, present them cleanly.
Never hallucinate citations or pretend you accessed user private direct messages.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h.role && h.text) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          });
        }
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    let response: any;
    let effectiveTools = tools;
    let fallbackNotice: string | undefined = undefined;

    try {
      response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          tools: effectiveTools,
        },
      });
    } catch (err: any) {
      if (isQuotaError(err)) {
        console.warn('[AI] Primary request hit quota / rate limit (429). Attempting graceful fallback...');

        // Step 1: If search or maps tools were requested, retry without tools
        // (Tool Grounding quotas are much stricter than raw text generation)
        if (effectiveTools && effectiveTools.length > 0) {
          try {
            effectiveTools = undefined;
            fallbackNotice = 'Search grounding quota was exceeded; answered with general knowledge.';
            response = await ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction,
              },
            });
          } catch (retryErr: any) {
            if (!isQuotaError(retryErr)) {
              throw retryErr;
            }
          }
        }

        // Step 2: Try lightweight model gemini-3.1-flash-lite
        if (!response) {
          try {
            effectiveTools = undefined;
            fallbackNotice = 'Answered via Gemini Flash Lite due to high traffic.';
            response = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: {
                systemInstruction,
              },
            });
          } catch (liteErr: any) {
            if (!isQuotaError(liteErr)) {
              throw liteErr;
            }
          }
        }

        // Step 3: If all Gemini model quotas are exhausted on the key, return structured fallback without crashing
        if (!response) {
          const cleanTopic = prompt.replace(/[^\w\s]/g, '').trim().slice(0, 50);
          res.status(200).json({
            text: `⚠️ **Gemini API Rate Limit Reached (429 Resource Exhausted)**\n\nThe Google Gemini API service is currently experiencing high demand or quota limits on this environment.\n\n**Quick Tips:**\n• Toggle **Search Grounding OFF** using the switch above to reduce quota consumption.\n• Wait approximately 30-60 seconds for the current rate-limit window to refresh.\n• You can also explore real posts and members under the **Explore** tab in the meantime.\n\n*Your query about "${cleanTopic}" has been received.*`,
            toolUsed: 'none',
            sources: [],
            searchQueries: [],
            isQuotaFallback: true,
            warning: 'Gemini API quota reached. Please wait a moment or toggle off Search Grounding.',
          });
          return;
        }
      } else {
        throw err;
      }
    }

    const text = response?.text || '';
    const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;

    // Extract search citations if present
    const webSources: { title?: string; uri?: string }[] = [];
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          webSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }
    }

    // Extract search queries if present
    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    const toolUsed = effectiveTools?.some((t: any) => 'googleSearch' in t)
      ? 'search'
      : effectiveTools?.some((t: any) => 'googleMaps' in t)
      ? 'maps'
      : 'none';

    res.status(200).json({
      text,
      toolUsed,
      sources: webSources,
      searchQueries,
      warning: fallbackNotice,
    });
  } catch (err: any) {
    if (isQuotaError(err)) {
      res.status(200).json({
        text: `⚠️ **Gemini API Rate Limit (429)**: Quota limits reached. Please toggle off Search Grounding or try again in a few moments.`,
        toolUsed: 'none',
        sources: [],
        searchQueries: [],
        isQuotaFallback: true,
        warning: 'Gemini API quota exceeded.',
      });
      return;
    }
    console.error('[AI] Chat error:', err.message || err);
    res.status(500).json({
      error: 'AI assistant service temporarily unavailable',
      details: err.message,
    });
  }
});

// Voice Input Audio Transcription
app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType } = req.body;
    if (!audioData || typeof audioData !== 'string') {
      res.status(400).json({ error: 'Audio data is required' });
      return;
    }

    const ai = getAiClient();
    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioData,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          { text: 'Transcribe this voice audio accurately into clear text. Return ONLY the transcribed text without preambles or explanations.' }
        ]
      },
    });

    const transcript = response.text?.trim() || '';
    res.status(200).json({ text: transcript });
  } catch (err: any) {
    if (isQuotaError(err)) {
      console.warn('[AI] Transcribe quota reached (429)');
      res.status(200).json({
        text: '',
        warning: 'Audio transcription quota limit reached. Please type your query or use native speech recognition.',
      });
      return;
    }
    console.error('[AI] Transcribe error:', err.message || err);
    res.status(500).json({ error: 'Audio transcription failed', details: err.message });
  }
});

// Messaging AI Assist (Drafting, rewriting, translating, summarizing explicitly selected text)
app.post('/api/ai/message-assist', requireAuth, async (req: Request, res: Response) => {
  try {
    const { action, text, tone, targetLanguage } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Text content is required for AI assistance' });
      return;
    }

    if (text.length > 2000) {
      res.status(400).json({ error: 'Selected text cannot exceed 2000 characters' });
      return;
    }

    const ai = getAiClient();
    let promptInstruction = '';

    switch (action) {
      case 'rewrite':
        promptInstruction = `Rewrite the following draft to be ${tone || 'clear and polite'}. Return ONLY the revised draft without introductory remarks: "${text}"`;
        break;
      case 'shorten':
        promptInstruction = `Make the following message concise and direct while preserving its core intent. Return ONLY the revised draft: "${text}"`;
        break;
      case 'translate':
        promptInstruction = `Translate the following text accurately into ${targetLanguage || 'Spanish'}. Return ONLY the translation: "${text}"`;
        break;
      case 'summarize':
        promptInstruction = `Summarize the key points of the following message in 1-2 bullet points: "${text}"`;
        break;
      case 'draft_reply':
        promptInstruction = `Draft a thoughtful, respectful reply based on this note: "${text}". Return ONLY the reply text:`;
        break;
      default:
        promptInstruction = `Improve the clarity and flow of the following message: "${text}"`;
    }

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptInstruction,
        config: {
          systemInstruction: 'You are an assistive editor inside Cove private messaging. Produce natural, human-sounding drafts. Never output conversational filler or preamble.',
        },
      });
    } catch (err: any) {
      if (isQuotaError(err)) {
        console.warn('[AI] Message assist quota reached (429), using fallback');
        let fallback = text;
        if (action === 'shorten') {
          const sentences = text.split(/(?<=[.?!])\s+/);
          fallback = sentences.slice(0, 2).join(' ') || text.slice(0, 80);
        } else if (action === 'rewrite') {
          fallback = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
        } else if (action === 'draft_reply') {
          fallback = `Thank you for sharing this! I appreciate your message and will review it shortly.`;
        } else if (action === 'summarize') {
          fallback = `• Key point: ${text.slice(0, 100)}...`;
        }
        res.status(200).json({
          suggestion: fallback,
          warning: 'AI assist quota limit reached. A baseline edit was generated.',
        });
        return;
      }
      throw err;
    }

    const suggestion = response.text || '';
    res.status(200).json({ suggestion });
  } catch (err: any) {
    console.error('[AI] Assist error:', err.message || err);
    res.status(500).json({ error: 'AI assist failed', details: err.message });
  }
});

// ==========================================
// VITE SPA STATIC / MIDDLEWARE SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[COVE] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[COVE] Server failed to start:', err);
  process.exit(1);
});
