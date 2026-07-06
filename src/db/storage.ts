import { db, testDbConnection } from './index.ts';
import { admins, takes, surveys, prices, unions } from './schema.ts';
import { eq, or, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Current active storage mode
let isDbConnected = false;

// Default Data for seeding / JSON fallback
export const defaultAdmins = [
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
];

export const defaultPrices = [
  { id: 'p1', title: 'Оформление профиля', price: '450 ₽', description: 'Полный комплект: аватарка, баннер, декоративные элементы в едином стиле канала.' },
  { id: 'p2', title: 'Анимация маскота', price: '700 ₽', description: 'Плавная 2D анимация вашего маскота (idle, эмоции, махание рукой, моргание).' },
  { id: 'p3', title: 'Кастомный арт маскота', price: '500 ₽', description: 'Рисунок маскота в любой позе и одежде по вашему ТЗ. Идеально для стикеров.' },
  { id: 'p4', title: 'Консультация по дизайну', price: '200 ₽', description: 'Разбор вашего текущего оформления и практические советы по улучшению юзабилити и визуала.' }
];

export const defaultUnions = [
  { id: 'u1', name: 'Союз Memory Base', link: 'https://t.me/memory_base', description: 'Крупнейшее содружество по борьбе с мошенничеством в сфере креативных каналов. Если вы столкнулись с мошенником, обращайтесь к ним!' }
];

export const defaultTakes = [
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
];

export const defaultSurveys = [
  {
    id: 's1',
    source: 'Из Телеграм канала',
    sphere: 'Диджитал арт и дизайн',
    age: 19,
    roleInterest: 'Помощник дизайнера / Модератор',
    helpDescription: 'Готов модерировать чат, делать превьюшки и помогать с оформлением постов.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

// Fallback JSON File DB functions
const JSON_DB_PATH = path.join(process.cwd(), 'db.json');

function readJsonDb(): any {
  try {
    if (fs.existsSync(JSON_DB_PATH)) {
      const data = fs.readFileSync(JSON_DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      // Ensure default structure
      if (!parsed.admins) parsed.admins = [...defaultAdmins];
      if (!parsed.takes) parsed.takes = [...defaultTakes];
      if (!parsed.surveys) parsed.surveys = [...defaultSurveys];
      if (!parsed.prices) parsed.prices = [...defaultPrices];
      if (!parsed.unions) parsed.unions = [...defaultUnions];
      return parsed;
    }
  } catch (err) {
    console.error('Failed to read json db, returning default schema', err);
  }
  return {
    admins: [...defaultAdmins],
    takes: [...defaultTakes],
    surveys: [...defaultSurveys],
    prices: [...defaultPrices],
    unions: [...defaultUnions]
  };
}

function writeJsonDb(data: any) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write to json db', err);
  }
}

// Global Storage Controller which decides dynamically
export const Storage = {
  async init() {
    isDbConnected = await testDbConnection();
    if (isDbConnected) {
      console.log('Database connected! Running schema checks & seeding if necessary...');
      try {
        await this.seedIfNeeded();
      } catch (err) {
        console.error('Failed to seed/verify PostgreSQL tables. Falling back to memory/JSON mode.', err);
        isDbConnected = false;
      }
    } else {
      console.log('PostgreSQL database not configured or offline. Running in standard JSON storage mode.');
    }
  },

  isPostgresMode() {
    return isDbConnected;
  },

  async seedIfNeeded() {
    // Check if Admins table is empty
    const adminRows = await db.select().from(admins).limit(1);
    if (adminRows.length === 0) {
      console.log('PostgreSQL tables are empty. Seeding initial data...');
      
      // Seed Admins
      await db.insert(admins).values(defaultAdmins);
      
      // Seed Prices
      await db.insert(prices).values(defaultPrices);
      
      // Seed Unions
      await db.insert(unions).values(defaultUnions);
      
      // Seed Takes
      await db.insert(takes).values(defaultTakes);
      
      // Seed Surveys
      await db.insert(surveys).values(defaultSurveys);
      
      console.log('Database successfully seeded with default data!');
    }
  },

  // --- Admins ---
  async getAdmins() {
    if (isDbConnected) {
      return await db.select().from(admins);
    } else {
      return readJsonDb().admins;
    }
  },

  async getAdminById(id: string) {
    if (isDbConnected) {
      const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
      return result[0] || null;
    } else {
      return readJsonDb().admins.find((a: any) => a.id === id) || null;
    }
  },

  async createAdmin(adminData: any) {
    if (isDbConnected) {
      await db.insert(admins).values(adminData);
      return adminData;
    } else {
      const data = readJsonDb();
      data.admins.push(adminData);
      writeJsonDb(data);
      return adminData;
    }
  },

  async updateAdmin(id: string, updateData: any) {
    if (isDbConnected) {
      await db.update(admins).set(updateData).where(eq(admins.id, id));
      return await this.getAdminById(id);
    } else {
      const data = readJsonDb();
      const idx = data.admins.findIndex((a: any) => a.id === id);
      if (idx !== -1) {
        data.admins[idx] = { ...data.admins[idx], ...updateData };
        writeJsonDb(data);
        return data.admins[idx];
      }
      return null;
    }
  },

  async deleteAdmin(id: string) {
    if (isDbConnected) {
      await db.delete(admins).where(eq(admins.id, id));
      return true;
    } else {
      const data = readJsonDb();
      const idx = data.admins.findIndex((a: any) => a.id === id);
      if (idx !== -1) {
        data.admins.splice(idx, 1);
        writeJsonDb(data);
        return true;
      }
      return false;
    }
  },

  // --- Takes & Ideas ---
  async getTakes() {
    if (isDbConnected) {
      return await db.select().from(takes);
    } else {
      return readJsonDb().takes;
    }
  },

  async getTakeById(id: string) {
    if (isDbConnected) {
      const result = await db.select().from(takes).where(eq(takes.id, id)).limit(1);
      return result[0] || null;
    } else {
      return readJsonDb().takes.find((t: any) => t.id === id) || null;
    }
  },

  async createTake(takeData: any) {
    if (isDbConnected) {
      await db.insert(takes).values(takeData);
      return takeData;
    } else {
      const data = readJsonDb();
      data.takes.push(takeData);
      writeJsonDb(data);
      return takeData;
    }
  },

  async updateTake(id: string, updateData: any) {
    if (isDbConnected) {
      await db.update(takes).set(updateData).where(eq(takes.id, id));
      return await this.getTakeById(id);
    } else {
      const data = readJsonDb();
      const idx = data.takes.findIndex((t: any) => t.id === id);
      if (idx !== -1) {
        data.takes[idx] = { ...data.takes[idx], ...updateData };
        writeJsonDb(data);
        return data.takes[idx];
      }
      return null;
    }
  },

  // --- Surveys ---
  async getSurveys() {
    if (isDbConnected) {
      return await db.select().from(surveys);
    } else {
      return readJsonDb().surveys;
    }
  },

  async createSurvey(surveyData: any) {
    if (isDbConnected) {
      await db.insert(surveys).values(surveyData);
      return surveyData;
    } else {
      const data = readJsonDb();
      data.surveys.push(surveyData);
      writeJsonDb(data);
      return surveyData;
    }
  },

  // --- Prices ---
  async getPrices() {
    if (isDbConnected) {
      return await db.select().from(prices);
    } else {
      return readJsonDb().prices;
    }
  },

  async getPriceById(id: string) {
    if (isDbConnected) {
      const result = await db.select().from(prices).where(eq(prices.id, id)).limit(1);
      return result[0] || null;
    } else {
      return readJsonDb().prices.find((p: any) => p.id === id) || null;
    }
  },

  async createPrice(priceData: any) {
    if (isDbConnected) {
      await db.insert(prices).values(priceData);
      return priceData;
    } else {
      const data = readJsonDb();
      data.prices.push(priceData);
      writeJsonDb(data);
      return priceData;
    }
  },

  async updatePrice(id: string, updateData: any) {
    if (isDbConnected) {
      await db.update(prices).set(updateData).where(eq(prices.id, id));
      return await this.getPriceById(id);
    } else {
      const data = readJsonDb();
      const idx = data.prices.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        data.prices[idx] = { ...data.prices[idx], ...updateData };
        writeJsonDb(data);
        return data.prices[idx];
      }
      return null;
    }
  },

  async deletePrice(id: string) {
    if (isDbConnected) {
      await db.delete(prices).where(eq(prices.id, id));
      return true;
    } else {
      const data = readJsonDb();
      const idx = data.prices.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        data.prices.splice(idx, 1);
        writeJsonDb(data);
        return true;
      }
      return false;
    }
  },

  // --- Unions ---
  async getUnions() {
    if (isDbConnected) {
      return await db.select().from(unions);
    } else {
      return readJsonDb().unions;
    }
  },

  async getUnionById(id: string) {
    if (isDbConnected) {
      const result = await db.select().from(unions).where(eq(unions.id, id)).limit(1);
      return result[0] || null;
    } else {
      return readJsonDb().unions.find((u: any) => u.id === id) || null;
    }
  },

  async createUnion(unionData: any) {
    if (isDbConnected) {
      await db.insert(unions).values(unionData);
      return unionData;
    } else {
      const data = readJsonDb();
      data.unions.push(unionData);
      writeJsonDb(data);
      return unionData;
    }
  },

  async updateUnion(id: string, updateData: any) {
    if (isDbConnected) {
      await db.update(unions).set(updateData).where(eq(unions.id, id));
      return await this.getUnionById(id);
    } else {
      const data = readJsonDb();
      const idx = data.unions.findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        data.unions[idx] = { ...data.unions[idx], ...updateData };
        writeJsonDb(data);
        return data.unions[idx];
      }
      return null;
    }
  },

  async deleteUnion(id: string) {
    if (isDbConnected) {
      await db.delete(unions).where(eq(unions.id, id));
      return true;
    } else {
      const data = readJsonDb();
      const idx = data.unions.findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        data.unions.splice(idx, 1);
        writeJsonDb(data);
        return true;
      }
      return false;
    }
  }
};
