import raw from '../data/normalizedData.json';
import type { NormalizedData, Paper } from '../types';

export const data = raw as unknown as NormalizedData;

export const paperById = new Map<string, Paper>(data.papers.map((p) => [p.id, p]));
