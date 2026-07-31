import { Type } from '../core/validator.js';

export const MarketingJourneySchema = {
  type: Type.literal('marketing_journeys'),
  id: Type.string,
  name: Type.string,
  description: Type.optional(Type.string),
  active: Type.boolean,
  trigger: Type.optional(Type.object),
  nodes: Type.array(Type.object),
  createdAt: Type.string,
  updatedAt: Type.string
};
