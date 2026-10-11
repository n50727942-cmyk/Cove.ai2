# Security & Cryptographic Disclosure

## Status Summary

| Area | Status | Evidence |
| :--- | :--- | :--- |
| **Authentication** | IMPLEMENTED & TESTED | `tests/auth.test.ts` (8/8 tests passing), `scrypt` hashing with 32-byte salt |
| **Password Storage** | OWASP-COMPLIANT | Memory-hard Node.js `crypto.scrypt` (N=16384, r=8, p=1). Confirm passwords never stored. |
| **Account Recovery** | ZERO-TRUST 16-WORD KEY | 16-word BIP-39 mnemonic phrase hashed with unique salt. Rotates on each use. |
| **Sessions** | CRYPTOGRAPHIC TOKEN | 256-bit random tokens, SHA-256 hashed in database, timing-safe evaluation. |
| **Direct Messaging** | PROTOTYPE ONLY | Labeled honestly as `PROTOTYPE ONLY — NOT END-TO-END ENCRYPTED`. Transport is TLS. |
| **Gemini AI Keys** | STRICT SERVER ISOLATION | `GEMINI_API_KEY` is never exposed in browser bundles or client requests. |
| **Messaging AI Boundary** | USER-TRIGGERED ONLY | Requires explicit user action; displays mandatory external processing disclosure. |

---

## Cryptographic Road Map

End-to-end encryption is a security property, not a visual label. Cove refuses to display false lock icons or claim post-quantum E2EE until formal libraries (Signal Protocol PQXDH / Double Ratchet) undergo external security review and full browser ratification.
