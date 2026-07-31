import { Type } from '../core/validator.js';

export const ZapScanSchema = {
  type: Type.literal('zap_scans'),
  id: Type.string,
  targetUrl: Type.string,
  scanType: Type.string,
  progress: Type.number,
  status: Type.string,
  findings: Type.array(Type.object),
  createdAt: Type.string
};
