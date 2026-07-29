import { Type } from '../core/validator.js';

export const PageSchema = {
  type: Type.string, // "page"
  id: Type.string,   // slug
  title: Type.string,
  blocks: Type.array,
  access: {
    visibility: Type.string // "public", "subscriber", "member", "paid"
  }
};
