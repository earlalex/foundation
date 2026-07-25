// schemas/podcast.js
import { Type } from '../core/validator.js';
import { AccessSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const PodcastSchema = {
  type: Type.string,
  id: Type.string,
  title: Type.string,
  description: Type.string,
  date: Type.string,
  episodeNumber: Type.optional(Type.number), // Safe function
  
  access: Type.optional(Type.object),
  video: Type.optional(Type.object),
  audio: Type.optional(Type.object),
  images: Type.optional(Type.array()),
  preview: Type.optional(Type.object),
  links: Type.optional(Type.array())
};