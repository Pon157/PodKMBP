import { Telegraf } from 'telegraf';
import { Storage } from './src/db/storage.ts';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const proxy = process.env.TELEGRAM_PROXY; // Optional HTTP / SOCKS proxy

// Helper for downloading files with optional proxy
function downloadFileWithProxy(urlStr: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options: any = {
      method: 'GET'
    };
    if (proxy) {
      options.agent = new HttpsProxyAgent(proxy);
    }
    
    const req = https.request(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download file: status code ${res.statusCode}`));
        return;
      }
      const chunks: any[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    
    req.on('error', (err) => reject(err));
    req.end();
  });
}

function getMimeType(filename: string, defaultMime: string = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };
  return mimeMap[ext] || defaultMime;
}

// Upload file to S3 if active, or fallback to local disk
async function saveMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const isS3Configured = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);
  const resolvedMimeType = getMimeType(filename, mimeType);
  if (isS3Configured) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const endpoint = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net';
      const region = process.env.S3_REGION || 'ru-central1';
      const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;
      const bucket = process.env.S3_BUCKET_NAME!;

      const s3 = new S3Client({
        endpoint: endpoint || undefined,
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
        forcePathStyle: true,
      });

      const key = `uploads/${Date.now()}_${filename}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: resolvedMimeType,
      });

      await s3.send(command);

      if (process.env.S3_PUBLIC_URL) {
        const base = process.env.S3_PUBLIC_URL.replace(/\/$/, '');
        return `${base}/${key}`;
      }
      
      const cleanEndpoint = endpoint.replace(/\/$/, '');
      return `${cleanEndpoint}/${bucket}/${key}`;
    } catch (s3Err) {
      console.error('S3 upload in bot failed, falling back to local file:', s3Err);
    }
  }

  // Fallback to local storage
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

export let botInstance: Telegraf | null = null;

export async function sendTelegramNotification(tgId: string, text: string): Promise<boolean> {
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(tgId, text, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      console.error(`Error sending message via botInstance to ${tgId}:`, err);
    }
  }
  return false;
}

export async function sendTelegramNotificationWithMedia(tgId: string, text: string, mediaUrls: string[]): Promise<boolean> {
  if (botInstance) {
    try {
      if (mediaUrls && mediaUrls.length > 0) {
        const photosAndVideos: any[] = [];
        const audiosAndDocuments: { source: any; type: 'audio' | 'document' }[] = [];

        for (let i = 0; i < mediaUrls.length; i++) {
          const m = mediaUrls[i];
          let mediaSource: any;
          
          if (m.startsWith('/uploads/')) {
            const localPath = path.join(process.cwd(), m);
            if (fs.existsSync(localPath)) {
              mediaSource = { source: fs.createReadStream(localPath) };
            } else {
              mediaSource = m;
            }
          } else {
            mediaSource = m;
          }

          const isVideo = !!m.match(/\.(mp4|mov|webm|mkv|avi)$/i) || m.toLowerCase().includes('video');
          const isAudio = !!m.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) || m.toLowerCase().includes('audio');
          const isImage = !!m.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || m.toLowerCase().includes('image') || m.toLowerCase().includes('photo');

          if (isVideo) {
            photosAndVideos.push({
              type: 'video',
              media: mediaSource
            });
          } else if (isImage) {
            photosAndVideos.push({
              type: 'photo',
              media: mediaSource
            });
          } else if (isAudio) {
            audiosAndDocuments.push({
              source: mediaSource,
              type: 'audio'
            });
          } else {
            audiosAndDocuments.push({
              source: mediaSource,
              type: 'document'
            });
          }
        }

        // If we have photos or videos, we can send them as a single media group
        if (photosAndVideos.length > 0) {
          photosAndVideos[0].caption = text;
          photosAndVideos[0].parse_mode = 'HTML';

          await botInstance.telegram.sendMediaGroup(tgId, photosAndVideos);

          // Then send any audios or documents
          for (const item of audiosAndDocuments) {
            try {
              if (item.type === 'audio') {
                await botInstance.telegram.sendAudio(tgId, item.source);
              } else {
                await botInstance.telegram.sendDocument(tgId, item.source);
              }
            } catch (mediaErr) {
              console.error('Failed to send individual media item to Telegram:', mediaErr);
            }
          }
          return true;
        }

        // If we only have audios or documents, send the text first and then send the files
        if (audiosAndDocuments.length > 0) {
          await botInstance.telegram.sendMessage(tgId, text, { parse_mode: 'HTML' });
          for (const item of audiosAndDocuments) {
            try {
              if (item.type === 'audio') {
                await botInstance.telegram.sendAudio(tgId, item.source);
              } else {
                await botInstance.telegram.sendDocument(tgId, item.source);
              }
            } catch (mediaErr) {
              console.error('Failed to send individual media item to Telegram:', mediaErr);
            }
          }
          return true;
        }
      }
      
      // Fallback if no media items found
      await botInstance.telegram.sendMessage(tgId, text, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      console.error(`Error sending message with media via botInstance to ${tgId}:`, err);
      // Fallback text-only message
      try {
        await botInstance.telegram.sendMessage(tgId, text, { parse_mode: 'HTML' });
        return true;
      } catch (e) {
        console.error(`Fallback send text-only also failed to ${tgId}:`, e);
      }
    }
  }
  return false;
}

if (!token) {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN is not defined in your environment variables! Telegram bot will be disabled.');
} else {
  // Prevent 409 conflict during hot-reloads / restarts by stopping the previous active bot
  if ((global as any).activeBot) {
    try {
      console.log('🛑 Stopping existing Telegram Bot instance to avoid 409 conflict...');
      (global as any).activeBot.stop();
    } catch (e) {
      console.warn('⚠️ Error stopping existing bot:', e);
    }
  }

  let botOptions: any = {};
  if (proxy) {
    console.log(`📡 Configuring Telegram bot to use proxy: ${proxy}`);
    botOptions.telegram = {
      agent: new HttpsProxyAgent(proxy)
    };
  }

  const bot = new Telegraf(token, botOptions);
  botInstance = bot;
  (global as any).activeBot = bot;

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
                const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
                const buffer = await downloadFileWithProxy(downloadUrl);
                const avatarFilename = `avatar_${user.id}_${Date.now()}.jpg`;
                avatarUrl = await saveMedia(buffer, avatarFilename, 'image/jpeg');
                console.log('✅ Successfully downloaded and saved user avatar to:', avatarUrl);
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
      let typeLabel = 'Тейк';
      if (t.type === 'idea') {
        typeLabel = 'Идея';
      } else if (t.type === 'support_idea') {
        typeLabel = 'Идея в ТП';
      } else if (t.type === 'support_complaint') {
        typeLabel = 'Обращение в ТП';
      }
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
      try {
        const file = await ctx.telegram.getFile(highestResPhoto.file_id);
        if (file && file.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const buffer = await downloadFileWithProxy(downloadUrl);
          const mediaFilename = `tg_${tgId}_${Date.now()}_photo.jpg`;
          const url = await saveMedia(buffer, mediaFilename, 'image/jpeg');
          mediaUrls.push(url);
        } else {
          const fileLink = await ctx.telegram.getFileLink(highestResPhoto.file_id);
          mediaUrls.push(fileLink.toString());
        }
      } catch (e) {
        console.error('Failed to download user photo from Telegram:', e);
        const fileLink = await ctx.telegram.getFileLink(highestResPhoto.file_id);
        mediaUrls.push(fileLink.toString());
      }
      textContent = ctx.message.caption || '🖼️ [Фотография]';
    } 
    // Handle Video message
    else if ('video' in ctx.message) {
      try {
        const video = ctx.message.video;
        const file = await ctx.telegram.getFile(video.file_id);
        if (file && file.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const buffer = await downloadFileWithProxy(downloadUrl);
          const mediaFilename = `tg_${tgId}_${Date.now()}_video.mp4`;
          const url = await saveMedia(buffer, mediaFilename, video.mime_type || 'video/mp4');
          mediaUrls.push(url);
        } else {
          const fileLink = await ctx.telegram.getFileLink(video.file_id);
          mediaUrls.push(fileLink.toString());
        }
      } catch (e) {
        console.error('Failed to download user video from Telegram:', e);
        const fileLink = await ctx.telegram.getFileLink(ctx.message.video.file_id);
        mediaUrls.push(fileLink.toString());
      }
      textContent = ctx.message.caption || '🎥 [Видеозапись]';
    }
    // Handle Voice message
    else if ('voice' in ctx.message) {
      try {
        const voice = ctx.message.voice;
        const file = await ctx.telegram.getFile(voice.file_id);
        if (file && file.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const buffer = await downloadFileWithProxy(downloadUrl);
          const mediaFilename = `tg_${tgId}_${Date.now()}_voice.ogg`;
          const url = await saveMedia(buffer, mediaFilename, 'audio/ogg');
          mediaUrls.push(url);
        } else {
          const fileLink = await ctx.telegram.getFileLink(voice.file_id);
          mediaUrls.push(fileLink.toString());
        }
      } catch (e) {
        console.error('Failed to download user voice from Telegram:', e);
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        mediaUrls.push(fileLink.toString());
      }
      textContent = ctx.message.caption || '🎤 [Голосовое сообщение]';
    }
    // Handle Audio message
    else if ('audio' in ctx.message) {
      try {
        const audio = ctx.message.audio;
        const file = await ctx.telegram.getFile(audio.file_id);
        if (file && file.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const buffer = await downloadFileWithProxy(downloadUrl);
          const cleanName = (audio.file_name || 'audio.mp3').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const mediaFilename = `tg_${tgId}_${Date.now()}_${cleanName}`;
          const url = await saveMedia(buffer, mediaFilename, audio.mime_type || 'audio/mpeg');
          mediaUrls.push(url);
        } else {
          const fileLink = await ctx.telegram.getFileLink(audio.file_id);
          mediaUrls.push(fileLink.toString());
        }
      } catch (e) {
        console.error('Failed to download user audio from Telegram:', e);
        const fileLink = await ctx.telegram.getFileLink(ctx.message.audio.file_id);
        mediaUrls.push(fileLink.toString());
      }
      textContent = ctx.message.caption || `🎵 [Аудиозапись: ${ctx.message.audio.file_name || 'Трек'}]`;
    }
    // Handle plain text message
    else if ('text' in ctx.message) {
      textContent = ctx.message.text;
    } 
    // Handle general documents
    else if ('document' in ctx.message) {
      try {
        const doc = ctx.message.document;
        const file = await ctx.telegram.getFile(doc.file_id);
        if (file && file.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const buffer = await downloadFileWithProxy(downloadUrl);
          const cleanName = (doc.file_name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const mediaFilename = `tg_${tgId}_${Date.now()}_${cleanName}`;
          const url = await saveMedia(buffer, mediaFilename, doc.mime_type || 'application/octet-stream');
          mediaUrls.push(url);
        } else {
          const fileLink = await ctx.telegram.getFileLink(doc.file_id);
          mediaUrls.push(fileLink.toString());
        }
      } catch (e) {
        console.error('Failed to download user document from Telegram:', e);
        const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
        mediaUrls.push(fileLink.toString());
      }
      textContent = ctx.message.caption || `📎 [Документ: ${ctx.message.document.file_name || 'Файл'}]`;
    } else {
      return ctx.reply('<tg-emoji emoji-id="5447644880824181073">⚠️</tg-emoji> Данный тип вложений не поддерживается. Пожалуйста, прикрепите фото, видео, аудио или введите обычный текст.', { parse_mode: 'HTML' });
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
        const baseUrl = process.env.APP_URL || '';
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const chatLink = `${cleanBaseUrl}/admin-panel?takeId=${take.id}`;
        
        const adminNotification = 
          `<tg-emoji emoji-id="5443038326535759644">💬</tg-emoji> <b>СООБЩЕНИЕ ИЗ ТЕЛЕГРАМ-БОТА</b>\n\n` +
          `<b>В чате тейка:</b> <i>"${take.content.substring(0, 30)}..."</i>\n` +
          `<b>Пользователь:</b> ${ctx.from.first_name}\n` +
          `<b>Сообщение:</b> ${textContent}\n` +
          (mediaUrls.length > 0 ? `🖼️ <i>Прикреплены новые файлы (${mediaUrls.length} шт.)</i>\n` : '') +
          `\n🔗 <a href="${chatLink}">Ответьте через админ-панель на сайте!</a>`;
        
        if (mediaUrls && mediaUrls.length > 0) {
          await sendTelegramNotificationWithMedia(targetAdmin.tgId, adminNotification, mediaUrls);
        } else {
          await bot.telegram.sendMessage(targetAdmin.tgId, adminNotification, { parse_mode: 'HTML' });
        }
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
      
      // Clean webhook to avoid 409 conflict
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('🧹 Cleaned existing Telegram webhooks to prevent conflicts.');
      } catch (e) {
        console.warn('⚠️ Webhook clean warning:', e);
      }

      await bot.launch({
        allowedUpdates: [],
        dropPendingUpdates: true
      });
      console.log('🚀 Telegram Bot started successfully!');
    } catch (err) {
      console.error('💥 Critical error starting Telegram Bot:', err);
    }
  })();

  // Graceful stops
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
