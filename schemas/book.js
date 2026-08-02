import { Type } from '../core/validator.js';
import { AccessSchema, ProductSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const BookSchema = {
  type: Type.string,                       // "book"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  isbn: Type.optional(Type.string),
  formats: Type.optional(Type.array),      // ["PDF", "Hardcover", "Epub"]
  
  access: Type.optional(AccessSchema),
  product: Type.optional(ProductSchema),   // Purchase link & Stripe details
  
  video: Type.optional(MediaSchema),      // Book trailer / author interview
  audio: Type.optional(MediaSchema),      // Audiobook excerpt
  images: Type.optional(Type.array),       // Book cover / interior spreads
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array),       // Buy links (Amazon, Direct PDF)
  tags: Type.optional(Type.array)
};