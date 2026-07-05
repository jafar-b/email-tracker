import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

type EmailRow = {
  id: string;
  subject: string;
  recipient: string;
  sender: string;
  opened: number;
  opened_at: string | null;
  created_at: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for the Chrome Extension
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
}));

// POST /email - Register email for tracking
app.post('/email', async (c) => {
  try {
    const { subject, recipient, sender } = await c.req.json();
    if (!subject || !recipient || !sender) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await c.env.DB.prepare(
      `INSERT INTO emails (id, subject, recipient, sender, opened, opened_at, created_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?)`
    ).bind(id, subject, recipient, sender, now).run();

    return c.json({ id }, 201);
  } catch (error: any) {
    console.error('Error creating email:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET /pixel/:id - Tracking pixel endpoint
app.get('/pixel/:id', async (c) => {
  const rawId = c.req.param('id');
  const id = rawId.replace('.gif', '');

  try {
    // Check if email exists
    const email = await c.env.DB.prepare(
      'SELECT * FROM emails WHERE id = ?'
    ).bind(id).first<EmailRow>();

    if (email && email.opened === 0) {
      const createdTime = new Date(email.created_at).getTime();
      const nowTime = Date.now();
      const isImmediate = nowTime - createdTime < 15_000; // 15 seconds threshold

      if (!isImmediate) {
        const now = new Date().toISOString();
        await c.env.DB.prepare(
          'UPDATE emails SET opened = 1, opened_at = ? WHERE id = ?'
        ).bind(now, id).run();
      }
    }
  } catch (error) {
    console.error('Failed to log email view:', error);
  }

  // Return 1x1 transparent GIF
  const pixelHex = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const pixelBuffer = Uint8Array.from(atob(pixelHex), ch => ch.charCodeAt(0));

  return new Response(pixelBuffer, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
});

// GET /status/:id - Get status of a single email
app.get('/status/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const email = await c.env.DB.prepare(
      'SELECT * FROM emails WHERE id = ?'
    ).bind(id).first<EmailRow>();

    if (!email) {
      return c.json({ error: 'Email not found' }, 404);
    }

    return c.json({
      id: email.id,
      subject: email.subject,
      recipient: email.recipient,
      sender: email.sender,
      opened: email.opened === 1,
      openedAt: email.opened_at,
      createdAt: email.created_at,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// DELETE /status/:id - Reset status to pending (owner view exclusion)
app.delete('/status/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare(
      'UPDATE emails SET opened = 0, opened_at = NULL WHERE id = ?'
    ).bind(id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET /status - Get recent tracked emails
app.get('/status', async (c) => {
  const limit = parseInt(c.req.query('limit') || '100');
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM emails ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<EmailRow>();

    const mapped = results.map(email => ({
      id: email.id,
      subject: email.subject,
      recipient: email.recipient,
      sender: email.sender,
      opened: email.opened === 1,
      openedAt: email.opened_at,
      createdAt: email.created_at,
    }));

    return c.json(mapped);
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// GET /stats - Get dashboard statistics
app.get('/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN opened = 1 THEN 1 ELSE 0 END) as opened,
         SUM(CASE WHEN opened = 0 THEN 1 ELSE 0 END) as pending
       FROM emails`
    ).first<{ total: number; opened: number; pending: number }>();

    const total = stats?.total || 0;
    const opened = stats?.opened || 0;
    const pending = stats?.pending || 0;
    const openRate = total > 0 ? parseFloat(((opened / total) * 100).toFixed(1)) : 0;

    // Opened today (UTC day start)
    const todayStr = new Date();
    todayStr.setUTCHours(0,0,0,0);
    const todayIso = todayStr.toISOString();

    // Opened this week (7 days ago)
    const weekStr = new Date();
    weekStr.setDate(weekStr.getDate() - 7);
    const weekIso = weekStr.toISOString();

    const timeStats = await c.env.DB.prepare(
      `SELECT
         SUM(CASE WHEN opened = 1 AND opened_at >= ? THEN 1 ELSE 0 END) as opened_today,
         SUM(CASE WHEN opened = 1 AND opened_at >= ? THEN 1 ELSE 0 END) as opened_this_week
       FROM emails`
    ).bind(todayIso, weekIso).first<{ opened_today: number; opened_this_week: number }>();

    return c.json({
      total,
      opened,
      pending,
      openRate,
      openedToday: timeStats?.opened_today || 0,
      openedThisWeek: timeStats?.opened_this_week || 0,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

export default app;
