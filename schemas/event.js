// schemas/event.js
import { Type } from '../core/validator.js';

export const EventSchema = {
  type: Type.literal('event'),
  id: Type.string,
  title: Type.string,
  description: Type.string,
  eventType: Type.string, // 'google-meet' | 'in-person' | 'webinar'
  date: Type.string,       // 'YYYY-MM-DD'
  startTime: Type.string,  // '14:00'
  endTime: Type.string,    // '15:00'
  location: Type.optional(Type.string),
  meetUrl: Type.optional(Type.string),
  calendarEventId: Type.optional(Type.string),
  access: {
    visibility: Type.string
  },
  preview: Type.optional(Type.object)
};