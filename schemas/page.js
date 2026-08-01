import { Type } from '../core/validator.js';

export const PageSchema = {
  type: Type.string, // "page"
  id: Type.string,   // slug
  slug: Type.optional(Type.string),
  title: Type.string,
  editorType: Type.optional(Type.string),
  projectData: Type.optional((val) => typeof val === 'object' && val !== null),
  compiledHtml: Type.optional(Type.string),
  compiledCss: Type.optional(Type.string),
  blocks: Type.optional((val) => Array.isArray(val)),
  access: {
    visibility: Type.string // "public", "subscriber", "member", "paid"
  },
  hero: Type.optional((val) => typeof val === 'object' && val !== null),
  updatedAt: Type.optional(Type.string)
};
