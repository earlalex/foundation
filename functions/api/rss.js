// functions/api/rss.js

const fallbackContent = [
  {
    type: 'blog',
    id: 'welcome-to-foundation-framework',
    title: 'Welcome to Foundation Framework',
    description: 'Discover the power of our zero-build modern framework architecture.',
    author: 'Jane Doe',
    date: '2026-08-01',
    access: { visibility: 'public' }
  },
  {
    type: 'book',
    id: 'zero-build-architecture-handbook',
    title: 'Zero-Build Architecture Handbook',
    description: 'Learn the patterns and principles of modern zero-build engineering.',
    author: 'Jane Doe',
    date: '2026-08-01',
    access: { visibility: 'public' }
  },
  {
    type: 'education',
    id: 'vanilla-js-professional-course',
    title: 'Vanilla JS Professional Course',
    description: 'Master Vanilla JS, custom reactive stores, and native visual GrapesJS builder flows.',
    author: 'Jane Doe',
    date: '2026-08-01',
    access: { visibility: 'public' }
  },
  {
    type: 'event',
    id: 'sample-summit',
    title: 'Ascension Avenue Summit 2026',
    description: 'Join us at the signature Ascension Avenue Summit of 2026 for high-impact workshops, direct networking, and keynotes on zero-build web technologies and business automation.',
    author: 'EarlAlex',
    date: '2026-08-25',
    access: { visibility: 'public' }
  },
  {
    type: 'howto',
    id: 'how-to-deploy-serverless-workers',
    title: 'How to Deploy Serverless Workers',
    description: 'A comprehensive guide on deploying zero-dependency serverless edge workers.',
    author: 'Jane Doe',
    date: '2026-08-01',
    access: { visibility: 'public' }
  },
  {
    type: 'podcast',
    id: 'episode-1-the-no-build-philosophy',
    title: 'Episode 1: The No-Build Philosophy',
    description: 'In this episode, we outline our design philosophy and how to break free from bundler fatigue.',
    author: 'Jane Doe',
    date: '2026-08-01',
    audioUrl: 'https://example.com/podcast-ep1.mp3',
    duration: '25:30',
    access: { visibility: 'public' }
  },
  {
    type: 'portfolio',
    id: 'e-commerce-redesign',
    title: 'E-Commerce Redesign',
    description: 'Case study of our high-conversion e-commerce storefront redesign.',
    author: 'Jane Doe',
    date: '2026-08-01',
    access: { visibility: 'public' }
  }
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

function formatPubDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return new Date().toUTCString();
    }
    return d.toUTCString();
  } catch (e) {
    return new Date().toUTCString();
  }
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
  const url = new URL(context.request.url);
  const typeParam = url.searchParams.get('type');

  const firebaseProjectId = context.env.FIREBASE_PROJECT_ID;
  const firestoreApiKey = context.env.FIREBASE_API_KEY;

  let publicContent = [];

  if (firebaseProjectId && firestoreApiKey) {
    try {
      const listUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/content?key=${firestoreApiKey}&pageSize=100`;
      const res = await fetch(listUrl);
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];
        const parsedDocs = docs.map(parseDoc);
        publicContent = parsedDocs.filter(item => item.access?.visibility === 'public');
      } else {
        publicContent = fallbackContent;
      }
    } catch (err) {
      console.error('[RSS API]: Error querying Firestore:', err);
      publicContent = fallbackContent;
    }
  } else {
    publicContent = fallbackContent;
  }

  // Double check if empty
  if (!publicContent || publicContent.length === 0) {
    publicContent = fallbackContent;
  }

  // Apply filtering by type query parameter if present
  let filteredContent = publicContent;
  if (typeParam) {
    filteredContent = publicContent.filter(item => item.type === typeParam);
  }

  const feedTitle = typeParam ? `Foundation ${typeParam.charAt(0).toUpperCase() + typeParam.slice(1)} Feed` : 'Foundation Unified RSS Feed';
  const feedLink = typeParam ? `${siteUrl}/rss?type=${typeParam}` : `${siteUrl}/rss`;
  const feedDescription = typeParam ? `Consolidated feed of public ${typeParam} items from Foundation.` : 'Consolidated feed of all public content from Foundation.';

  // Build valid XML conforming to the RSS 2.0 and iTunes Podcast specification
  let xmlItems = '';
  for (const item of filteredContent) {
    const itemLink = `${siteUrl}/detail?id=${item.id}`;
    const pubDate = formatPubDate(item.date || item.updatedAt || item.createdAt);

    xmlItems += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(itemLink)}</link>
      <description>${escapeXml(item.description || '')}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(itemLink)}</guid>
      <dc:creator>${escapeXml(item.author || 'Foundation Team')}</dc:creator>
`;

    if (item.type === 'podcast') {
      xmlItems += `      <enclosure url="${escapeXml(item.audioUrl || 'https://example.com/podcast-ep1.mp3')}" type="audio/mpeg" />
      <itunes:author>${escapeXml(item.author || 'Foundation Team')}</itunes:author>
      <itunes:duration>${escapeXml(item.duration || '25:30')}</itunes:duration>
`;
    }

    xmlItems += `    </item>\n`;
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en-us</language>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <itunes:author>Foundation Team</itunes:author>
    <itunes:summary>${escapeXml(feedDescription)}</itunes:summary>
\n${xmlItems}  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
