import { Type } from '/core/validator.js';
import { AccessSchema, LinkSchema, MediaSchema, PreviewSchema } from '/schemas/common.js';

export const BlogSchema = {
  type: Type.string,                       // "blog"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  longFormText: Type.array,                // Content blocks / markdown HTML
  author: Type.string,
  date: Type.string,
  
  access: Type.optional(AccessSchema),     // Usually "public"
  
  video: Type.optional(MediaSchema),
  audio: Type.optional(MediaSchema),
  images: Type.optional(Type.array),
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array)
};