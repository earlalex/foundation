import { Type } from '../core/validator.js';

export const VaSchema = {
  type: Type.string, // 'va_candidate' or 'va_hired'
  id: Type.string,
  name: Type.string,
  skills: Type.array(Type.string),
  hourlyRate: Type.number,
  status: Type.string // 'prospect', 'shortlisted', 'hired', 'archived'
};
