// functions/api/sitemap.js

const staticRoutes = [
  { path: '/home', priority: '1.0', changefreq: 'daily' },
  { path: '/docs', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', priority: '0.8', changefreq: 'weekly' },
  { path: '/events', priority: '0.8', changefreq: 'weekly' },
  { path: '/education', priority: '0.8', changefreq: 'weekly' },
  { path: '/podcast', priority: '0.8', changefreq: 'weekly' },
  { path: '/shop', priority: '0.8', changefreq: 'weekly' },
  { path: '/contact', priority: '0.8', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms', priority: '0.5', changefreq: 'monthly' },
  { path: '/cookies', priority: '0.5', changefreq: 'monthly' }
];

const fallbackItems = [
  { id: 'welcome-to-foundation-framework', type: 'blog', updatedAt: '2026-08-01' },
  { id: 'zero-build-architecture-handbook', type: 'book', updatedAt: '2026-08-01' },
  { id: 'vanilla-js-professional-course', type: 'education', updatedAt: '2026-08-01' },
  { id: 'sample-summit', type: 'event', updatedAt: '2026-08-25' },
  { id: 'how-to-deploy-serverless-workers', type: 'howto', updatedAt: '2026-08-01' },
  { id: 'episode-1-the-no-build-philosophy', type: 'podcast', updatedAt: '2026-08-01' },
  { id: 'e-commerce-redesign', type: 'portfolio', updatedAt: '2026-08-01' }
];

const fallbackPages = [
  { id: 'our-story', slug: 'our-story', updatedAt: '2026-08-01' }
];

function getValue(field) {
  if (!field) return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return parseFloat(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(v => getValue(v));
  }
  if ('mapValue' in field) {
    const obj = {};
    const subFields = field.mapValue.fields || {};
    for (const [key, val] of Object.entries(subFields)) {
      obj[key] = getValue(val);
    }
    return obj;
  }
  return undefined;
}

function parseDoc(doc) {
  const obj = {};
  const pathParts = doc.name ? doc.name.split('/') : [];
  obj.id = pathParts[pathParts.length - 1];
  const fields = doc.fields || {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = getValue(val);
  }
  obj.createdAt = doc.createTime;
  obj.updatedAt = doc.updateTime;
  return obj;
}

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequest(context) {
  const siteUrl = new URL(context.request.url).origin;
  const firebaseProjectId = context.env.FIREBASE_PROJECT_ID;
  const firestoreApiKey = context.env.FIREBASE_API_KEY;

  let publicContent = [];
  let customPages = [];

  if (firebaseProjectId && firestoreApiKey) {
    try {
      // 1. Fetch public content items
      const contentRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/content?key=${firestoreApiKey}&pageSize=100`);
      if (contentRes.ok) {
        const data = await contentRes.json();
        const docs = data.documents || [];
        publicContent = docs.map(parseDoc).filter(item => item.access?.visibility === 'public');
      } else {
        publicContent = fallbackItems;
      }

      // 2. Fetch custom pages
      const pagesRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pages?key=${firestoreApiKey}&pageSize=100`);
      if (pagesRes.ok) {
        const data = await pagesRes.json();
        const docs = data.documents || [];
        customPages = docs.map(parseDoc).filter(item => item.access?.visibility === 'public');
      } else {
        customPages = fallbackPages;
      }
    } catch (err) {
      console.error('[Sitemap API]: Error querying Firestore:', err);
      publicContent = fallbackItems;
      customPages = fallbackPages;
    }
  } else {
    publicContent = fallbackItems;
    customPages = fallbackPages;
  }

  // Fallbacks if lists are empty
  if (!publicContent || publicContent.length === 0) publicContent = fallbackItems;
  if (!customPages || customPages.length === 0) customPages = fallbackPages;

  let xmlUrls = '';

  // A. Static Routes
  for (const route of staticRoutes) {
    const loc = `${siteUrl}${route.path}`;
    const lastmod = new Date().toISOString().split('T')[0];
    xmlUrls += `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>\n`;
  }

  // B. Public CMS Content Items (`/detail?id={id}`)
  for (const item of publicContent) {
    const loc = `${siteUrl}/detail?id=${item.id}`;
    let rawDate = item.updatedAt || item.date || item.createdAt || new Date().toISOString();
    let lastmod = new Date().toISOString().split('T')[0];
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        lastmod = d.toISOString().split('T')[0];
      }
    } catch (e) {}

    // priority: 0.8 for articles/courses/howtos
    xmlUrls += `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  // C. Custom Pages (`/pages/{slug}`)
  for (const page of customPages) {
    const slug = page.slug || page.id;
    const loc = `${siteUrl}/pages/${slug}`;
    let rawDate = page.updatedAt || page.createdAt || new Date().toISOString();
    let lastmod = new Date().toISOString().split('T')[0];
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        lastmod = d.toISOString().split('T')[0];
      }
    } catch (e) {}

    xmlUrls += `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
