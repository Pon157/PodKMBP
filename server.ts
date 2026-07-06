import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'db.json');

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

// DB schema interfaces
interface Admin {
  id: string;
  username: string;
  password?: string;
  nickname: string;
  role: string;
  aboutMe: string;
  hobbies: string;
  photoUrl: string;
  musicUrl: string;
  tgId: string;
}

interface Take {
  id: string;
  type: 'take' | 'idea';
  content: string;
  imageUrl?: string;
  targetAdminId: string;
  status: 'pending' | 'taken' | 'resolved';
  takenBy?: string;
  createdAt: string;
  dialogue?: Array<{
    sender: 'user' | 'admin';
    text: string;
    createdAt: string;
  }>;
}

interface Survey {
  id: string;
  source: string;
  sphere: string;
  age: number;
  roleInterest: string;
  helpDescription: string;
  createdAt: string;
}

interface PriceItem {
  id: string;
  title: string;
  price: string;
  description: string;
}

interface UnionItem {
  id: string;
  name: string;
  link: string;
  description: string;
}

interface DbSchema {
  admins: Admin[];
  takes: Take[];
  surveys: Survey[];
  prices: PriceItem[];
  unions: UnionItem[];
}

const defaultDb: DbSchema = {
  admins: [
    {
      id: 'owner',
      username: 'owner',
      password: 'owner123',
      nickname: 'Главный Владелец',
      role: 'Owner',
      aboutMe: 'Создатель канала, маскота и хранитель уюта. Всегда на связи по важным вопросам.',
      hobbies: 'Управление, Рисование, Чайные церемонии',
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
      musicUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      tgId: '12345678'
    },
    {
      id: 'kibo',
      username: 'kibo',
      password: 'kibo123',
      nickname: 'Кибо',
      role: 'Разработчик / Дизайнер',
      aboutMe: 'С вайбом маскота!!! Создаю крутой визуал, пишу код и поддерживаю атмосферу.',
      hobbies: 'Рисование, Кодинг, Видеоигры, Эмбиент',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      musicUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      tgId: '98765432'
    }
  ],
  takes: [
    {
      id: 'take1',
      type: 'take',
      content: 'Привет! Предлагаю сделать совместный стрим-обзор на новые арты сообщества. Будет весело!',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=300',
      targetAdminId: 'all',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      dialogue: []
    }
  ],
  surveys: [
    {
      id: 's1',
      source: 'Из Телеграм канала',
      sphere: 'Диджитал арт и дизайн',
      age: 19,
      roleInterest: 'Помощник дизайнера / Модератор',
      helpDescription: 'Готов модерировать чат, делать превьюшки и помогать с оформлением постов.',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ],
  prices: [
    { id: 'p1', title: 'Оформление профиля', price: '450 ₽', description: 'Полный комплект: аватарка, баннер, декоративные элементы в едином стиле канала.' },
    { id: 'p2', title: 'Анимация маскота', price: '700 ₽', description: 'Плавная 2D анимация вашего маскота (idle, эмоции, махание рукой, моргание).' },
    { id: 'p3', title: 'Кастомный арт маскота', price: '500 ₽', description: 'Рисунок маскота в любой позе и одежде по вашему ТЗ. Идеально для стикеров.' },
    { id: 'p4', title: 'Консультация по дизайну', price: '200 ₽', description: 'Разбор вашего текущего оформления и практические советы по улучшению юзабилити и визуала.' }
  ],
  unions: [
    { id: 'u1', name: 'Союз Memory Base', link: 'https://t.me/memory_base', description: 'Крупнейшее содружество по борьбе с мошенничеством в сфере креативных каналов. Если вы столкнулись с мошенником, обращайтесь к ним!' }
  ]
};

let db: DbSchema = { ...defaultDb };

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      db = JSON.parse(data);
      // Ensure default admins exist
      if (!db.admins || db.admins.length === 0) {
        db.admins = [...defaultDb.admins];
      }
      if (!db.admins.find(a => a.id === 'owner')) {
        db.admins.push(defaultDb.admins[0]);
      }
      if (!db.prices) db.prices = defaultDb.prices;
      if (!db.unions) db.unions = defaultDb.unions;
      if (!db.takes) db.takes = [];
      if (!db.surveys) db.surveys = [];
    } else {
      saveDb();
    }
  } catch (e) {
    console.error('Failed to load db, using defaults', e);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save db', e);
  }
}

// Load Database on Startup
loadDb();

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

// Auth Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  const admin = db.admins.find(
    (a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password
  );

  if (!admin) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  // Return session info (omitting password)
  const { password: _, ...safeAdmin } = admin;
  res.json({ user: safeAdmin });
});

// Get public admins list
app.get('/api/admins', (req, res) => {
  const safeAdmins = db.admins.map(({ password, ...rest }) => rest);
  res.json(safeAdmins);
});

// Create Admin (Owner only)
app.post('/api/admins', (req, res) => {
  const { username, password, nickname, role, tgId } = req.body;
  if (!username || !password || !nickname) {
    return res.status(400).json({ error: 'Заполните логин, пароль и никнейм' });
  }

  // Check if username already exists
  if (db.admins.find(a => a.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Администратор с таким логином уже существует' });
  }

  const newAdmin: Admin = {
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

  db.admins.push(newAdmin);
  saveDb();

  const { password: _, ...safeAdmin } = newAdmin;
  res.json(safeAdmin);
});

// Update Admin (Self or Owner)
app.put('/api/admins/:id', (req, res) => {
  const { id } = req.params;
  const { nickname, role, aboutMe, hobbies, photoUrl, musicUrl, tgId, password } = req.body;

  const adminIndex = db.admins.findIndex(a => a.id === id);
  if (adminIndex === -1) {
    return res.status(404).json({ error: 'Администратор не найден' });
  }

  const admin = db.admins[adminIndex];
  if (nickname !== undefined) admin.nickname = nickname;
  if (role !== undefined) admin.role = role;
  if (aboutMe !== undefined) admin.aboutMe = aboutMe;
  if (hobbies !== undefined) admin.hobbies = hobbies;
  if (photoUrl !== undefined) admin.photoUrl = photoUrl;
  if (musicUrl !== undefined) admin.musicUrl = musicUrl;
  if (tgId !== undefined) admin.tgId = tgId;
  if (password !== undefined && password !== '') admin.password = password;

  db.admins[adminIndex] = admin;
  saveDb();

  const { password: _, ...safeAdmin } = admin;
  res.json(safeAdmin);
});

// Delete Admin (Owner only)
app.delete('/api/admins/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'owner') {
    return res.status(400).json({ error: 'Нельзя удалить главного владельца' });
  }

  const adminIndex = db.admins.findIndex(a => a.id === id);
  if (adminIndex === -1) {
    return res.status(404).json({ error: 'Администратор не найден' });
  }

  db.admins.splice(adminIndex, 1);
  saveDb();
  res.json({ success: true });
});

// Submit a Take
app.post('/api/takes', async (req, res) => {
  const { type, content, imageUrl, targetAdminId } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Текст тейка обязателен' });
  }

  const newTake: Take = {
    id: 'take_' + Math.random().toString(36).substr(2, 9),
    type: type || 'take',
    content,
    imageUrl,
    targetAdminId: targetAdminId || 'all',
    status: 'pending',
    createdAt: new Date().toISOString(),
    dialogue: []
  };

  db.takes.push(newTake);
  saveDb();

  // Telegram Alert Trigger
  const typeLabel = newTake.type === 'take' ? 'Тейк 💬' : 'Идея 💡';
  let targetName = 'Все администраторы';
  let targetTgId = '';

  if (targetAdminId && targetAdminId !== 'all') {
    const targetAdmin = db.admins.find(a => a.id === targetAdminId);
    if (targetAdmin) {
      targetName = targetAdmin.nickname;
      targetTgId = targetAdmin.tgId;
    }
  } else {
    // Target Owner tgId for general takes
    const owner = db.admins.find(a => a.id === 'owner');
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
});

// Get Takes
app.get('/api/takes', (req, res) => {
  // Query parameters can filter by admin ID
  const { adminId } = req.query;
  if (!adminId) {
    return res.json(db.takes);
  }

  // Filter takes visible to specific admin:
  // - Targeted to them specifically
  // - Or targeted to "all" (anyone can view/take)
  const visibleTakes = db.takes.filter(
    t => t.targetAdminId === 'all' || t.targetAdminId === adminId || t.takenBy === adminId
  );
  res.json(visibleTakes);
});

// Claim a general Take
app.post('/api/takes/:id/claim', async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: 'ID администратора обязателен' });
  }

  const takeIndex = db.takes.findIndex(t => t.id === id);
  if (takeIndex === -1) {
    return res.status(404).json({ error: 'Тейк не найден' });
  }

  const take = db.takes[takeIndex];
  if (take.targetAdminId !== 'all') {
    return res.status(400).json({ error: 'Этот тейк уже персональный' });
  }

  take.status = 'taken';
  take.takenBy = adminId;
  take.targetAdminId = adminId; // move to admin's private folder
  db.takes[takeIndex] = take;
  saveDb();

  // Inform admin via telegram that they took the take
  const claimant = db.admins.find(a => a.id === adminId);
  const owner = db.admins.find(a => a.id === 'owner');

  if (claimant && owner && owner.tgId) {
    const text = `<b>✅ Тейк взят в работу!</b>\n\n` +
      `<b>Администратор:</b> ${claimant.nickname}\n` +
      `<b>Содержание тейка:</b>\n<i>${take.content}</i>`;
    await notifyTelegram(owner.tgId, text);
  }

  res.json(take);
});

// Add message to Dialogue (chat inside a take)
app.post('/api/takes/:id/dialogue', async (req, res) => {
  const { id } = req.params;
  const { sender, text } = req.body; // sender: 'user' | 'admin'

  if (!text || !sender) {
    return res.status(400).json({ error: 'Отправитель и текст сообщения обязательны' });
  }

  const takeIndex = db.takes.findIndex(t => t.id === id);
  if (takeIndex === -1) {
    return res.status(404).json({ error: 'Тейк не найден' });
  }

  const take = db.takes[takeIndex];
  if (!take.dialogue) take.dialogue = [];

  take.dialogue.push({
    sender,
    text,
    createdAt: new Date().toISOString()
  });

  db.takes[takeIndex] = take;
  saveDb();

  // Notify target admin on Telegram if user sends a message
  if (sender === 'user') {
    const targetAdminId = take.takenBy || take.targetAdminId;
    if (targetAdminId && targetAdminId !== 'all') {
      const targetAdmin = db.admins.find(a => a.id === targetAdminId);
      if (targetAdmin && targetAdmin.tgId) {
        const textMsg = `<b>💬 НОВОЕ СООБЩЕНИЕ В ТЕЙКЕ!</b>\n\n` +
          `От пользователя в чате тейка:\n` +
          `<i>"${text}"</i>`;
        await notifyTelegram(targetAdmin.tgId, textMsg);
      }
    }
  }

  res.json(take);
});

// Submit a Survey (Anketa)
app.post('/api/surveys', async (req, res) => {
  const { source, sphere, age, roleInterest, helpDescription } = req.body;

  if (!source || !sphere || !age || !roleInterest || !helpDescription) {
    return res.status(400).json({ error: 'Все поля анкеты обязательны' });
  }

  const newSurvey: Survey = {
    id: 'survey_' + Math.random().toString(36).substr(2, 9),
    source,
    sphere,
    age: Number(age),
    roleInterest,
    helpDescription,
    createdAt: new Date().toISOString()
  };

  db.surveys.push(newSurvey);
  saveDb();

  // Telegram alert to Owner
  const owner = db.admins.find(a => a.id === 'owner');
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
});

// Get Surveys (Owner/Admin restricted)
app.get('/api/surveys', (req, res) => {
  res.json(db.surveys);
});

// Get Prices
app.get('/api/prices', (req, res) => {
  res.json(db.prices);
});

// Get Unions
app.get('/api/unions', (req, res) => {
  res.json(db.unions);
});

// ---------------- VITE MIDDLEWARE SETUP ----------------

async function startServer() {
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
