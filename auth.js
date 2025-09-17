import jwt from 'jsonwebtoken';

export const SESSION_COOKIE_NAME = 'videokit_session';

/**
 * Creates authentication helpers (protect/authorize) backed by JWT sessions.
 * @param {{ dbPool: import('pg').Pool, config: import('../config.js').default }} params
 */
export function createAuthMiddleware({ dbPool, config }) {
  if (!dbPool) {
    throw new Error('createAuthMiddleware requires a database pool');
  }
  const jwtSecret = config?.secrets?.jwtSecret;
  if (!jwtSecret) {
    throw new Error('JWT secret is not configured.');
  }

  const cookieBaseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  const normalizeRoles = (roles = []) => roles.map((role) => role?.toLowerCase?.() ?? role).filter(Boolean);
  
  // --- DEĞİŞİKLİK BURADA BAŞLIYOR ---

  const loadUserContext = async (userId) => {
    // 1. Sorgu güncellendi: Artık var olmayan 'full_name' istenmiyor.
    const userResult = await dbPool.query(
      'SELECT id, email, role, tenant_id, created_at, updated_at FROM users WHERE id = $1',
      [userId],
    );

    if (userResult.rowCount === 0) {
      return null;
    }
    const userRow = userResult.rows[0];
    const { tenant_id: tenantId, role } = userRow;

    let tenant = null;
    if (tenantId) {
      const tenantResult = await dbPool.query(
        'SELECT id, name, plan FROM tenants WHERE id = $1',
        [tenantId],
      );
      tenant = tenantResult.rows[0] ?? null;
    }
    
    // 2. Karmaşık rol çekme mantığı kaldırıldı. Rol doğrudan user objesinden alınıyor.
    // Artık 'user_tenant_roles' tablosuna ihtiyaç yok.
    const roles = role ? [role] : [];

    return {
      user: {
        id: userRow.id,
        email: userRow.email,
        fullName: userRow.full_name, // Bu hala undefined dönebilir ama çökertmez.
        role: userRow.role,
        tenantId: tenant?.id ?? tenantId,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at,
        roles,
      },
      tenant,
    };
  };
  
  // --- DEĞİŞİKLİK BURADA BİTİYOR ---

  const clearSessionCookie = (res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { ...cookieBaseOptions, maxAge: 0 });
  };

  const extractToken = (req) => {
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (cookieToken) return cookieToken;

    const authHeader = req.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    return null;
  };

  const protect = async (req, res, next) => {
    const token = extractToken(req);

    if (token) {
      try {
        const payload = jwt.verify(token, jwtSecret);
        // payload.tenantId'ye artık ihtiyacımız yok, bilgiyi direkt user'dan alıyoruz.
        const context = await loadUserContext(payload.sub);
        if (!context) {
          clearSessionCookie(res);
          return res.status(401).json({ error: 'Authentication required.' });
        }

        req.user = context.user;
        req.tenant = context.tenant ?? req.tenant;
        req.authType = 'session';
        return next();
      } catch (error) {
        req.log?.warn?.({ err: error }, '[auth] Invalid session token.');
        clearSessionCookie(res);
        return res.status(401).json({ error: 'Authentication required.' });
      }
    }

    const apiKey = req.get('X-API-Key');
    if (apiKey) {
      req.authType = 'apiKey';
      return next();
    }

    return res.status(401).json({ error: 'Authentication required.' });
  };

  const authorize = (...requiredRoles) => {
    const normalizedRequired = normalizeRoles(requiredRoles);
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      if (normalizedRequired.length === 0) {
        return next();
      }

      const userRoles = new Set(normalizeRoles(req.user.roles));
      if (userRoles.has('superadmin')) {
        return next();
      }

      const hasRole = normalizedRequired.some((role) => userRoles.has(role));
      if (!hasRole) {
        return res.status(403).json({ error: 'Forbidden: insufficient role.' });
      }

      return next();
    };
  };

  const issueSession = (res, { userId, tenantId, roles }) => {
    const token = jwt.sign(
      {
        sub: userId,
        tenantId: tenantId ?? null,
        roles: normalizeRoles(roles),
      },
      jwtSecret,
      { expiresIn: config?.jwt?.expiresIn ?? '30d' },
    );

    res.cookie(SESSION_COOKIE_NAME, token, cookieBaseOptions);
    return token;
  };

  const destroySession = (res) => {
    clearSessionCookie(res);
  };

  return {
    protect,
    authorize,
    issueSession,
    destroySession,
    loadUserContext,
    sessionCookieName: SESSION_COOKIE_NAME,
    cookieOptions: cookieBaseOptions,
  };
}

export default createAuthMiddleware;