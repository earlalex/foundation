// core/db-shared.js
import {
  getFirestore,
  collection,
  doc as originalDoc,
  getDoc as originalGetDoc,
  getDocs as originalGetDocs,
  setDoc as originalSetDoc,
  updateDoc as originalUpdateDoc,
  deleteDoc as originalDeleteDoc,
  query,
  where,
  limit,
  writeBatch,
  onSnapshotsInSync
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { schemaRegistry } from '../schemas/registry.js';
import { configManager } from './config.js';
import { store } from './store.js';

export const CONTENT_COLLECTION = 'content';
export const PAGES_COLLECTION = 'pages';
export const USERS_COLLECTION = 'users';
export const CHAT_LOGS_COLLECTION = 'chat_logs';
export const INVOICES_COLLECTION = 'invoices';
export const MARKETING_WORKFLOWS_COLLECTION = 'marketing_workflows';
export const KANBAN_TASKS_COLLECTION = 'kanban_tasks';
export const VAULT_CREDENTIALS_COLLECTION = 'vault_credentials';

export async function withTimeout(promise, ms = 1500) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Firestore operation timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export const getDoc = (docRef) => withTimeout(originalGetDoc(docRef));
export const getDocs = (queryRef) => withTimeout(originalGetDocs(queryRef));
export async function setDoc(docRef, data, options) {
  if (!docRef) {
    console.warn('[DB Shared setDoc]: Called with null/undefined docRef. Bypassing write.');
    return;
  }
  try {
    await withTimeout(originalSetDoc(docRef, data, options));
  } catch (err) {
    console.warn('[DB Shared setDoc]: Write failed or offline. Queueing to outbox:', err.message);
    try {
      const pathParts = docRef && docRef.path ? docRef.path.split('/') : [];
      const collectionName = pathParts[0] || 'unknown';
      const docId = pathParts[1] || (docRef && docRef.id) || 'unknown';

      const outbox = JSON.parse(localStorage.getItem('foundation_outbox') || '[]');
      const filtered = outbox.filter(item => !(item.collection === collectionName && item.docId === docId));
      filtered.push({
        id: `${collectionName}_${docId}_${Date.now()}`,
        collection: collectionName,
        docId: docId,
        data: data,
        options: options || null,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('foundation_outbox', JSON.stringify(filtered));
      console.log(`[DB Shared setDoc]: Queued ${collectionName}/${docId} to /foundation_outbox.`);

      // Quiet Notification Dropdown Logging
      try {
        const history = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');
        history.unshift({
          id: 'notif_outbox_queue_' + Date.now(),
          message: `Outbox Queue: Saved changes for ${collectionName}/${docId} offline.`,
          type: 'info',
          category: 'System Alerts',
          timestamp: new Date().toISOString(),
          isRead: false
        });
        localStorage.setItem('foundation_notification_history', JSON.stringify(history.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('notification-received'));
      } catch (notifErr) {}
    } catch (queueErr) {
      console.error('[DB Shared setDoc]: Failed to queue write to outbox:', queueErr);
    }
  }
}

export async function updateDoc(docRef, data) {
  if (!docRef) {
    console.warn('[DB Shared updateDoc]: Called with null/undefined docRef. Bypassing write.');
    return;
  }
  try {
    await withTimeout(originalUpdateDoc(docRef, data));
  } catch (err) {
    console.warn('[DB Shared updateDoc]: Write failed or offline. Queueing to outbox:', err.message);
    try {
      const pathParts = docRef && docRef.path ? docRef.path.split('/') : [];
      const collectionName = pathParts[0] || 'unknown';
      const docId = pathParts[1] || (docRef && docRef.id) || 'unknown';

      const outbox = JSON.parse(localStorage.getItem('foundation_outbox') || '[]');
      const filtered = outbox.filter(item => !(item.collection === collectionName && item.docId === docId));
      filtered.push({
        id: `${collectionName}_${docId}_${Date.now()}`,
        collection: collectionName,
        docId: docId,
        data: data,
        isUpdate: true,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('foundation_outbox', JSON.stringify(filtered));
      console.log(`[DB Shared updateDoc]: Queued ${collectionName}/${docId} to /foundation_outbox.`);

      try {
        const history = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');
        history.unshift({
          id: 'notif_outbox_queue_' + Date.now(),
          message: `Outbox Queue: Saved changes for ${collectionName}/${docId} offline.`,
          type: 'info',
          category: 'System Alerts',
          timestamp: new Date().toISOString(),
          isRead: false
        });
        localStorage.setItem('foundation_notification_history', JSON.stringify(history.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('notification-received'));
      } catch (notifErr) {}
    } catch (queueErr) {
      console.error('[DB Shared updateDoc]: Failed to queue write to outbox:', queueErr);
    }
  }
}

export async function deleteDoc(docRef) {
  if (!docRef) {
    console.warn('[DB Shared deleteDoc]: Called with null/undefined docRef. Bypassing write.');
    return;
  }
  try {
    await withTimeout(originalDeleteDoc(docRef));
  } catch (err) {
    console.warn('[DB Shared deleteDoc]: Delete failed or offline. Queueing deletion to outbox:', err.message);
    try {
      const pathParts = docRef && docRef.path ? docRef.path.split('/') : [];
      const collectionName = pathParts[0] || 'unknown';
      const docId = pathParts[1] || (docRef && docRef.id) || 'unknown';

      const outbox = JSON.parse(localStorage.getItem('foundation_outbox') || '[]');
      const filtered = outbox.filter(item => !(item.collection === collectionName && item.docId === docId));
      filtered.push({
        id: `${collectionName}_${docId}_${Date.now()}`,
        collection: collectionName,
        docId: docId,
        isDelete: true,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('foundation_outbox', JSON.stringify(filtered));
      console.log(`[DB Shared deleteDoc]: Queued deletion for ${collectionName}/${docId} to /foundation_outbox.`);

      try {
        const history = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');
        history.unshift({
          id: 'notif_outbox_queue_' + Date.now(),
          message: `Outbox Queue: Saved deletion for ${collectionName}/${docId} offline.`,
          type: 'info',
          category: 'System Alerts',
          timestamp: new Date().toISOString(),
          isRead: false
        });
        localStorage.setItem('foundation_notification_history', JSON.stringify(history.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('notification-received'));
      } catch (notifErr) {}
    } catch (queueErr) {
      console.error('[DB Shared deleteDoc]: Failed to queue deletion to outbox:', queueErr);
    }
  }
}

export function queryWith3SecTimeout(promise) {
  promise.catch((err) => {
    console.warn('[DB 1.5s Query Wrapper]: original query rejected post-timeout/settlement:', err.message || err);
  });
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timeout')), 1500))
  ]);
}

export function getFirestoreDB() {
  const currentFbConfig = configManager.current.firebase;
  const isConfigured = currentFbConfig &&
                        currentFbConfig.projectId &&
                        currentFbConfig.projectId !== "YOUR_PROJECT_ID" &&
                        currentFbConfig.projectId !== "demo-foundation-app" &&
                        currentFbConfig.apiKey !== "" &&
                        currentFbConfig.apiKey !== "YOUR_API_KEY";

  if (!isConfigured) {
    return null;
  }

  try {
    return getFirestore();
  } catch (e) {
    console.warn('[DB]: Firestore instance uninitialized.', e);
    return null;
  }
}

// Loader helpers with automated seeding for exactly 1 item per schema type
export function getLocalContent() {
  try {
    let local = JSON.parse(localStorage.getItem('foundation_local_content') || '{}');
    let isSeeded = localStorage.getItem('foundation_content_seeded') === 'true';

    // Auto-migrate: Force re-seeding if tags are missing on existing items
    if (isSeeded && local['welcome-to-foundation-framework'] && !local['welcome-to-foundation-framework'].tags) {
      isSeeded = false;
      localStorage.removeItem('foundation_content_seeded');
      local = {};
    }

    if (!isSeeded) {
      // 1. Blog (blog)
      const sampleBlog = {
        type: 'blog',
        id: 'welcome-to-foundation-framework',
        title: 'Welcome to Foundation Framework',
        description: 'Discover the power of our zero-build modern framework architecture.',
        longFormText: [
          'Foundation is built to simplify web application engineering.',
          'No complex bundlers or build steps required.'
        ],
        author: 'Jane Doe',
        date: '2026-08-01',
        tags: ["Zero-Build", "AI-Tools"],
        access: { visibility: 'public' }
      };

      // 2. Book (book)
      const sampleBook = {
        type: 'book',
        id: 'zero-build-architecture-handbook',
        title: 'Zero-Build Architecture Handbook',
        description: 'Learn the patterns and principles of modern zero-build engineering.',
        isbn: '978-3-16-148410-0',
        formats: ['PDF', 'Epub'],
        tags: ["Zero-Build", "Sovereignty"],
        access: { visibility: 'public' },
        product: {
          isPurchasable: true,
          price: 29.99,
          currency: 'USD',
          stripePriceId: 'price_book_handbook'
        }
      };

      // 3. Education (education)
      const sampleEducation = {
        type: 'education',
        id: 'vanilla-js-professional-course',
        title: 'Vanilla JS Professional Course',
        description: 'Master Vanilla JS, custom reactive stores, and native visual GrapesJS builder flows.',
        tags: ["Vanilla-JS", "Zero-Build", "AI-Tools"],
        access: { visibility: 'public' },
        longFormText: ['Become a professional JS developer.', 'Build high performance applications.'],
        modules: [
          {
            id: 'm1',
            title: 'Module 1: Getting Started',
            lessons: [
              {
                id: 'l1',
                title: 'Lesson 1: Introduction',
                contentType: 'rich-text',
                body: 'Welcome to the Vanilla JS course!',
                requiredRole: 'subscriber'
              }
            ]
          }
        ],
        quizQuestions: [
          {
            id: 'q1',
            prompt: 'What is the primary benefit of zero-build?',
            type: 'multiple-choice',
            options: ['No complex tooling', 'Faster compilation', 'Better security']
          }
        ]
      };

      // 4. Event (event) - Upgraded with Rich Event Schema (Directive 3)
      const sampleEvent = {
        type: 'event',
        id: 'sample-summit',
        title: 'Ascension Avenue Summit 2026',
        slug: 'ascension-summit-2026',
        date: '2026-08-25',
        description: 'Join us at the signature Ascension Avenue Summit of 2026 for high-impact workshops, direct networking, and keynotes on zero-build web technologies and business automation.',
        location: {
          type: 'physical',
          venueName: 'Grand Empowerment Hall',
          address: '123 Elevation Way, San Francisco, CA',
          meetingUrl: ''
        },
        flyerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
        bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
        promoVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ticketTypes: [
          {
            id: 't-early',
            name: 'Early Bird Pass',
            price: 49.00,
            capacity: 30,
            sold: 25,
            description: 'Standard admission at our earliest promotional discount rate.'
          },
          {
            id: 't-gen',
            name: 'General Admission',
            price: 99.00,
            capacity: 100,
            sold: 12,
            description: 'Access to all main stages, networking panels, and standard seating.'
          },
          {
            id: 't-vip',
            name: 'VIP Networking Pass',
            price: 299.00,
            capacity: 20,
            sold: 0,
            description: 'Includes priority front-row seating, exclusive VIP networking luncheon, and official recordings.'
          }
        ],
        vendorPackages: [
          {
            id: 'v-std',
            name: 'Standard Vendor Booth',
            price: 499.00,
            capacity: 10,
            sold: 0,
            perks: ['1x Display Table']
          }
        ],
        sponsorshipPackages: [
          {
            id: 's-head',
            tier: 'Headline Partner',
            price: 2500.00,
            logoPlacement: 'Main Stage',
            complimentaryTickets: 5,
            capacity: 1,
            sold: 0
          }
        ],
        flyerImageUrl: '/assets/images/summit-flyer.jpg',
        agenda: [
          { time: "09:00 AM", title: "Keynote Address", description: "Opening remarks & vision", speaker: "EarlAlex" },
          { time: "11:30 AM", title: "Zero-Build Panel", description: "Building without bundlers", speaker: "Tech Panel" }
        ],
        lineup: {
          hosts: ["EarlAlex"],
          headliners: ["Keynote Guest Speaker"],
          castAndAct: ["Mastermind Mentors"],
          openersAndPerformers: ["Live DJ Set / Musical Guest"]
        },
        ticketing: {
          tiers: [
            { name: "General Admission", price: 49, availableQty: 100 },
            { name: "VIP All-Access", price: 199, availableQty: 20 }
          ]
        },
        accessVisibility: 'public'
      };

      // 5. How-To (howto)
      const sampleHowto = {
        type: 'howto',
        id: 'how-to-deploy-serverless-workers',
        title: 'How to Deploy Serverless Workers',
        description: 'A comprehensive guide on deploying zero-dependency serverless edge workers.',
        longFormText: ['Serverless workers are fast.', 'Learn step by step.'],
        author: 'Jane Doe',
        date: '2026-08-01',
        tags: ["Sovereignty", "AI-Tools"],
        access: { visibility: 'public' }
      };

      // 6. Podcast (podcast)
      const samplePodcast = {
        type: 'podcast',
        id: 'episode-1-the-no-build-philosophy',
        title: 'Episode 1: The No-Build Philosophy',
        description: 'In this episode, we outline our design philosophy and how to break free from bundler fatigue.',
        longFormText: ['Audio transcription available.'],
        author: 'Jane Doe',
        date: '2026-08-01',
        tags: ["Sovereignty", "Live-Summit"],
        access: { visibility: 'public' }
      };

      // 7. Portfolio (portfolio)
      const samplePortfolio = {
        type: 'portfolio',
        id: 'e-commerce-redesign',
        title: 'E-Commerce Redesign',
        description: 'Case study of our high-conversion e-commerce storefront redesign.',
        longFormText: ['The redesign boosted conversion by 45%.'],
        author: 'Jane Doe',
        date: '2026-08-01',
        tags: ["Zero-Build", "Sovereignty"],
        access: { visibility: 'public' }
      };

      // 8. Sponsor (sponsor)
      const sampleSponsor = {
        type: 'sponsor',
        id: 'cloud-hosting-promo',
        title: 'Cloud Hosting Promo',
        description: 'Special partnership hosting promo code for enterprise performance.',
        longFormText: ['Get 3 months free.'],
        promoCode: 'FOUNDATION3',
        expirationDate: '2026-12-31',
        tags: ["AI-Tools", "Live-Summit"],
        access: { visibility: 'public' }
      };

      // 9. Product / Service (product)
      const sampleProduct = {
        type: 'product',
        id: 'handmade-artisan-mug',
        title: 'Handmade Artisan Mug',
        description: 'An elegant, wheel-thrown ceramic mug perfect for your morning brew.',
        longFormText: ['Every single artisan mug is hand-thrown and individually glazed.', 'Features a beautiful speckled texture and smooth lip.'],
        category: 'Handmade Crafts',
        pricing: {
          basePrice: 2400,
          currency: 'USD',
          paymentType: 'full_upfront'
        },
        tags: ["Zero-Build", "Sovereignty"],
        access: { visibility: 'public' },
        isPhysicalProduct: true,
        isHandmade: true,
        sku: 'HND-MUG-001',
        inventory: {
          stockQuantity: 15,
          lowStockThreshold: 3,
          allowBackorders: false,
          trackInventory: true
        },
        craftDetails: {
          materials: ['Ceramic', 'Non-toxic Glaze', 'Eco-clay'],
          productionLeadTime: '3-5 business days',
          dimensions: { length: 4, width: 4, height: 5, unit: 'in' },
          weight: { value: 1.2, unit: 'lbs' }
        },
        variations: [
          { optionName: 'Color', values: ['Matte Black', 'Terracotta', 'Glacier Blue'] },
          { optionName: 'Size', values: ['12 oz', '16 oz'] }
        ],
        shippingOptions: {
          shippingClass: 'Standard Physical',
          allowLocalPickup: true
        },
        enableCryptoPayment: true,
        enableNftCounterpart: true,
        nftMetadata: {
          name: 'Handmade Artisan Mug Certificate of Authenticity',
          description: 'ERC-1155 Digital Certificate verifying authenticity of a wheel-thrown ceramic mug.',
          image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd'
        }
      };

      const samples = [
        sampleBlog, sampleBook, sampleEducation, sampleEvent,
        sampleHowto, samplePodcast, samplePortfolio, sampleSponsor, sampleProduct
      ];

      let updated = false;
      samples.forEach(s => {
        if (!local[s.id]) {
          schemaRegistry.validate(s);
          local[s.id] = s;
          updated = true;
        }
      });

      if (updated) {
        localStorage.setItem('foundation_local_content', JSON.stringify(local));
      }
      localStorage.setItem('foundation_content_seeded', 'true');
    }
    return local;
  } catch (e) {
    console.error('[DB Shared]: Failed to seed default sample items', e);
    return {};
  }
}

export function saveLocalContent(data) {
  localStorage.setItem('foundation_local_content', JSON.stringify(data));
}

export function getLocalPages() {
  try {
    let localPages = JSON.parse(localStorage.getItem('foundation_local_pages') || '{}');
    let seededIds = [];
    try {
      seededIds = JSON.parse(localStorage.getItem('foundation_pages_seeded_ids') || '[]');
    } catch (e) {
      seededIds = [];
    }

    const defaultPages = [
      {
        type: 'page',
        id: 'our-story',
        slug: 'our-story',
        title: 'Our Story',
        compiledHtml: '<div>Our story began with a desire to build simple websites.</div>',
        compiledCss: 'div { padding: 2rem; }',
        access: { visibility: 'public' }
      },
      {
        type: 'page',
        id: 'privacy',
        slug: 'privacy',
        title: 'Privacy Policy',
        compiledHtml: '<div><h2>Privacy Policy</h2><p>Your privacy is important to us. This policy details how we process your personal data.</p></div>',
        compiledCss: 'div { padding: 2rem; }',
        access: { visibility: 'public' }
      },
      {
        type: 'page',
        id: 'terms',
        slug: 'terms',
        title: 'Terms of Service',
        compiledHtml: '<div><h2>Terms of Service</h2><p>By using this platform, you agree to comply with our Terms of Service.</p></div>',
        compiledCss: 'div { padding: 2rem; }',
        access: { visibility: 'public' }
      },
      {
        type: 'page',
        id: 'cookies',
        slug: 'cookies',
        title: 'Cookie Settings & Preferences',
        compiledHtml: '<div><h2>Cookie Policy</h2><p>This page describes how we use cookies to personalize your experience.</p></div>',
        compiledCss: 'div { padding: 2rem; }',
        access: { visibility: 'public' }
      }
    ];

    let updated = false;
    defaultPages.forEach(page => {
      if (!localPages[page.id] && !seededIds.includes(page.id)) {
        try {
          schemaRegistry.validate(page);
          localPages[page.id] = page;
          seededIds.push(page.id);
          updated = true;
        } catch (validationErr) {
          console.warn(`[DB Shared]: Default page ${page.id} validation failed, skipping seed:`, validationErr.message);
          seededIds.push(page.id);
        }
      }
    });

    if (updated) {
      localStorage.setItem('foundation_local_pages', JSON.stringify(localPages));
    }
    localStorage.setItem('foundation_pages_seeded_ids', JSON.stringify(seededIds));

    return localPages;
  } catch (e) {
    console.error('[DB Shared]: Failed to seed default sample pages', e);
    return {};
  }
}

export function saveLocalPages(data) {
  localStorage.setItem('foundation_local_pages', JSON.stringify(data));
}

export function doc(db, ...paths) {
  if (!db) {
    return null;
  }
  try {
    return originalDoc(db, ...paths);
  } catch (err) {
    console.warn('[DB Shared doc]: Failed to create document reference.', err.message);
    return null;
  }
}

export {
  collection,
  query,
  where,
  limit,
  originalGetDoc,
  originalGetDocs,
  originalSetDoc as rawFirebaseSetDoc,
  originalDeleteDoc as rawFirebaseDeleteDoc,
  writeBatch,
  onSnapshotsInSync,
  schemaRegistry,
  configManager,
  store
};
