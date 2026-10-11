# Cove — Social Platform & Grounded AI

**Public for discovery; private for conversations — with honest, verifiable privacy claims.**

Cove is a cohesive social and messaging platform built in Google AI Studio. It unites public feed discovery with private 1-to-1 conversations, grounded Gemini intelligence (Google Search & Google Maps), and user-triggered messaging assistance.

---

## Key Features

1. **First-Open Login Experience**:
   * Initial screen for logged-out visitors is a polished Login page (no unauthenticated feed or fake mock account).
   * Username and password fields with visibility controls and rate-limited verification.
2. **Account Registration**:
   * Fields: Name/Display Name, Unique Username handle, Password (8+ characters), and Confirm Password.
   * Real-time password matching validation; confirmation passwords are never persisted or logged.
3. **16-Word Master Recovery Key**:
   * Cryptographically random 16-word passphrase generated at registration.
   * Enables zero-trust account recovery without dependency on external unconfigured email servers.
   * Rotating key upon each successful recovery.
4. **First-Login Skippable Onboarding**:
   * 3-step lightweight onboarding for new members: values introduction, avatar & bio setup, and privacy defaults.
   * Fully skippable at any time.
5. **Public Social Feed**:
   * Post composer with audience selector (Public vs. Followers Only).
   * Feed stream with heart reactions, threaded comments, and zero-pill typographic metadata.
6. **Cove AI Chatbot (Grounding Engine)**:
   * Multi-turn chat powered server-side by `gemini-3.8-flash`.
   * **Google Search Grounding**: Live citations and verifiable external URLs.
   * **Google Maps Grounding**: Place discovery and location attribution.
7. **Private Messaging & AI Assist**:
   * One-to-one conversation inbox.
   * Transparent security status: **`PROTOTYPE ONLY — NOT END-TO-END ENCRYPTED`**.
   * User-triggered AI Assist (drafting, rewriting, translating, summarizing) with explicit disclosure when text leaves the device. Never auto-sends.

---

## Quick Start & Verification

### Running the Application
```bash
npm run dev
```
The server runs on `http://localhost:3000` via Express + Vite middleware.

### Running Authentication & Security Tests
```bash
npm run test:auth
```
Executes the automated test suite verifying password hashing (`scrypt`), timing-attack defenses, session lifecycles, and recovery phrase rotation.
