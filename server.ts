import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Storage } from './src/db/storage.ts';

const app = express();
const PORT = 6776;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Active Users State
const activeUsers = new Map<string, number>();

function getActiveCount(): number {
  const now = Date.now();
  for (const [id, lastSeen] of activeUsers.entries()) {
    if (now - lastSeen > 15000) {
      activeUsers.delete(id);
    }
  }
  return Math.max(1, activeUsers.size);
}

// Telegram Bot helper
async function notifyTelegram(tgId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot Mock] Token not set in .env. Notification text:', text);
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.error('Telegram API responded with error status:', res.status, await res.text());
    } else {
      console.log('Telegram message sent successfully to chatId:', tgId);
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}

// ---------------- API ENDPOINTS ----------------

// Active users tracking ping
app.post('/api/active-ping', (req, res) => {
  const { clientId } = req.body;
  if (clientId) {
    activeUsers.set(clientId, Date.now());
  }
  res.json({ activeCount: getActiveCount() });
});

// Database status check
app.get('/api/db-status', (req, res) => {
  res.json({
    postgresMode: Storage.isPostgresMode(),
    status: Storage.isPostgresMode() ? 'Connected to PostgreSQL' : 'Fallback Local JSON',
    error: Storage.getDbError()
  });
});

// Auth Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    const allAdmins = await Storage.getAdmins();
    const admin = allAdmins.find(
      (a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password
    );

    if (!admin) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Return session info (omitting password)
    const { password: _, ...safeAdmin } = admin;
    res.json({ user: safeAdmin });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сервера при авторизации: ' + err.message });
  }
});

// Get public admins list
app.get('/api/admins', async (req, res) => {
  try {
    const allAdmins = await Storage.getAdmins();
    const safeAdmins = allAdmins.map(({ password, ...rest }) => rest);
    res.json(safeAdmins);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Admin (Owner only)
app.post('/api/admins', async (req, res) => {
  try {
    const { username, password, nickname, role, tgId } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ error: 'Заполните логин, пароль и никнейм' });
    }

    const allAdmins = await Storage.getAdmins();
    // Check if username already exists
    if (allAdmins.find(a => a.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Администратор с таким логином уже существует' });
    }

    const newAdmin = {
      id: 'admin_' + Math.random().toString(36).substr(2, 9),
      username,
      password,
      nickname,
      role: role || 'Администратор',
      aboutMe: 'Новый администратор',
      hobbies: '',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      musicUrl: '',
      tgId: tgId || ''
    };

    await Storage.createAdmin(newAdmin);

    const { password: _, ...safeAdmin } = newAdmin;
    res.json(safeAdmin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Admin (Self or Owner)
app.put('/api/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, role, aboutMe, hobbies, photoUrl, musicUrl, tgId, password } = req.body;

    const admin = await Storage.getAdminById(id);
    if (!admin) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    const updateFields: any = {};
    if (nickname !== undefined) updateFields.nickname = nickname;
    if (role !== undefined) updateFields.role = role;
    if (aboutMe !== undefined) updateFields.aboutMe = aboutMe;
    if (hobbies !== undefined) updateFields.hobbies = hobbies;
    if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
    if (musicUrl !== undefined) updateFields.musicUrl = musicUrl;
    if (tgId !== undefined) updateFields.tgId = tgId;
    if (password !== undefined && password !== '') updateFields.password = password;

    const updatedAdmin = await Storage.updateAdmin(id, updateFields);

    const { password: _, ...safeAdmin } = updatedAdmin as any;
    res.json(safeAdmin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Admin (Owner only)
app.delete('/api/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'owner') {
      return res.status(400).json({ error: 'Нельзя удалить главного владельца' });
    }

    const admin = await Storage.getAdminById(id);
    if (!admin) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    await Storage.deleteAdmin(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a Take
app.post('/api/takes', async (req, res) => {
  try {
    const { type, content, imageUrl, targetAdminId } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Текст тейка обязателен' });
    }

    const newTake = {
      id: 'take_' + Math.random().toString(36).substr(2, 9),
      type: type || 'take',
      content,
      imageUrl: imageUrl || null,
      targetAdminId: targetAdminId || 'all',
      status: 'pending',
      createdAt: new Date().toISOString(),
      dialogue: []
    };

    await Storage.createTake(newTake);

    // Telegram Alert Trigger
    const typeLabel = newTake.type === 'take' ? 'Тейк 💬' : 'Идея 💡';
    let targetName = 'Все администраторы';
    let targetTgId = '';

    const allAdmins = await Storage.getAdmins();

    if (targetAdminId && targetAdminId !== 'all') {
      const targetAdmin = allAdmins.find(a => a.id === targetAdminId);
      if (targetAdmin) {
        targetName = targetAdmin.nickname;
        targetTgId = targetAdmin.tgId;
      }
    } else {
      // Target Owner tgId for general takes
      const owner = allAdmins.find(a => a.id === 'owner');
      if (owner) {
        targetTgId = owner.tgId;
      }
    }

    if (targetTgId) {
      const text = `<b>🆕 ПОЛУЧЕН НОВЫЙ ТЕЙК!</b>\n\n` +
        `<b>Тип:</b> ${typeLabel}\n` +
        `<b>Адресат:</b> ${targetName}\n` +
        `<b>Содержание:</b>\n<i>${content}</i>\n` +
        (imageUrl ? `\n🖼️ <i>Прикреплено изображение</i>` : '') +
        `\n\n🔗 <i>Откройте панель администрирования для ответа!</i>`;
      await notifyTelegram(targetTgId, text);
    }

    res.json(newTake);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Takes
app.get('/api/takes', async (req, res) => {
  try {
    const { adminId } = req.query;
    const allTakes = await Storage.getTakes();

    if (!adminId) {
      return res.json(allTakes);
    }

    // Filter takes visible to specific admin
    const visibleTakes = allTakes.filter(
      t => t.targetAdminId === 'all' || t.targetAdminId === adminId || t.takenBy === adminId
    );
    res.json(visibleTakes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Claim a general Take
app.post('/api/takes/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: 'ID администратора обязателен' });
    }

    const take = await Storage.getTakeById(id);
    if (!take) {
      return res.status(404).json({ error: 'Тейк не найден' });
    }

    if (take.targetAdminId !== 'all') {
      return res.status(400).json({ error: 'Этот тейк уже персональный' });
    }

    const updated = await Storage.updateTake(id, {
      status: 'taken',
      takenBy: adminId,
      targetAdminId: adminId
    });

    // Inform admin via telegram that they took the take
    const allAdmins = await Storage.getAdmins();
    const claimant = allAdmins.find(a => a.id === adminId);
    const owner = allAdmins.find(a => a.id === 'owner');

    if (claimant && owner && owner.tgId) {
      const text = `<b>✅ Тейк взят в работу!</b>\n\n` +
        `<b>Администратор:</b> ${claimant.nickname}\n` +
        `<b>Содержание тейка:</b>\n<i>${take.content}</i>`;
      await notifyTelegram(owner.tgId, text);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add message to Dialogue (chat inside a take)
app.post('/api/takes/:id/dialogue', async (req, res) => {
  try {
    const { id } = req.params;
    const { sender, text } = req.body; // sender: 'user' | 'admin'

    if (!text || !sender) {
      return res.status(400).json({ error: 'Отправитель и текст сообщения обязательны' });
    }

    const take = await Storage.getTakeById(id);
    if (!take) {
      return res.status(404).json({ error: 'Тейк не найден' });
    }

    const dialogue = take.dialogue || [];
    dialogue.push({
      sender,
      text,
      createdAt: new Date().toISOString()
    });

    const updated = await Storage.updateTake(id, { dialogue });

    // Notify target admin on Telegram if user sends a message
    if (sender === 'user') {
      const targetAdminId = take.takenBy || take.targetAdminId;
      if (targetAdminId && targetAdminId !== 'all') {
        const allAdmins = await Storage.getAdmins();
        const targetAdmin = allAdmins.find(a => a.id === targetAdminId);
        if (targetAdmin && targetAdmin.tgId) {
          const textMsg = `<b>💬 НОВОЕ СООБЩЕНИЕ В ТЕЙКЕ!</b>\n\n` +
            `От пользователя в чате тейка:\n` +
            `<i>"${text}"</i>`;
          await notifyTelegram(targetAdmin.tgId, textMsg);
        }
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a Survey (Anketa)
app.post('/api/surveys', async (req, res) => {
  try {
    const { source, sphere, age, roleInterest, helpDescription } = req.body;

    if (!source || !sphere || !age || !roleInterest || !helpDescription) {
      return res.status(400).json({ error: 'Все поля анкеты обязательны' });
    }

    const newSurvey = {
      id: 'survey_' + Math.random().toString(36).substr(2, 9),
      source,
      sphere,
      age: Number(age),
      roleInterest,
      helpDescription,
      createdAt: new Date().toISOString()
    };

    await Storage.createSurvey(newSurvey);

    // Telegram alert to Owner
    const allAdmins = await Storage.getAdmins();
    const owner = allAdmins.find(a => a.id === 'owner');
    if (owner && owner.tgId) {
      const tgText = `<b>📝 ПОЛУЧЕНА НОВАЯ АНКЕТА В КОМАНДУ!</b>\n\n` +
        `<b>1. Откуда узнали:</b> ${source}\n` +
        `<b>2. Сфера деятельности:</b> ${sphere}\n` +
        `<b>3. Возраст:</b> ${age}\n` +
        `<b>4. Чем хотят заниматься:</b> ${roleInterest}\n` +
        `<b>5. Как готовы помочь:</b>\n<i>${helpDescription}</i>\n\n` +
        `💻 <i>Проверьте панель владельца для просмотра всех заявок!</i>`;
      await notifyTelegram(owner.tgId, tgText);
    }

    res.json(newSurvey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Surveys (Owner/Admin restricted)
app.get('/api/surveys', async (req, res) => {
  try {
    const allSurveys = await Storage.getSurveys();
    res.json(allSurveys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Prices
app.get('/api/prices', async (req, res) => {
  try {
    const allPrices = await Storage.getPrices();
    res.json(allPrices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update/Delete Prices (Owner Only)
app.post('/api/prices', async (req, res) => {
  try {
    const { title, price, description, adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать цены' });
    }
    if (!title || !price || !description) {
      return res.status(400).json({ error: 'Все поля цены обязательны' });
    }

    const newPrice = {
      id: 'p_' + Math.random().toString(36).substr(2, 9),
      title,
      price,
      description
    };

    await Storage.createPrice(newPrice);
    res.json(newPrice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/prices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, price, description, adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать цены' });
    }

    const updated = await Storage.updatePrice(id, { title, price, description });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/prices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать цены' });
    }

    await Storage.deletePrice(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Unions
app.get('/api/unions', async (req, res) => {
  try {
    const allUnions = await Storage.getUnions();
    res.json(allUnions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update/Delete Unions (Owner Only)
app.post('/api/unions', async (req, res) => {
  try {
    const { name, link, description, adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать союзы' });
    }
    if (!name || !link || !description) {
      return res.status(400).json({ error: 'Все поля союза обязательны' });
    }

    const newUnion = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name,
      link,
      description
    };

    await Storage.createUnion(newUnion);
    res.json(newUnion);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/unions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link, description, adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать союзы' });
    }

    const updated = await Storage.updateUnion(id, { name, link, description });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/unions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    if (adminId !== 'owner') {
      return res.status(403).json({ error: 'Только владелец может настраивать союзы' });
    }

    await Storage.deleteUnion(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- VITE MIDDLEWARE SETUP ----------------

async function startServer() {
  // Initialize Storage (Database with automatic fallback)
  await Storage.init();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
