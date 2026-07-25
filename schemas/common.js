import { Type } from '../core/validator.js';

// Access Control Rule
// visibility: "public" (everyone), "authenticated" (logged in), "paid" (subscribers/buyers)
export const AccessSchema = {
  visibility: Type.string,                 // "public", "authenticated", or "paid"
  requiredTier: Type.optional(Type.string) // e.g. "pro", "vip", "tier-1"
};

// Commerce / Monetization details (For books, paid courses, paid worksheets)
export const ProductSchema = {
  isPurchasable: Type.boolean,
  price: Type.optional(Type.number),       // e.g. 19.99
  currency: Type.optional(Type.string),    // e.g. "USD"
  stripePriceId: Type.optional(Type.string), // For payment integration
  downloadUrl: Type.optional(Type.string)  // Gated asset path (served post-purchase)
};

// Reusable Media Schema
export const MediaSchema = {
  type: Type.string,                       // "image", "video", or "audio"
  src: Type.string,
  alt: Type.optional(Type.string),
  caption: Type.optional(Type.string)
};

// Reusable Preview Schema (ALWAYS Publicly Visible)
export const PreviewSchema = {
  video: Type.optional(MediaSchema),
  audio: Type.optional(MediaSchema),
  featuredImage: Type.optional(MediaSchema),
  teaserText: Type.optional(Type.string)
};

export const LinkSchema = {
  label: Type.string,
  url: Type.string,
  external: Type.optional(Type.boolean)
};