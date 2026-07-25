import { Type } from '../core/validator.js';
import { AccessSchema, ProductSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const QuizQuestionSchema = {
  id: Type.string,
  prompt: Type.string,
  type: Type.string,                       // "multiple-choice", "text-field", "essay"
  options: Type.optional(Type.array)      // For multiple choice
};

export const WorksheetSchema = {
  title: Type.string,
  pdfUrl: Type.optional(Type.string),
  interactiveFields: Type.optional(Type.array)
};

export const EducationSchema = {
  type: Type.string,                       // "education"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  
  access: AccessSchema,                    // Controls who can view the full lesson
  product: Type.optional(ProductSchema),   // If sold as a standalone course
  
  longFormText: Type.optional(Type.array),
  worksheets: Type.optional(Type.array),
  quizQuestions: Type.optional(Type.array),
  
  video: Type.optional(MediaSchema),
  audio: Type.optional(MediaSchema),
  images: Type.optional(Type.array),
  preview: Type.optional(PreviewSchema),   // Publicly accessible teaser
  
  links: Type.optional(Type.array)
};