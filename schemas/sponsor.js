// schemas/sponsor.js
import { Type } from '/core/validator.js';

export const SponsorSchema = {
  type: Type.string,
  id: Type.string,
  title: Type.string,
  description: Type.string,
  longFormText: Type.optional(Type.array()),
  promoCode: Type.optional(Type.string),
  expirationDate: Type.optional(Type.string),
  
  access: Type.optional(Type.object),
  video: Type.optional(Type.object),
  audio: Type.optional(Type.object),
  images: Type.optional(Type.array()),
  preview: Type.optional(Type.object),
  links: Type.optional(Type.array())
};