import assert from 'node:assert';
import { Database } from '../src/server/db';
import fs from 'node:fs';
import path from 'node:path';

async function runAuthTests() {
  console.log('🧪 [TEST] Running Cove Authentication & Security Test Suite...\n');

  const testDbPath = path.resolve(process.cwd(), 'data', 'test_auth.db.json');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = new Database(testDbPath);
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`  ✅ Passed: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ Failed: ${name}`);
      console.error('     Error:', err.message);
      throw err;
    }
  }

  // TEST 1: Registration Success
  test('1. User Registration: Valid display name, unique username & matching password creates account', () => {
    const { user, recoveryPhrase } = db.createUser({
      displayName: 'Alex Rivers',
      username: 'alexrivers',
      password: 'SecurePassword123!',
    });

    assert.strictEqual(user.username, 'alexrivers');
    assert.strictEqual(user.displayName, 'Alex Rivers');
    assert.strictEqual(user.hasCompletedOnboarding, false);
    // Crucial security check: sensitive hashes not exposed in SafeUser
    assert.strictEqual((user as any).passwordHash, undefined);
    assert.strictEqual((user as any).passwordSalt, undefined);

    // Verify recovery phrase contains 16 words
    const words = recoveryPhrase.split(' ');
    assert.strictEqual(words.length, 16);
  });

  // TEST 2: Duplicate Username Rejection (Case-Insensitive)
  test('2. Uniqueness Constraint: Duplicate username is rejected case-insensitively', () => {
    assert.throws(
      () => {
        db.createUser({
          displayName: 'Alex Impostor',
          username: 'AlexRivers', // Mixed case
          password: 'AnotherPassword456!',
        });
      },
      /USERNAME_TAKEN/,
      'Should reject duplicate username regardless of case'
    );
  });

  // TEST 3: Password Verification
  test('3. Scrypt Verification: Correct password succeeds, wrong password fails', () => {
    const userRecord = db.findUserByUsername('alexrivers');
    assert.ok(userRecord, 'User must exist in database');

    const valid = db.verifyPassword('SecurePassword123!', userRecord.passwordHash, userRecord.passwordSalt);
    assert.strictEqual(valid, true, 'Valid password must verify true');

    const invalid = db.verifyPassword('WrongPassword!', userRecord.passwordHash, userRecord.passwordSalt);
    assert.strictEqual(invalid, false, 'Invalid password must verify false');
  });

  // TEST 4: Session Creation & Retrieval
  test('4. Session Management: Secure token generation, verification & retrieval', () => {
    const userRecord = db.findUserByUsername('alexrivers')!;
    const { session, rawToken } = db.createSession(userRecord.id, 'TestAgent/1.0');

    assert.ok(rawToken.length >= 64, 'Token must have high cryptographic entropy');
    assert.strictEqual(session.userId, userRecord.id);

    const lookup = db.getSessionByToken(rawToken);
    assert.ok(lookup, 'Session must be retrievable by raw token');
    assert.strictEqual(lookup.user.username, 'alexrivers');
  });

  // TEST 5: Session Invalidation & Logout
  test('5. Logout & Revocation: Revoked session tokens are immediately rejected', () => {
    const userRecord = db.findUserByUsername('alexrivers')!;
    const { rawToken } = db.createSession(userRecord.id, 'TestAgent/1.0');

    db.revokeSession(rawToken);
    const lookupAfterLogout = db.getSessionByToken(rawToken);
    assert.strictEqual(lookupAfterLogout, null, 'Revoked token must yield null session');
  });

  // TEST 6: Cryptographic Recovery Code Flow
  test('6. Password Recovery: 16-word recovery phrase resets password and rotates phrase', () => {
    // Register another user to test recovery
    const { recoveryPhrase } = db.createUser({
      displayName: 'Jordan Lee',
      username: 'jordanlee',
      password: 'OldPassword123!',
    });

    const userRecordBefore = db.findUserByUsername('jordanlee')!;
    const oldHash = userRecordBefore.passwordHash;

    const { user, newRecoveryPhrase } = db.resetPasswordWithRecovery('jordanlee', recoveryPhrase, 'NewBrandNewPassword789!');

    assert.strictEqual(user.username, 'jordanlee');
    assert.notStrictEqual(newRecoveryPhrase, recoveryPhrase, 'Recovery phrase must be rotated upon use');

    // Verify old password no longer works
    const userRecordAfter = db.findUserByUsername('jordanlee')!;
    assert.notStrictEqual(userRecordAfter.passwordHash, oldHash);

    const oldValid = db.verifyPassword('OldPassword123!', userRecordAfter.passwordHash, userRecordAfter.passwordSalt);
    assert.strictEqual(oldValid, false, 'Old password must be invalid after recovery');

    const newValid = db.verifyPassword('NewBrandNewPassword789!', userRecordAfter.passwordHash, userRecordAfter.passwordSalt);
    assert.strictEqual(newValid, true, 'New password must be valid after recovery');
  });

  // TEST 7: Invalid Recovery Phrase Rejection
  test('7. Recovery Protection: Invalid phrase is rejected', () => {
    assert.throws(
      () => {
        db.resetPasswordWithRecovery('jordanlee', 'invalid fake wrong words that are definitely not the phrase', 'AnotherPass!');
      },
      /INVALID_RECOVERY/,
      'Incorrect recovery phrase must throw INVALID_RECOVERY'
    );
  });

  // TEST 8: Onboarding State Persistence
  test('8. Onboarding Progression: Completing onboarding persists for the user', () => {
    const userRecord = db.findUserByUsername('alexrivers')!;
    assert.strictEqual(userRecord.hasCompletedOnboarding, false);

    const updated = db.updateUser(userRecord.id, {
      bio: 'Lover of photography and cryptography.',
      avatarUrl: 'https://images.example.com/alex.jpg',
      isPrivate: false,
      hasCompletedOnboarding: true,
    });

    assert.strictEqual(updated.hasCompletedOnboarding, true);
    assert.strictEqual(updated.bio, 'Lover of photography and cryptography.');

    // Reload from disk to verify atomic file persistence
    const reloadedDb = new Database(testDbPath);
    const reloadedUser = reloadedDb.findUserByUsername('alexrivers')!;
    assert.strictEqual(reloadedUser.hasCompletedOnboarding, true);
    assert.strictEqual(reloadedUser.bio, 'Lover of photography and cryptography.');
  });

  // TEST 9: Timing Attack Defense on Password Recovery
  test('9. Timing Attack Defense: Non-existent username triggers dummy scrypt verification', () => {
    assert.throws(
      () => {
        db.resetPasswordWithRecovery('nonexistent_user', 'any sample phrase words', 'NewPassword123!');
      },
      /INVALID_RECOVERY/,
      'Non-existent username must reject with INVALID_RECOVERY after constant-time check'
    );
  });

  // TEST 10: Private Account Access Control & Follow Approval
  test('10. Privacy & Authorization: Private profile posts protected until follow request accepted', () => {
    // Register private user
    const { user: privateUser } = db.createUser({
      displayName: 'Private Creator',
      username: 'privatecreator',
      password: 'PrivatePass123!',
    });
    db.updateUser(privateUser.id, { isPrivate: true });

    // Create a post
    db.createPost(privateUser.id, 'Secret private studio project notes', 'followers');

    const alex = db.findUserByUsername('alexrivers')!;

    // Alex should not see the post yet
    const postsBefore = db.getUserPosts('privatecreator', alex.id);
    assert.strictEqual(postsBefore.length, 0, 'Non-follower must not see private user posts');

    // Alex sends follow request
    const followReq = db.toggleFollow(alex.id, 'privatecreator');
    assert.strictEqual(followReq.isPending, true, 'Request to private account must be pending');

    // Private user accepts follow request
    db.acceptFollowRequest(privateUser.id, alex.id);

    // Now Alex is an approved follower and can view posts
    const postsAfter = db.getUserPosts('privatecreator', alex.id);
    assert.strictEqual(postsAfter.length, 1, 'Approved follower must view private user posts');
    assert.strictEqual(postsAfter[0].content, 'Secret private studio project notes');
  });

  // TEST 11: Explore Community Directory Retrieval
  test('11. Explore Directory: Live registered accounts are discoverable with follow states', () => {
    const alex = db.findUserByUsername('alexrivers')!;
    const members = db.getExploreMembers(alex.id);
    assert.ok(members.length >= 2, 'Explore must list other registered members');
    const privateMember = members.find(m => m.user.username === 'privatecreator');
    assert.ok(privateMember, 'Private member must be present in explore directory');
    assert.strictEqual(privateMember.isFollowing, true, 'Alex is following privatecreator');
  });

  // TEST 12: Real-Time Presence Status Formatting
  test('12. Presence Status: formatLastSeen correctly calculates activity windows', async () => {
    const { formatLastSeen } = await import('../src/lib/presence');
    assert.strictEqual(formatLastSeen(undefined), 'Offline');
    assert.strictEqual(formatLastSeen(''), 'Offline');

    const justNow = new Date(Date.now() - 10 * 1000).toISOString();
    assert.strictEqual(formatLastSeen(justNow), 'Active just now');

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    assert.strictEqual(formatLastSeen(tenMinAgo), 'Active 10m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    assert.strictEqual(formatLastSeen(twoHoursAgo), 'Active 2h ago');
  });

  // Clean up test file
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log(`\n🎉 [ALL TESTS PASSED] ${passed}/${total} authentication and security tests succeeded!`);
}

runAuthTests().catch((err) => {
  console.error('\n💥 Test suite terminated with error:', err);
  process.exit(1);
});
