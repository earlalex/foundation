import { Type } from '../core/validator.js';
import { AccessSchema, ProductSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const HowToSchema = {
  type: Type.string,                       // "howto"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  longFormText: Type.array,                // Step-by-step instructions
  difficulty: Type.optional(Type.string),  // e.g. "Beginner", "Advanced"
  
  access: Type.optional(AccessSchema),
  product: Type.optional(ProductSchema),
  
  video: Type.optional(MediaSchema),
  audio: Type.optional(MediaSchema),
  images: Type.optional(Type.array),
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array)
};