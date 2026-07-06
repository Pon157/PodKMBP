import { Telegraf } from 'telegraf';
import { Storage } from './src/db/storage.ts';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const proxy = process.env.TELEGRAM_PROXY; // Optional HTTP / SOCKS proxy

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined in your environment variables!');
  process.exit(1);
}

let botOptions: any = {};
if (proxy) {
  console.log(`📡 Configuring Telegram bot to use proxy: ${proxy}`);
  botOptions.telegram = {
    agent: new HttpsProxyAgent(proxy)
  };
}

const bot = new Telegraf(token, botOptions);

// Initialize DB Connection
console.log('📦 Connecting bot to database/storage engine...');
await Storage.init();
console.log('✅ Database connected to Telegram Bot!');

// Bot /start handler
bot.start(async (ctx) => {
  const startPayload = ctx.payload; // Deep-linked payload: "login_CODE"
  const user = ctx.from;

  if (startPayload && startPayload.startsWith('login_')) {
    const code = startPayload.replace('login_', '');
    console.log(`🔐 Received login attempt with code: ${code} for Telegram user: ${user.id} (${user.username || 'no-username'})`);
    
    try {
      const session = await Storage.getTgSession(code);
      if (session) {
        await Storage.authenticateTgSession(code, String(user.id), user.username || null, user.first_name || null);
        await ctx.reply(
          `🎉 *Вы успешно вошли на платформу в качестве ${user.first_name || 'пользователя'}!*\n\n` +
          `Теперь вернитесь на сайт — вы будете автоматически авторизованы и сможете оставлять тейки/идеи, а также отслеживать ответы.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply('❌ *Ошибка:* Код входа устарел или не существует. Пожалуйста, инициируйте вход на сайте заново.', { parse_mode: 'Markdown' });
      }
    } catch (err: any) {
      console.error('Error in login auth via bot:', err);
      await ctx.reply('❌ Произошла техническая ошибка при авторизации. Попробуйте снова.');
    }
  } else {
    await ctx.reply(
      `👋 *Привет, ${user.first_name || 'пользователь'}! Это официальный бот обратной связи.* \n\n` +
      `Здесь вы можете:\n` +
      `1️⃣ *Получать мгновенные уведомления* о статусе ваших тейков/идей.\n` +
      `2️⃣ *Вести живой диалог* с администрацией платформы прямо через чат бота!\n` +
      `3️⃣ *Отправлять фотографии* и дополнительные медиа-файлы.\n\n` +
      `💻 Чтобы отправить свой первый тейк или войти в личный кабинет, откройте сайт платформы и нажмите *"Войти через Telegram"*!`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Bot /my_takes handler
bot.command('my_takes', async (ctx) => {
  try {
    const tgId = String(ctx.from.id);
    const userTakes = await Storage.getUserTakes(tgId);
    
    if (!userTakes || userTakes.length === 0) {
      return ctx.reply('📋 *У вас пока нет отправленных тейков или идей.*\nПодайте свой первый тейк на нашем сайте!', { parse_mode: 'Markdown' });
    }

    let text = '📋 *Ваши активные тейки и идеи:*\n\n';
    
    const inlineButtons = userTakes.map((t: any, i: number) => {
      const statusEmoji = t.status === 'pending' ? '⏳ Ожидает' : t.status === 'taken' ? '💬 В работе' : '✅ Решено';
      const typeLabel = t.type === 'take' ? 'Тейк' : 'Идея';
      text += `🔹 *${i + 1}. [${typeLabel}]* "${t.content.substring(0, 35)}..."\n   *Статус:* ${statusEmoji}\n   *ID:* \`${t.id}\`\n\n`;
      
      return [{
        text: `💬 Диалог: "${t.content.substring(0, 20)}..."`,
        callback_data: `select_${t.id}`
      }];
    });

    text += `*Выберите тейк ниже, чтобы сделать его активным для переписки прямо в этом боте!*`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: inlineButtons.slice(0, 8) // Limit to 8 for aesthetic styling
      },
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Error fetching user takes:', err);
    await ctx.reply('❌ Ошибка при получении ваших тейков.');
  }
});

// Inline action handler for selecting a take
bot.action(/^select_(.+)$/, async (ctx) => {
  try {
    const takeId = ctx.match[1];
    const take = await Storage.getTakeById(takeId);
    
    if (!take) {
      return ctx.answerCbQuery('❌ Тейк не найден');
    }
    if (take.userTgId !== String(ctx.from.id)) {
      return ctx.answerCbQuery('❌ Нет доступа к этому тейку');
    }

    await Storage.setTgUserState(String(ctx.from.id), take.id);
    await ctx.answerCbQuery('✅ Чат успешно выбран!');
    await ctx.reply(
      `✍️ *Активирован диалог по тейку:*\n` +
      `_"${take.content.substring(0, 80)}..."_\n\n` +
      `💬 Отправьте любое сообщение или фото сюда, и оно мгновенно доставится администраторам!`
    );
  } catch (err) {
    console.error('Error selecting active take:', err);
    await ctx.answerCbQuery('❌ Ошибка');
  }
});

// Command handler for manual selection
bot.command('select', async (ctx) => {
  try {
    const takeId = ctx.payload;
    if (!takeId) {
      return ctx.reply('⚠️ *Использование:* `/select <ID_тейка>`', { parse_mode: 'Markdown' });
    }

    const take = await Storage.getTakeById(takeId);
    if (!take) {
      return ctx.reply('❌ *Тейк с таким ID не найден.*', { parse_mode: 'Markdown' });
    }
    if (take.userTgId !== String(ctx.from.id)) {
      return ctx.reply('❌ *У вас нет прав доступа к этому тейку.*', { parse_mode: 'Markdown' });
    }

    await Storage.setTgUserState(String(ctx.from.id), take.id);
    await ctx.reply(
      `✍️ *Активирован диалог по тейку:*\n` +
      `_"${take.content.substring(0, 80)}..."_\n\n` +
      `💬 Отправьте любое сообщение или фото сюда, и оно мгновенно доставится администраторам!`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Manual select command error:', err);
    await ctx.reply('❌ Произошла ошибка при выборе тейка.');
  }
});

// General message receiver (handles user replies/media sent directly into the bot)
bot.on('message', async (ctx) => {
  try {
    const tgId = String(ctx.from.id);
    const state = await Storage.getTgUserState(tgId);

    if (!state || !state.activeTakeId) {
      return ctx.reply(
        `ℹ️ *Вы не выбрали активный диалог.*\n\n` +
        `Чтобы отправлять сообщения администраторам через бота, пожалуйста, выберите нужный тейк:\n` +
        `📝 Посмотрите список по команде: /my_takes`,
        { parse_mode: 'Markdown' }
      );
    }

    const take = await Storage.getTakeById(state.activeTakeId);
    if (!take) {
      return ctx.reply('❌ Выбранный ранее диалог больше не доступен. Используйте /my_takes, чтобы выбрать другой.');
    }

    let textContent = '';
    let mediaUrls: string[] = [];

    // Handle Photo message
    if ('photo' in ctx.message) {
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileLink = await ctx.telegram.getFileLink(highestResPhoto.file_id);
      mediaUrls.push(fileLink.toString());
      textContent = ctx.message.caption || '🖼️ [Фотография]';
    } 
    // Handle plain text message
    else if ('text' in ctx.message) {
      textContent = ctx.message.text;
    } 
    // Handle general documents
    else if ('document' in ctx.message) {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
      mediaUrls.push(fileLink.toString());
      textContent = ctx.message.caption || `📎 [Документ: ${ctx.message.document.file_name || 'Файл'}]`;
    } else {
      return ctx.reply('⚠️ Данный тип вложений не поддерживается. Пожалуйста, прикрепите фото или введите обычный текст.');
    }

    // Append message to take dialog
    const dialogue = take.dialogue || [];
    dialogue.push({
      sender: 'user',
      text: textContent,
      createdAt: new Date().toISOString(),
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
    });

    await Storage.updateTake(take.id, { dialogue });

    // Notify the target admin (the one who claimed it, or the default target/owner)
    const targetAdminId = take.takenBy || take.targetAdminId;
    if (targetAdminId && targetAdminId !== 'all') {
      const allAdmins = await Storage.getAdmins();
      const targetAdmin = allAdmins.find(a => a.id === targetAdminId);
      
      if (targetAdmin && targetAdmin.tgId) {
        const adminNotification = 
          `<b>💬 СООБЩЕНИЕ ИЗ ТЕЛЕГРАМ-БОТА</b>\n\n` +
          `<b>В чате тейка:</b> <i>"${take.content.substring(0, 30)}..."</i>\n` +
          `<b>Пользователь:</b> ${ctx.from.first_name}\n` +
          `<b>Сообщение:</b> ${textContent}\n` +
          (mediaUrls.length > 0 ? `🖼️ <i>Прикреплены новые файлы (${mediaUrls.length} шт.)</i>\n` : '') +
          `\n🔗 <i>Ответьте через админ-панель на сайте!</i>`;
        
        // Use standard telegram notifier
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const notifyUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetAdmin.tgId,
            text: adminNotification,
            parse_mode: 'HTML',
          }),
        });
      }
    }

    await ctx.reply('✅ *Ваше сообщение отправлено администрации!* Вы получите ответ прямо в этот чат.', { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('Error handling direct message in bot:', err);
    await ctx.reply('❌ Произошла ошибка при отправке вашего сообщения.');
  }
});

// Run Bot
bot.launch().then(() => {
  console.log('🚀 Telegram Bot started successfully in standalone mode!');
}).catch((err) => {
  console.error('💥 Critical error starting Telegram Bot:', err);
});

// Graceful stops
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
