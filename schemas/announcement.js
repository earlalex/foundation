import { Type } from '../core/validator.js';
import { AccessSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const AnnouncementSchema = {
  type: Type.string,                       // "announcement"
  id: Type.string,
  title: Type.string,
  description: Type.string,                // Quick digest / preview summary
  longFormText: Type.optional(Type.array), // Detailed announcement body
  date: Type.string,
  pinned: Type.optional(Type.boolean),     // Pin to top of admin/user dashboard
  
  // Access Control (Defaults to "authenticated" or "paid")
  access: AccessSchema,
  
  video: Type.optional(MediaSchema),
  audio: Type.optional(MediaSchema),
  images: Type.optional(Type.array),
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array)
};