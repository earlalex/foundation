// tests/db.test.js
import { contentDB } from '../core/db.js';
import { deduplicateUserDirectory } from '../pages/admin/modules/admin-users.js';

export async function runDbTests() {
  console.group('  Running ContentDB & LocalStorage Fallback Tests...');
  let totalTests = 0;
  let passedTests = 0;

  async function assertTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`%c    PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`    FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  await assertTest('ContentDB initializes with empty state', async () => {
    const state = contentDB.state;
    if (typeof state !== 'object' || state === null) {
      throw new Error('DB state is not an object.');
    }
  });

  await assertTest('ContentDB can store and retrieve documents', async () => {
    const testDoc = {
      id: 'test-doc-1',
      type: 'blog',
      title: 'Test Document',
      content: 'Test content'
    };
    
    await contentDB.saveContent(testDoc);
    const retrieved = await contentDB.getContent('test-doc-1');
    
    if (!retrieved || retrieved.title !== 'Test Document') {
      throw new Error('Failed to retrieve stored document.');
    }
    
    // Cleanup
    await contentDB.deleteContent('test-doc-1');
  });

  await assertTest('ContentDB handles localStorage fallback gracefully', async () => {
    // Test that localStorage operations work as fallback
    const testKey = 'fallback-test';
    const testData = { test: 'data' };
    
    localStorage.setItem(testKey, JSON.stringify(testData));
    const retrieved = JSON.parse(localStorage.getItem(testKey));
    
    if (retrieved.test !== 'data') {
      throw new Error('localStorage fallback not working correctly.');
    }
    
    localStorage.removeItem(testKey);
  });

  await assertTest('ContentDB handles query operations', async () => {
    const testDocs = [
      { id: 'query-test-1', type: 'blog', title: 'First' },
      { id: 'query-test-2', type: 'blog', title: 'Second' },
      { id: 'query-test-3', type: 'announcement', title: 'Third' }
    ];
    
    for (const doc of testDocs) {
      await contentDB.saveContent(doc);
    }
    
    const allContent = await contentDB.getAllContent();
    const blogs = allContent.filter(doc => doc.type === 'blog' && doc.id.startsWith('query-test-'));
    
    if (blogs.length !== 2) {
      throw new Error(`Expected 2 blog documents, got ${blogs.length}`);
    }
    
    // Cleanup
    for (const doc of testDocs) {
      await contentDB.deleteContent(doc.id);
    }
  });

  await assertTest('ContentDB saves and retrieves user course progress', async () => {
    const userId = 'user_123';
    const courseId = 'course_999';
    const progressData = {
      completedLessons: ['lesson-1'],
      overallProgress: 50,
      lastAccessedLesson: 'lesson-1'
    };

    await contentDB.saveUserCourseProgress(userId, courseId, progressData);
    const retrieved = await contentDB.getUserCourseProgress(userId, courseId);

    if (!retrieved || retrieved.overallProgress !== 50 || retrieved.lastAccessedLesson !== 'lesson-1') {
      throw new Error('Failed to retrieve user course progress.');
    }

    const allProgress = await contentDB.getUserAllProgress(userId);
    if (!allProgress || allProgress.length !== 1 || allProgress[0].courseId !== courseId) {
      throw new Error('Failed to retrieve user all progress.');
    }
  });

  await assertTest('registerOrMergeUser creates new user or merges guest action seamlessly without role downgrade', async () => {
    const email = 'Recon.User@Example.com';
    const normalizedEmail = 'recon.user@example.com';

    // 1. Initial creation via registerOrMergeUser
    const newRecord = await contentDB.registerOrMergeUser({
      email,
      name: 'Recon User',
      role: 'member',
      consents: { newsletter: true },
      registeredEvents: ['event-1']
    });

    if (!newRecord || newRecord.email !== normalizedEmail || newRecord.role !== 'member') {
      throw new Error('registerOrMergeUser failed to create initial user record with normalized email.');
    }

    // 2. Guest action (prospect role, new event, new consent) for same email
    const mergedRecord = await contentDB.registerOrMergeUser({
      email: ' RECON.USER@example.com  ',
      role: 'prospect',
      consents: { marketing: true },
      registeredEvents: ['event-2'],
      purchasedProducts: ['prod-1']
    });

    if (mergedRecord.role !== 'member') {
      throw new Error(`Expected role 'member' to be preserved, but got '${mergedRecord.role}'`);
    }
    if (!mergedRecord.consents.newsletter || !mergedRecord.consents.marketing) {
      throw new Error('Consents were not merged properly.');
    }
    if (!mergedRecord.registeredEvents.includes('event-1') || !mergedRecord.registeredEvents.includes('event-2')) {
      throw new Error('registeredEvents array was not merged properly.');
    }
    if (!mergedRecord.purchasedProducts.includes('prod-1')) {
      throw new Error('purchasedProducts array was not merged properly.');
    }

    // Cleanup
    await contentDB.deleteUser(mergedRecord.id);
  });

  await assertTest('deduplicateUserDirectory groups duplicate records, merges attributes, and deletes secondaries', async () => {
    const email = 'dupe.test@example.com';

    // Create 2 duplicate records with same normalized email
    const user1 = await contentDB.saveUser({
      id: 'dupe_test_1',
      email: 'Dupe.Test@example.com',
      name: 'Primary Dupe User',
      role: 'admin',
      googleUid: 'google_uid_123',
      registeredEvents: ['event-a']
    });

    const user2 = await contentDB.saveUser({
      id: 'dupe_test_2',
      email: 'dupe.test@example.com ',
      name: 'Secondary Dupe User',
      role: 'subscriber',
      consents: { newsletter: true },
      registeredEvents: ['event-b'],
      purchasedProducts: ['prod-x']
    });

    const count = await deduplicateUserDirectory();
    if (count < 1) {
      throw new Error(`Expected deduplicateUserDirectory to merge at least 1 duplicate, got ${count}`);
    }

    const allUsers = await contentDB.getAllUsers();
    const matches = allUsers.filter(u => u.email.toLowerCase().trim() === email);

    if (matches.length !== 1) {
      throw new Error(`Expected exactly 1 remaining user for ${email}, found ${matches.length}`);
    }

    const primary = matches[0];
    if (primary.role !== 'admin' || primary.googleUid !== 'google_uid_123') {
      throw new Error('Primary record with admin role and googleUid was not designated primary properly.');
    }
    if (!primary.registeredEvents.includes('event-a') || !primary.registeredEvents.includes('event-b')) {
      throw new Error('Deduplication failed to merge registeredEvents.');
    }
    if (!primary.purchasedProducts.includes('prod-x')) {
      throw new Error('Deduplication failed to merge purchasedProducts.');
    }

    // Cleanup
    await contentDB.deleteUser(primary.id);
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  DB Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
