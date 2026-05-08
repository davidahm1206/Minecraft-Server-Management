import { z } from 'zod';
import type { WSEventType } from '../types/events.js';

const wsEventTypes: WSEventType[] = [
  'server:start', 'server:stop', 'server:restart', 'server:command',
  'metrics:request', 'mods:list', 'mods:upload', 'mods:delete', 'mods:toggle',
  'files:list', 'files:read', 'files:write', 'files:delete', 'files:upload',
  'world:list', 'world:delete', 'world:regenerate',
  'server:status', 'server:log', 'server:crash', 'metrics:update',
  'player:join', 'player:leave', 'mods:list:response',
  'files:list:response', 'files:read:response', 'world:list:response',
  'agent:connected', 'agent:disconnected', 'error', 'success',
];

export const wsMessageSchema = z.object({
  type: z.enum(wsEventTypes as [string, ...string[]]),
  id: z.string().uuid().optional(),
  payload: z.unknown(),
  timestamp: z.number(),
});
