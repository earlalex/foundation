// tests/db.test.js
import { contentDB } from '../core/db.js';

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
    const blogs = allContent.filter(doc => doc.type === 'blog');
    
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

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  DB Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
