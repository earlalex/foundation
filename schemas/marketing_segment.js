import { Type } from '../core/validator.js';

export const MarketingSegmentSchema = {
  type: Type.literal('marketing_segments'),
  id: Type.string,
  name: Type.string,
  description: Type.optional(Type.string),
  rules: Type.array(Type.object),
  createdAt: Type.string,
  updatedAt: Type.string
};
