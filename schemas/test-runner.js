// schemas/test-runner.js
import { validateSchema, Type } from '/core/validator.js';
import { schemaRegistry } from '/schemas/registry.js';

export function runAllSchemaTests() {
  console.group('🧪 Running Foundation Schema Test Suite...');
  let totalTests = 0;
  let passedTests = 0;

  function assertTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`%c  ✅ PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  // --- 1. CORE VALIDATOR ENGINE TESTS ---
  console.group('1. Core Validator Unit Tests');

  assertTest('Validator approves correct primitive types', () => {
    const schema = { name: Type.string, age: Type.number, active: Type.boolean };
    validateSchema(schema, { name: 'Alice', age: 30, active: true });
  });

  assertTest('Validator catches invalid primitive type', () => {
    const schema = { age: Type.number };
    try {
      validateSchema(schema, { age: 'thirty' });
      throw new Error('Should have thrown ValidationError');
    } catch (e) {
      if (e.name !== 'ValidationError') throw e;
    }
  });

  assertTest('Validator handles uncalled Type.array and Type.array(Type.string)', () => {
    const schema = { tags: Type.array, skills: Type.array(Type.string) };
    validateSchema(schema, { tags: [1, 2, 3], skills: ['js', 'css'] });
  });

  assertTest('Validator fails Type.array(Type.string) if item types mismatch', () => {
    const schema = { skills: Type.array(Type.string) };
    try {
      validateSchema(schema, { skills: ['js', 123] });
      throw new Error('Should have thrown ValidationError for array items');
    } catch (e) {
      if (e.name !== 'ValidationError') throw e;
    }
  });

  console.groupEnd();

  // --- 2. CONTENT SCHEMA REGISTRY TESTS ---
  console.group('2. Registered Content Schemas Tests');

  // Shared valid mock blocks
  const validAccess = { visibility: 'public' };
  const validMedia = { type: 'image', src: '/assets/img.jpg' };
  const validPreview = { featuredImage: validMedia, teaserText: 'Preview text' };

  // --- A. BLOG SCHEMA ---
  assertTest('Blog Schema: Passes valid payload', () => {
    schemaRegistry.validate({
      type: 'blog',
      id: 'test-blog',
      title: 'Testing Foundation',
      description: 'A test blog post',
      longFormText: ['Paragraph 1'],
      author: 'Tester',
      date: '2026-07-23',
      access: validAccess,
      preview: validPreview
    });
  });

  assertTest('Blog Schema: Catches missing required title', () => {
    try {
      schemaRegistry.validate({
        type: 'blog',
        id: 'bad-blog',
        description: 'Missing title',
        longFormText: ['Text'],
        author: 'Tester',
        date: '2026-07-23'
      });
      throw new Error('Should have failed due to missing title');
    } catch (e) {
      if (e.name !== 'ValidationError') throw e;
    }
  });

  // --- B. ANNOUNCEMENT SCHEMA ---
  assertTest('Announcement Schema: Passes valid payload', () => {
    schemaRegistry.validate({
      type: 'announcement',
      id: 'announcement-1',
      title: 'New Feature Released',
      description: 'Check out our new features',
      date: '2026-07-23',
      access: { visibility: 'authenticated' },
      pinned: true
    });
  });

  // --- C. BOOK SCHEMA ---
  assertTest('Book Schema: Passes valid payload with product info', () => {
    schemaRegistry.validate({
      type: 'book',
      id: 'foundation-book',
      title: 'Zero-Build Web Frameworks',
      description: 'Learn to build without bundlers',
      formats: ['PDF', 'Hardcover'],
      access: validAccess,
      product: { isPurchasable: true, price: 19.99, currency: 'USD' }
    });
  });

  // --- D. EDUCATION SCHEMA ---
  assertTest('Education Schema: Passes valid course with quiz and worksheets', () => {
    schemaRegistry.validate({
      type: 'education',
      id: 'course-101',
      title: 'Vanilla JS Masterclass',
      description: 'Master raw JS',
      access: { visibility: 'paid', requiredTier: 'pro' },
      quizQuestions: [{ id: 'q1', prompt: 'What is DOM?', type: 'text-field' }],
      worksheets: [{ title: 'Exercises', pdfUrl: '/assets/ex.pdf' }]
    });
  });

  // --- E. HOWTO SCHEMA ---
  assertTest('HowTo Schema: Passes valid step-by-step guide', () => {
    schemaRegistry.validate({
      type: 'howto',
      id: 'howto-routing',
      title: 'How to build an SPA router',
      description: 'Learn routing',
      longFormText: ['Step 1: Create Router class', 'Step 2: Add popstate listener'],
      difficulty: 'Intermediate',
      access: validAccess
    });
  });

  // --- F. PODCAST SCHEMA ---
  assertTest('Podcast Schema: Passes valid episode with audio/video', () => {
    schemaRegistry.validate({
      type: 'podcast',
      id: 'pod-ep-12',
      title: 'Episode 12: No-Build Philosophy',
      description: 'Talking zero-build architectures',
      date: '2026-07-23',
      episodeNumber: 12,
      audio: { type: 'audio', src: '/assets/ep12.mp3' },
      access: validAccess
    });
  });

  // --- G. PORTFOLIO SCHEMA ---
  assertTest('Portfolio Schema: Passes valid case study', () => {
    schemaRegistry.validate({
      type: 'portfolio',
      id: 'client-project-a',
      title: 'E-commerce Redesign',
      description: 'Custom frontend build',
      client: 'Acme Corp',
      techStack: ['HTML', 'CSS', 'Vanilla JS'],
      access: validAccess
    });
  });

  // --- H. SPONSOR SCHEMA ---
  assertTest('Sponsor Schema: Passes valid partner deal', () => {
    schemaRegistry.validate({
      type: 'sponsor',
      id: 'sponsor-cloud-hosting',
      title: 'Free Hosting Offer',
      description: 'Get 20% off cloud hosting',
      promoCode: 'FOUNDATION20',
      links: [{ label: 'Claim Offer', url: 'https://example.com/deal', external: true }],
      access: validAccess
    });
  });

  // --- I. EVENT SCHEMA (Live / Google Meet Events) ---
 assertTest('Event Schema: Passes valid live event with Google Meet link & location', () => {
    schemaRegistry.validate({
      type: 'event',
      id: 'live-qa-session',
      title: 'Live Q&A: Zero-Build Frameworks',
      description: 'Interactive Google Meet video session on no-build architecture.',
      eventType: 'google-meet',
      location: 'Google Meet / Main Conference Room 4B',
      date: '2026-07-25',
      startTime: '14:00',
      endTime: '15:00',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      calendarEventId: 'cal_evt_12345',
      access: validAccess,
      preview: validPreview
    });
  });

  assertTest('Event Schema: Catches invalid date/time format or missing eventType', () => {
    try {
      schemaRegistry.validate({
        type: 'event',
        id: 'live-qa-session',
        title: 'Live Q&A: Zero-Build Frameworks',
        description: 'Interactive Google Meet video session on no-build architecture.',
        // eventType is intentionally missing here so validation fails as expected
        date: '2026-07-25',
        startTime: '14:00',
        endTime: '15:00',
        location: 'Google Meet / Main Conference Room 4B',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        calendarEventId: 'cal_evt_12345',
        access: validAccess,
        preview: validPreview
      });
      throw new Error('Should have failed due to missing eventType');
    } catch (e) {
      if (e.name !== 'ValidationError') throw e;
    }
  });

  console.groupEnd();

  // --- SUMMARY ---
  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n📊 Test Suite Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '🎉' : '⚠️'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}