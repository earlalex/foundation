// utils/ai-imagen.js - Google Imagen 3 API Frontend Client Helper
import { toast } from './toast.js';
import { configManager } from '../core/config.js';

/**
 * Generate a dynamic Unsplash fallback URL based on keywords and aspect ratio
 */
export function getUnsplashFallback(prompt, aspectRatio) {
  const query = encodeURIComponent((prompt || 'abstract').substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, ''));
  if (aspectRatio === '1:1') {
    return `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  } else if (aspectRatio === '16:9') {
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  } else {
    return `https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  }
}

/**
 * Generic function to fetch AI generated image from edge endpoint /api/imagen
 */
export async function generateImage(prompt, aspectRatio = '1:1') {
  // Respect feature toggle
  if (configManager.current.features?.imagenAiGenerator === false) {
    console.warn("[ai-imagen]: Imagen AI Generator is disabled in Site Settings. Returning Unsplash fallback.");
    return getUnsplashFallback(prompt, aspectRatio);
  }

  try {
    const response = await fetch('/api/imagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspectRatio, numberOfImages: 1 })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.images && data.images[0]) {
        if (data.fallback) {
          toast.warning("Imagen API key is missing or quota exceeded. Falling back to beautiful Unsplash imagery.");
        }
        return data.images[0].url;
      }
    }
    throw new Error(`API responded with status: ${response.status}`);
  } catch (err) {
    console.warn("[ai-imagen]: Request failed. Falling back to Unsplash.", err);
    toast.warning("Google Imagen generation offline. Fallback Unsplash image loaded.");
    return getUnsplashFallback(prompt, aspectRatio);
  }
}

/**
 * Generate Hero background image (Aspect Ratio: 16:9)
 */
export async function generateHeroBackground(themeKeyword) {
  const prompt = `A professional, high-resolution clean abstract visual art background with a modern theme centered on "${themeKeyword || 'minimal design'}", beautiful subtle gradients, perfect for web banner design showcase.`;
  return await generateImage(prompt, '16:9');
}

/**
 * Generate Product Mockup image (Aspect Ratio: 1:1)
 */
export async function generateProductMockup(productTitle, category) {
  const prompt = `Premium high-resolution studio catalog photograph mockup of "${productTitle || 'product'}" under category "${category || 'merchandise'}", centered placement, modern minimal styling, elegant studio lighting, clean background.`;
  return await generateImage(prompt, '1:1');
}

/**
 * Generate Article Header image (Aspect Ratio: 16:9)
 */
export async function generateArticleHeader(blogTitle) {
  const prompt = `High-resolution conceptual aesthetic graphic editorial background illustration for a blog post titled "${blogTitle || 'innovation'}", modern clean visual hierarchy, perfect as a featured article header card.`;
  return await generateImage(prompt, '16:9');
}
