import { pgTable, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

// 1. Admins Table
export const admins = pgTable('admins', {
  id: text('id').primaryKey(), // Using text to match existing IDs like 'owner', 'kibo', and generated IDs
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  nickname: text('nickname').notNull(),
  role: text('role').notNull(),
  aboutMe: text('about_me').notNull().default(''),
  hobbies: text('hobbies').notNull().default(''),
  photoUrl: text('photo_url').notNull().default(''),
  musicUrl: text('music_url').notNull().default(''),
  tgId: text('tg_id').notNull().default(''),
  isInRest: boolean('is_in_rest').notNull().default(false),
});

// 2. Takes (Takes and Ideas) Table
export const takes = pgTable('takes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'take' | 'idea'
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  targetAdminId: text('target_admin_id').notNull().default('all'),
  status: text('status').notNull().default('pending'), // 'pending' | 'taken' | 'resolved'
  takenBy: text('taken_by'),
  createdAt: text('created_at').notNull(),
  dialogue: jsonb('dialogue').$type<Array<{
    sender: 'user' | 'admin';
    text: string;
    createdAt: string;
    mediaUrls?: string[];
  }>>().default([]),
  userTgId: text('user_tg_id'),
  userTgUsername: text('user_tg_username'),
  userTgName: text('user_tg_name'),
});

// 3. Surveys Table
export const surveys = pgTable('surveys', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  sphere: text('sphere').notNull(),
  age: integer('age').notNull(),
  roleInterest: text('role_interest').notNull(),
  helpDescription: text('help_description').notNull(),
  createdAt: text('created_at').notNull(),
});

// 4. Prices Table (Now completely editable in Admin Panel)
export const prices = pgTable('prices', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  price: text('price').notNull(),
  description: text('description').notNull(),
});

// 5. Unions Table
export const unions = pgTable('unions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  link: text('link').notNull(),
  description: text('description').notNull(),
});

// 6. Telegram Sessions Table
export const tgSessions = pgTable('tg_sessions', {
  code: text('code').primaryKey(),
  tgId: text('tg_id'),
  username: text('username'),
  firstName: text('first_name'),
  avatarUrl: text('avatar_url'),
  status: text('status').notNull().default('pending'), // 'pending' | 'authenticated'
  createdAt: text('created_at').notNull(),
});

// 7. Telegram User States Table
export const tgUserStates = pgTable('tg_user_states', {
  tgId: text('tg_id').primaryKey(),
  activeTakeId: text('active_take_id'),
  updatedAt: text('updated_at').notNull(),
});
