import { randomUUID } from 'node:crypto';

import { env } from '@config/index.js';
import { getRedisClient } from '@infra/cache/redis/connection.js';

interface SessionPayload {
  userId: string;
  createdAt: string;
}

const redis = getRedisClient();

const sessionKey = (sessionId: string): string => `auth:session:${sessionId}`;

export class RefreshTokenService {
  public async createSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const payload: SessionPayload = {
      userId,
      createdAt: new Date().toISOString()
    };

    await redis.set(sessionKey(sessionId), JSON.stringify(payload), 'EX', env.JWT_REFRESH_TOKEN_TTL);

    return sessionId;
  }

  public async validateSession(sessionId: string): Promise<SessionPayload | null> {
    const raw = await redis.get(sessionKey(sessionId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SessionPayload;
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await redis.del(sessionKey(sessionId));
  }
}

