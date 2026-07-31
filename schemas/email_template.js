import { Type } from '../core/validator.js';

export const EmailTemplateSchema = {
  type: Type.literal('email_templates'),
  id: Type.string,
  name: Type.string,
  editorType: Type.string, // 'grapesjs' | 'emailbuilder'
  projectData: Type.string, // stringified JSON
  compiledHtml: Type.string,
  updatedAt: Type.string
};
