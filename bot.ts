import { Telegraf } from 'telegraf';
import { Storage } from './src/db/storage.ts';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const proxy = process.env.TELEGRAM_PROXY; // Optional HTTP / SOCKS proxy

if (!token) {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN is not defined in your environment variables! Telegram bot will be disabled.');
} else {
  let botOptions: any = {};
  if (proxy) {
    console.log(`📡 Configuring Telegram bot to use proxy: ${proxy}`);
    botOptions.telegram = {
      agent: new HttpsProxyAgent(proxy)
    };
  }

  const bot = new Telegraf(token, botOptions);

  // Initialize DB Connection (non-blocking async to avoid top-level await)
  (async () => {
    try {
      console.log('📦 Connecting bot to database/storage engine...');
      await Storage.init();
      console.log('✅ Database connected to Telegram Bot!');
    } catch (err) {
      console.error('❌ Failed to initialize database in bot:', err);
    }
  })();

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
        let avatarUrl: string | null = null;
        try {
          const photos = await ctx.telegram.getUserProfilePhotos(user.id, 0, 1);
          if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
            const fileId = photos.photos[0][0].file_id;
            const file = await ctx.telegram.getFile(fileId);
            if (file && file.file_path) {
              avatarUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            }
          }
        } catch (e) {
          console.error('Failed to fetch user avatar from Telegram:', e);
        }

        await Storage.authenticateTgSession(code, String(user.id), user.username || null, user.first_name || null, avatarUrl);
        await ctx.reply(
          `<tg-emoji emoji-id="5461151367559141950">🎉</tg-emoji> <b>Вы успешно вошли на платформу в качестве ${user.first_name || 'пользователя'}!</b>\n\n` +
          `Теперь вернитесь на сайт — вы будете автоматически авторизованы и сможете оставлять тейки/идеи, а также отслеживать ответы.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>Ошибка:</b> Код входа устарел или не существует. Пожалуйста, инициируйте вход на сайте заново.', { parse_mode: 'HTML' });
      }
    } catch (err: any) {
      console.error('Error in login auth via bot:', err);
      await ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> Произошла техническая ошибка при авторизации. Попробуйте снова.', { parse_mode: 'HTML' });
    }
  } else {
    await ctx.reply(
      `<tg-emoji emoji-id="5461117441612462242">🙂</tg-emoji> <b>Привет, ${user.first_name || 'пользователь'}! Это официальный бот обратной связи.</b> \n\n` +
      `Здесь вы можете:\n` +
      `1️⃣ <tg-emoji emoji-id="5458603043203327669">🔔</tg-emoji> <b>Получать мгновенные уведомления</b> о статусе ваших тейков/идей.\n` +
      `2️⃣ <tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> <b>Вести живой диалог</b> с администрацией платформы прямо через чат бота!\n` +
      `3️⃣ <tg-emoji emoji-id="5467538555158943525">💭</tg-emoji> <b>Отправлять фотографии</b> и дополнительные медиа-файлы.\n\n` +
      `💻 <tg-emoji emoji-id="5447410659077661506">🌐</tg-emoji> Чтобы отправить свой первый тейк или войти в личный кабинет, откройте сайт платформы и нажмите <i>"Войти через Telegram"</i>!`,
      { parse_mode: 'HTML' }
    );
  }
});

// Bot /my_takes handler
bot.command('my_takes', async (ctx) => {
  try {
    const tgId = String(ctx.from.id);
    const userTakes = await Storage.getUserTakes(tgId);
    
    if (!userTakes || userTakes.length === 0) {
      return ctx.reply('<tg-emoji emoji-id="5231200819986047254">📊</tg-emoji> <b>У вас пока нет отправленных тейков или идей.</b>\nПодайте свой первый тейк на нашем сайте!', { parse_mode: 'HTML' });
    }

    let text = '<tg-emoji emoji-id="5231200819986047254">📊</tg-emoji> <b>Ваши активные тейки и идеи:</b>\n\n';
    
    const inlineButtons = userTakes.map((t: any, i: number) => {
      const statusEmoji = t.status === 'pending' 
        ? '<tg-emoji emoji-id="5386367538735104399">⏳</tg-emoji> Ожидает' 
        : t.status === 'taken' 
          ? '<tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> В работе' 
          : '<tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji> Решено';
      const typeLabel = t.type === 'take' ? 'Тейк' : 'Идея';
      text += `<tg-emoji emoji-id="5427168083074628963">💎</tg-emoji> <b>${i + 1}. [${typeLabel}]</b> "${t.content.substring(0, 35)}..."\n   <b>Статус:</b> ${statusEmoji}\n   <b>ID:</b> <code>${t.id}</code>\n\n`;
      
      return [{
        text: `💬 Диалог: "${t.content.substring(0, 20)}..."`,
        callback_data: `select_${t.id}`
      }];
    });

    text += `<b>Выберите тейк ниже, чтобы сделать его активным для переписки прямо в этом боте!</b>`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: inlineButtons.slice(0, 8) // Limit to 8 for aesthetic styling
      },
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('Error fetching user takes:', err);
    await ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> Ошибка при получении ваших тейков.', { parse_mode: 'HTML' });
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
    await ctx.answerCbQuery('✔️ Чат успешно выбран!');
    await ctx.reply(
      `<tg-emoji emoji-id="5395444784611480792">✏️</tg-emoji> <b>Активирован диалог по тейку:</b>\n` +
      `<i>"${take.content.substring(0, 80)}..."</i>\n\n` +
      `<tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> Отправьте любое сообщение или фото сюда, и оно мгновенно доставится администраторам!`,
      { parse_mode: 'HTML' }
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
      return ctx.reply('<tg-emoji emoji-id="5447644880824181073">⚠️</tg-emoji> <b>Использование:</b> <code>/select &lt;ID_тейка&gt;</code>', { parse_mode: 'HTML' });
    }

    const take = await Storage.getTakeById(takeId);
    if (!take) {
      return ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>Тейк с таким ID не найден.</b>', { parse_mode: 'HTML' });
    }
    if (take.userTgId !== String(ctx.from.id)) {
      return ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>У вас нет прав доступа к этому тейку.</b>', { parse_mode: 'HTML' });
    }

    await Storage.setTgUserState(String(ctx.from.id), take.id);
    await ctx.reply(
      `<tg-emoji emoji-id="5395444784611480792">✏️</tg-emoji> <b>Активирован диалог по тейку:</b>\n` +
      `<i>"${take.content.substring(0, 80)}..."</i>\n\n` +
      `<tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> Отправьте любое сообщение или фото сюда, и оно мгновенно доставится администраторам!`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Manual select command error:', err);
    await ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> Произошла ошибка при выборе тейка.', { parse_mode: 'HTML' });
  }
});

// General message receiver (handles user replies/media sent directly into the bot)
bot.on('message', async (ctx) => {
  try {
    const tgId = String(ctx.from.id);
    const state = await Storage.getTgUserState(tgId);

    if (!state || !state.activeTakeId) {
      return ctx.reply(
        `<tg-emoji emoji-id="5334544901428229844">ℹ️</tg-emoji> <b>Вы не выбрали активный диалог.</b>\n\n` +
        `Чтобы отправлять сообщения администраторам через бота, пожалуйста, выберите нужный тейк:\n` +
        `<tg-emoji emoji-id="5395444784611480792">✏️</tg-emoji> Посмотрите список по команде: /my_takes`,
        { parse_mode: 'HTML' }
      );
    }

    const take = await Storage.getTakeById(state.activeTakeId);
    if (!take) {
      return ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> Выбранный ранее диалог больше не доступен. Используйте /my_takes, чтобы выбрать другой.', { parse_mode: 'HTML' });
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
      return ctx.reply('<tg-emoji emoji-id="5447644880824181073">⚠️</tg-emoji> Данный тип вложений не поддерживается. Пожалуйста, прикрепите фото или введите обычный текст.', { parse_mode: 'HTML' });
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
          `<tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> <b>СООБЩЕНИЕ ИЗ ТЕЛЕГРАМ-БОТА</b>\n\n` +
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

    await ctx.reply('<tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji> <b>Ваше сообщение отправлено администрации!</b> Вы получите ответ прямо в этот чат.', { parse_mode: 'HTML' });

  } catch (err) {
    console.error('Error handling direct message in bot:', err);
    await ctx.reply('<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> Произошла ошибка при отправке вашего сообщения.', { parse_mode: 'HTML' });
  }
});

  // Run Bot
  (async () => {
    try {
      // Small delay to let storage initialize first
      await new Promise(r => setTimeout(r, 1000));
      await bot.launch();
      console.log('🚀 Telegram Bot started successfully!');
    } catch (err) {
      console.error('💥 Critical error starting Telegram Bot:', err);
    }
  })();

  // Graceful stops
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
