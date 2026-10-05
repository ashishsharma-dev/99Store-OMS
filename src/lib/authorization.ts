import { db } from './db';
import { AuthSession, getSessionFromRequest } from './session';

export async function getActiveSession(request: Request): Promise<AuthSession | null> {
  const session = getSessionFromRequest(request);
  if (!session) return null;

  const user = await db.getUserByUsername(session.username);
  if (!user || !user.isActive || user.id !== session.userId) return null;

  return {
    ...session,
    name: user.name,
    role: user.role,
  };
}
