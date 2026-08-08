// utils/dummyDataGenerator.js - Localized customer profiles, seed data, and AI Dummy Content generator
import { configManager } from '../core/config.js';

/**
 * Fetch structured real-looking user profiles from RandomUser.me API
 * @param {number} count
 * @returns {Promise<Array<{name: string, email: string, avatar: string, location: string}>>}
 */
export async function fetchRandomUserSeeds(count = 5) {
  try {
    const res = await fetch(`https://randomuser.me/api/?results=${count}&inc=name,email,location,picture,cell&noinfo`);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.results.map(u => ({
      name: `${u.name.first} ${u.name.last}`,
      email: u.email,
      avatar: u.picture.medium,
      location: `${u.location.city}, ${u.location.country}`
    }));
  } catch (err) {
    console.warn("[dummyDataGenerator]: RandomUser.me fetch failed, falling back to local seeds:", err.message);
    return generateLocalUserFallback(count);
  }
}

/**
 * Generate localized customer profiles (addresses, phone numbers, occupations) for realistic test orders and bills
 * @param {number} count
 * @returns {Array<{name: string, email: string, phone: string, occupation: string, address: string, city: string, state: string, zip: string, country: string}>}
 */
export function fetchFakeNameSeeds(count = 5) {
  const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson", "Martinez", "Anderson", "Taylor", "Thomas", "Hernandez", "Moore", "Martin", "Jackson", "Thompson", "White"];
  const occupations = ["Software Engineer", "Artisanal Soapmaker", "Life Coach", "Business Consultant", "Graphic Designer", "Yoga Instructor", "Copywriter", "Digital Marketer", "System Administrator", "Wellness Therapist"];
  const streets = ["Innovation Way", "Oak Avenue", "Pine Boulevard", "Maple Lane", "Cedar Court", "Sunset Strip", "Broadway Street", "Market Road", "Washington Dr", "Park Avenue"];
  const cities = [
    { city: "San Francisco", state: "CA", zip: "94105", country: "United States" },
    { city: "Austin", state: "TX", zip: "78701", country: "United States" },
    { city: "New York", state: "NY", zip: "10001", country: "United States" },
    { city: "Chicago", state: "IL", zip: "60601", country: "United States" },
    { city: "Seattle", state: "WA", zip: "98101", country: "United States" },
    { city: "Toronto", state: "ON", zip: "M5V 2T6", country: "Canada" },
    { city: "London", state: "ENG", zip: "EC1A 1BB", country: "United Kingdom" },
    { city: "Sydney", state: "NSW", zip: "2000", country: "Australia" }
  ];

  const results = [];
  for (let i = 0; i < count; i++) {
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${fName} ${lName}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}_${Math.floor(Math.random() * 900) + 100}@example.com`;
    const phone = `+1 (555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    const occupation = occupations[Math.floor(Math.random() * occupations.length)];
    const streetNo = Math.floor(Math.random() * 9900) + 100;
    const street = streets[Math.floor(Math.random() * streets.length)];
    const cityInfo = cities[Math.floor(Math.random() * cities.length)];

    results.push({
      name: fullName,
      email,
      phone,
      occupation,
      address: `${streetNo} ${street}`,
      city: cityInfo.city,
      state: cityInfo.state,
      zip: cityInfo.zip,
      country: cityInfo.country
    });
  }
  return results;
}

/**
 * Local fallback generator for random user profiles
 */
function generateLocalUserFallback(count = 5) {
  const fakeNames = fetchFakeNameSeeds(count);
  const avatars = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
  ];

  return fakeNames.map((user, idx) => ({
    name: user.name,
    email: user.email,
    avatar: avatars[idx % avatars.length],
    location: `${user.city}, ${user.country}`
  }));
}

/**
 * Helper to query Gemini/OpenAI via our secure proxy /api/chat-bot
 */
async function queryAIProxy(systemPrompt, message) {
  try {
    const aiConfig = configManager.current?.aiConfig || {};
    const response = await fetch('/api/chat-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        isAdmin: true,
        aiConfig,
        history: []
      })
    });
    if (!response.ok) throw new Error("AI Proxy response error");
    const data = await response.json();
    return data.reply;
  } catch (err) {
    console.warn("[dummyDataGenerator]: AI Proxy call failed, using high-quality local fallback:", err.message);
    return null;
  }
}

/**
 * Generates tailored customer reviews based on niche and site title
 */
export async function generateAICustomerReviews(siteTitle, niche, count = 5) {
  const users = await fetchRandomUserSeeds(count);
  const reviews = [];

  for (let i = 0; i < count; i++) {
    const user = users[i];
    const systemPrompt = "You are a customer review generator. Write a short, highly realistic 5-star Google review for a business. Keep it under 25-45 words. Output only the plain text of the review comment without any quotation marks or commentary.";
    const message = `Write a 5-star review for the business '${siteTitle}' operating in the niche: '${niche}'. The customer name is ${user.name}. Make it highly relevant to this specific niche.`;

    let reviewText = await queryAIProxy(systemPrompt, message);

    if (!reviewText) {
      // High-quality local fallback tailored to niche
      const fallbackTemplates = getReviewFallbackTemplates(siteTitle, niche, user.name);
      reviewText = fallbackTemplates[i % fallbackTemplates.length];
    }

    reviews.push({
      id: `review_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
      type: 'review',
      title: `Google Review from ${user.name}`,
      author: user.name,
      description: reviewText,
      longFormText: [reviewText],
      rating: 5,
      date: `${i + 1} day${i !== 0 ? 's' : ''} ago`,
      preview: {
        featuredImage: { src: user.avatar }
      },
      access: { visibility: 'public' }
    });
  }

  return reviews;
}

/**
 * Generates tailored products based on niche and site title
 */
export async function generateAITestProducts(siteTitle, niche, count = 5) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const systemPrompt = "You are an AI commerce manager. Draft a realistic product record for a store. Return ONLY a valid JSON string mapping with: { \"title\": \"Product Title\", \"description\": \"Detailed marketing description...\", \"category\": \"Category\", \"price\": 45.00 }";
    const message = `Draft a premium product for the store '${siteTitle}' in the niche: '${niche}'. Item index: ${i + 1} of ${count}. Return ONLY the JSON object, no other text.`;

    let reply = await queryAIProxy(systemPrompt, message);
    let item = null;

    if (reply) {
      try {
        // Strip any backticks or json tags if returned
        const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        item = JSON.parse(cleaned);
      } catch (e) {
        console.warn("[dummyDataGenerator]: Failed to parse AI product JSON:", e);
      }
    }

    if (!item) {
      // Fallback
      const fallbacks = getProductFallbackTemplates(siteTitle, niche);
      item = fallbacks[i % fallbacks.length];
    }

    products.push({
      id: `product_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
      type: 'product',
      title: item.title,
      description: item.description,
      longFormText: [item.description],
      category: item.category || 'Curated Goods',
      price: item.price || 49.99,
      currency: 'USD',
      paymentType: 'full_upfront',
      qty: Math.floor(Math.random() * 80) + 20,
      preview: {
        featuredImage: { src: `https://images.unsplash.com/photo-${getProductImageId(i)}?auto=format&fit=crop&w=400&q=80` }
      },
      access: { visibility: 'public' }
    });
  }

  return products;
}

/**
 * Generates tailored blog posts based on niche and site title
 */
export async function generateAITestBlogs(siteTitle, niche, count = 5) {
  const blogs = [];

  for (let i = 0; i < count; i++) {
    const systemPrompt = "You are a senior copywriter and editor. Draft a full blog post record. Return ONLY a valid JSON string with: { \"title\": \"An amazing article title\", \"description\": \"Catchy short description...\", \"body\": \"Long-form content paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.\" }";
    const message = `Write a high-quality blog post for the site '${siteTitle}' in the niche: '${niche}'. Article index: ${i + 1} of ${count}. Return ONLY the JSON object, no other text.`;

    let reply = await queryAIProxy(systemPrompt, message);
    let item = null;

    if (reply) {
      try {
        const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        item = JSON.parse(cleaned);
      } catch (e) {
        console.warn("[dummyDataGenerator]: Failed to parse AI blog JSON:", e);
      }
    }

    if (!item) {
      const fallbacks = getBlogFallbackTemplates(siteTitle, niche);
      item = fallbacks[i % fallbacks.length];
    }

    blogs.push({
      id: `blog_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
      type: 'blog',
      title: item.title,
      description: item.description,
      longFormText: (item.body || item.longFormText || '').split('\n\n').filter(Boolean),
      author: 'AI Editorial Assistant',
      date: new Date(Date.now() - i * 24 * 3600 * 1000).toLocaleDateString(),
      preview: {
        featuredImage: { src: `https://images.unsplash.com/photo-${getBlogImageId(i)}?auto=format&fit=crop&w=600&q=80` }
      },
      access: { visibility: 'public' }
    });
  }

  return blogs;
}

// Fallback Helper Data Generators
function getReviewFallbackTemplates(siteTitle, niche, authorName) {
  const n = niche.toLowerCase();
  if (n.includes('artisanal') || n.includes('wellness') || n.includes('soap') || n.includes('shop') || n.includes('merchandise')) {
    return [
      `These artisanal items from ${siteTitle} are pure heaven! The craftsmanship is absolutely gorgeous and you can tell everything is handmade with care.`,
      `I am totally obsessed with the scent and texture of these wellness products! Truly top-tier curation and fast delivery. Highly recommend ${siteTitle}!`,
      `Outstanding packaging and incredible quality. This shop has set a new standard for organic wellness. Five stars all the way!`,
      `A beautiful addition to my daily self-care routine. Customer service was super responsive and helpful. Exceptional brand!`,
      `Superb artisanal quality. Worth every single penny. I will definitely be a returning customer for ${siteTitle}!`
    ];
  } else if (n.includes('software') || n.includes('course') || n.includes('education') || n.includes('academy') || n.includes('consulting')) {
    return [
      `The structured curriculum at ${siteTitle} is world-class. It simplified complex zero-build engineering concepts into practical, hands-on modules.`,
      `Exceptional material and extremely clear walkthroughs! This learning pathway saved our team months of unnecessary bundler debugging.`,
      `A game-changer for cloud-native engineers. Highly pedagogical, structured, and packed with practical H5P interactive checklists.`,
      `Truly elite consulting and coaching. The insights provided by ${siteTitle} completely streamlined our tech architecture.`,
      `Highly structured education! Highly recommended for any developer seeking complete sovereignty over their software pipeline.`
    ];
  } else {
    // Default general template
    return [
      `Absolutely spectacular experience with ${siteTitle}! Their dedicated attention to detail and professional support are unmatched.`,
      `Highly recommend their services in ${niche}. Excellent quality, seamless checkout, and warning-free performance!`,
      `A true leader in the industry. Prompt, efficient, and beautifully designed throughout. 10/10!`,
      `Excellent client-focused solutions! We have seen immediate positive results since we started using ${siteTitle}.`,
      `Outstanding curation and wonderful team. A spectacular asset for all our daily operations!`
    ];
  }
}

function getProductFallbackTemplates(siteTitle, niche) {
  const n = niche.toLowerCase();
  if (n.includes('artisanal') || n.includes('wellness') || n.includes('soap') || n.includes('shop') || n.includes('merchandise')) {
    return [
      { title: "Organic Lavender Calm Elixir", description: "Infused with pure organic lavender and cold-pressed jojoba oils to restore skin hydration and soothe active minds before sleep.", category: "Artisanal Skincare", price: 34.00 },
      { title: "Handcrafted Shea Honey Soap Block", description: "Triple-milled artisanal soap block made from pure raw African shea butter and organic wildflower honey for absolute nourishment.", category: "Handmade Soaps", price: 12.50 },
      { title: "Artisanal Eucalyptus Epsom Salt Bath", description: "Harnessing natural eucalyptus botanicals and solar-evaporated sea salts to release muscle fatigue and refresh senses.", category: "Artisanal Bath & Body", price: 22.00 },
      { title: "Therapeutic Rosemary Botanical Balm", description: "A highly concentrated, multi-purpose wellness botanical balm crafted with organic rosemary and tea tree extracts.", category: "Wellness Salves", price: 18.00 },
      { title: "Handmade Organic Beeswax Candle", description: "Individually hand-poured pure beeswax candle emitting a clean, subtle honey scent and warm natural glow.", category: "Artisanal Home Goods", price: 15.00 }
    ];
  } else {
    return [
      { title: "Mastering Zero-Build SPA Architectures", description: "A comprehensive developer course detailing SPA routing, state design, and edge serverless caching without bundling tools.", category: "Software Courses", price: 49.00 },
      { title: "Data Sovereignty & Security Toolkit", description: "Detailed checklists, templates, and compliance guides to protect user PII and secure edge credentials securely.", category: "Developer Tools", price: 79.00 },
      { title: "1-on-1 Elite Architecture Strategy Session", description: "Private strategic consultation with a principal architect to review serverless workloads, databases, and scaling plans.", category: "Consulting", price: 150.00 },
      { title: "Modular Component Design Blueprint Bundle", description: "Ready-to-use, native Web Component blueprints for visual editors, responsive grids, and checkout gateways.", category: "Skins & Elements", price: 29.00 },
      { title: "AI-Driven Automation Workflow Suite", description: "Advanced system scripts to orchestrate autonomous background shift audits and secure Wise payroll drafting.", category: "Developer Tools", price: 99.00 }
    ];
  }
}

function getBlogFallbackTemplates(siteTitle, niche) {
  return [
    {
      title: "Sovereign Web Engineering: Going Zero-Build",
      description: "Why modern frameworks are shifting away from heavy bundlers and returning to pristine native ES standards.",
      body: "Over the past decade, web developers have accepted massive node_modules folders and complex build chains as an inevitable cost of building modern applications. However, native browser support for ES Modules has changed the game.\n\nBy building without bundlers, we completely eliminate build steps, transpilers, and compilation times. Pages load instantly, the console remains 100% clean, and debugging is straight-forward.\n\nSovereign engineering empowers teams to focus purely on quality, standard compliance, and serverless edge deployments."
    },
    {
      title: "The Ultimate Self-Care Routine for Modern Developers",
      description: "How incorporating organic wellness and body hydration improves cognitive focus and blocks mental burnout.",
      body: "Long hours at the keyboard, complex architecture design, and critical live deployments can easily exhaust a developer's cognitive battery.\n\nWellness is not just about relaxation—it is a critical tool for performance. Simple additions like therapeutic lavender elixirs, natural mineral bath salts, and botanical rosewood balms help release accumulated muscle tension.\n\nInvest in your health to ensure your mind stays sharp, focused, and ready to solve complex serverless pipelines."
    },
    {
      title: "Orchestrating Autonomous Operations with AI Agents",
      description: "How serverless AI co-pilots manage background audits, monitor inventories, and draft contractor disbursements cleanly.",
      body: "Automation is shifting from static cron jobs to intelligent, context-aware co-pilots that operate continuously inside secure database boundaries.\n\nUsing lightweight serverless edge endpoints paired with Google Gemini 2.5 Flash, businesses can audit compliance files, inspect physical stocks, and flag anomalies without consuming permanent server overhead.\n\nAutonomous co-pilots handle repetitive backoffice operations safely, letting business leads focus on high-level strategy."
    },
    {
      title: "Securing ePHI and Customer Data in Cloud-Native Apps",
      description: "Practical guide to implementing localized AES-GCM data encryption and zero-visibility credentials masking.",
      body: "Data privacy is a core architectural pillar, not a secondary feature. Protecting sensitive customer profiles and billing information requires a Zero Trust database design.\n\nBy encrypting data directly inside the browser using native cryptographic Web APIs before synchronizing to remote databases, we ensure complete user privacy.\n\nPairing this with automated, immutable audit logs guarantees HIPAA compliance and protects records from unauthorized access."
    },
    {
      title: "Designing for Web Accessibility: Contrast & Layout Guides",
      description: "Ensuring your single-page applications are fully inclusive, screen-reader optimized, and keyboard-friendly.",
      body: "A truly modern platform must be reachable by everyone. Ensuring your forms, buttons, and layouts are screen-reader accessible is a legal and moral obligation.\n\nThis begins with standard landmarks, semantic tags, and matching all input fields with clear labels and ARIA descriptors.\n\nProviding high-contrast focus rings and live announcement regions ensures that visual transition states are gracefully communicated to keyboard-reliant visitors."
    }
  ];
}

function getProductImageId(i) {
  const ids = ["1515688594396-46402e50f544", "1608248597279-f99d160bfcbc", "1540555700478-4be289fbecef", "1608248597279-f99d160bfcbc", "1526170375885-4d8ecf77b99f"];
  return ids[i % ids.length];
}

function getBlogImageId(i) {
  const ids = ["1516321318423-f06f85e504b3", "1544367567-0f2fcb009e0b", "1485827404703-89b55fcc595e", "1504868584819-f8e8b4b6d7e3", "1508962914676-134849a727f0"];
  return ids[i % ids.length];
}
