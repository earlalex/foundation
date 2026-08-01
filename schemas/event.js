// schemas/event.js
import { Type } from '../core/validator.js';

export const EventSchema = {
  type: Type.literal('event'),
  id: Type.string,
  title: Type.string,
  slug: Type.optional(Type.string),
  date: Type.string,
  location: Type.optional((val) => typeof val === 'string' || (typeof val === 'object' && val !== null)),
  description: Type.string,
  ticketTypes: Type.optional(Type.array(Type.object)),
  vendorPackages: Type.optional(Type.array(Type.object)),
  sponsorshipPackages: Type.optional(Type.array(Type.object)),
  accessVisibility: Type.optional(Type.string),
  access: Type.optional(Type.object),
  preview: Type.optional(Type.object),
  updatedAt: Type.optional(Type.string),

  // Mandatory / Optional media fields
  flyerUrl: Type.string, // Required flyer image URL
  bannerUrl: Type.optional(Type.string), // Optional wide banner image URL
  promoVideoUrl: Type.optional(Type.string), // Optional promo video URL

  // Legacy / backup compatibility
  eventType: Type.optional(Type.string),
  startTime: Type.optional(Type.string),
  endTime: Type.optional(Type.string),
  meetUrl: Type.optional(Type.string),
  calendarEventId: Type.optional(Type.string)
};
