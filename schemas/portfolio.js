import { Type } from '/core/validator.js';
import { AccessSchema, LinkSchema, MediaSchema, PreviewSchema } from '/schemas/common.js';

export const PortfolioSchema = {
  type: Type.string,                       // "portfolio"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  client: Type.optional(Type.string),
  techStack: Type.optional(Type.array),
  
  access: Type.optional(AccessSchema),
  
  video: Type.optional(MediaSchema),      // Project demo video
  audio: Type.optional(MediaSchema),      // Audio walkthrough / case study commentary
  images: Type.optional(Type.array),       // Screenshots gallery
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array)        // Live Demo, GitHub repo links
};