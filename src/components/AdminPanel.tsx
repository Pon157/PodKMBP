import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, UserCheck, MessageSquare, FileText, Settings, LogOut, 
  Plus, Edit2, Trash2, Send, CornerDownRight, Check, AlertCircle, ShieldAlert,
  Clock, CheckCircle2, Lightbulb, AlertTriangle, Image, Music, Download, Play
} from 'lucide-react';
import { MusicPlayer } from './MusicPlayer';

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

interface AdminPanelProps {
  currentAdmin: Admin;
  onLogout: () => void;
  activeUsersCount: number;
  onRefreshAdmins?: () => void;
}

export function parseProfileUrls(urlField: string | null | undefined): string[] {
  if (!urlField) return [];
  const convertTelegramUrl = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.startsWith('@')) {
      return `https://t.me/i/userpic/320/${trimmed.substring(1)}.jpg`;
    }
    const tmeRegex = /(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})\/?$/i;
    const match = trimmed.match(tmeRegex);
    if (match && match[1]) {
      return `https://t.me/i/userpic/320/${match[1]}.jpg`;
    }
    return trimmed;
  };

  try {
    const trimmed = urlField.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(convertTelegramUrl);
      }
    }
  } catch (e) {
    // legacy or single URL fallback
  }
  if (urlField.includes(',')) {
    return urlField.split(',').map(s => s.trim()).filter(Boolean).map(convertTelegramUrl);
  }
  return [urlField.trim()].filter(Boolean).map(convertTelegramUrl);
}

export function parseMediaUrls(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  try {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    }
  } catch (err) {
    // fallback
  }
  return [imageUrl.trim()].filter(Boolean);
}

export function downloadAllAttachments(urls: string[]): void {
  if (!urls || urls.length === 0) return;
  urls.forEach((url, idx) => {
    const a = document.createElement('a');
    a.href = url;
    // Get filename or use index fallback
    const filename = url.substring(url.lastIndexOf('/') + 1) || `attachment-${idx + 1}`;
    a.setAttribute('download', filename);
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentAdmin,
  onLogout,
  activeUsersCount,
  onRefreshAdmins,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'general_takes' | 'personal_takes' | 'surveys' | 'manage_admins' | 'manage_prices' | 'support'>('profile');
  
  // Data States
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [takes, setTakes] = useState<Take[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [pricesList, setPricesList] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<{ postgresMode: boolean; status: string; error?: string | null } | null>(null);
  
  // Form States for edit profile
  const [nickname, setNickname] = useState(currentAdmin.nickname);
  const [role, setRole] = useState(currentAdmin.role);
  const [aboutMe, setAboutMe] = useState(currentAdmin.aboutMe);
  const [hobbies, setHobbies] = useState(currentAdmin.hobbies);
  const [tgId, setTgId] = useState(currentAdmin.tgId);
  const [password, setPassword] = useState('');
  const [isInRest, setIsInRest] = useState(currentAdmin.isInRest || false);
  
  const [photosList, setPhotosList] = useState<string[]>(() => parseProfileUrls(currentAdmin.photoUrl));
  const [musicList, setMusicList] = useState<string[]>(() => parseProfileUrls(currentAdmin.musicUrl));

  // Sync profile editing state if currentAdmin changes
  useEffect(() => {
    setNickname(currentAdmin.nickname);
    setRole(currentAdmin.role);
    setAboutMe(currentAdmin.aboutMe);
    setHobbies(currentAdmin.hobbies);
    setTgId(currentAdmin.tgId);
    setPhotosList(parseProfileUrls(currentAdmin.photoUrl));
    setMusicList(parseProfileUrls(currentAdmin.musicUrl));
    setIsInRest(currentAdmin.isInRest || false);
  }, [currentAdmin]);
  
  // New Admin Form State (Owner only)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newTgId, setNewTgId] = useState('');
  
  // Active chat state
  const [activeTakeChatId, setActiveTakeChatId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMediaList, setReplyMediaList] = useState<string[]>([]);
  const [replyMediaLoading, setReplyMediaLoading] = useState(false);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = currentAdmin.id === 'owner';

  // Fetch all required data on mount
  useEffect(() => {
    fetchAdmins();
    fetchTakes();
    fetchDbStatus();
    if (isOwner) {
      fetchSurveys();
      fetchPrices();
    }
  }, [currentAdmin, isOwner]);

  // Deep Link handler for takeId parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const takeId = params.get('takeId');
    if (takeId && takes.length > 0) {
      const foundTake = takes.find(t => t.id === takeId);
      if (foundTake) {
        setActiveTakeChatId(takeId);
        if (foundTake.takenBy === currentAdmin.id || foundTake.targetAdminId === currentAdmin.id) {
          setActiveTab('personal_takes');
        } else {
          setActiveTab('general_takes');
        }
        // Clean up query param from URL so user can normally navigate tabs
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [takes, currentAdmin.id]);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.error('Failed to fetch db status', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      setAdmins(data);
      onRefreshAdmins?.();
    } catch (err) {
      console.error('Failed to fetch admins', err);
    }
  };

  const fetchTakes = async () => {
    try {
      const res = await fetch(`/api/takes?adminId=${currentAdmin.id}`);
      const data = await res.json();
      setTakes(data);
    } catch (err) {
      console.error('Failed to fetch takes', err);
    }
  };

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/surveys');
      const data = await res.json();
      setSurveys(data);
    } catch (err) {
      console.error('Failed to fetch surveys', err);
    }
  };

  // Price management states & functions
  const [priceTitle, setPriceTitle] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [priceDescription, setPriceDescription] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  const fetchPrices = async () => {
    try {
      const res = await fetch('/api/prices');
      const data = await res.json();
      setPricesList(data);
    } catch (err) {
      console.error('Failed to fetch prices', err);
    }
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceTitle || !priceValue || !priceDescription) {
      showStatus('Заполните все поля цены', 'error');
      return;
    }
    try {
      const url = editingPriceId ? `/api/prices/${editingPriceId}` : '/api/prices';
      const method = editingPriceId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: priceTitle,
          price: priceValue,
          description: priceDescription,
          adminId: currentAdmin.id
        })
      });

      if (res.ok) {
        showStatus(editingPriceId ? 'Услуга успешно обновлена!' : 'Услуга успешно добавлена!', 'success');
        setPriceTitle('');
        setPriceValue('');
        setPriceDescription('');
        setEditingPriceId(null);
        fetchPrices();
      } else {
        showStatus('Ошибка сохранения услуги', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка при сохранении цены', 'error');
    }
  };

  const handleDeletePrice = async (id: string) => {
    if (!window.confirm('Удалить эту услугу из прайса?')) return;
    try {
      const res = await fetch(`/api/prices/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentAdmin.id })
      });
      if (res.ok) {
        showStatus('Услуга удалена из прайса', 'success');
        fetchPrices();
      } else {
        showStatus('Ошибка удаления услуги', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка при удалении', 'error');
    }
  };

  const handleStartEditPrice = (priceItem: any) => {
    setEditingPriceId(priceItem.id);
    setPriceTitle(priceItem.title);
    setPriceValue(priceItem.price);
    setPriceDescription(priceItem.description);
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              base64Data,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            reject(new Error(err.error || 'Ошибка при загрузке файла'));
            return;
          }
          const data = await res.json();
          resolve(data.url);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  };

  const showStatus = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Update own profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admins/${currentAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          role,
          aboutMe,
          hobbies,
          photoUrl: JSON.stringify(photosList),
          musicUrl: JSON.stringify(musicList),
          tgId,
          isInRest,
          password: password || undefined,
        }),
      });
      if (res.ok) {
        showStatus('Профиль успешно обновлен!', 'success');
        fetchAdmins();
        setPassword('');
        // Update local memory
        const updatedUser = await res.json();
        localStorage.setItem('wine_admin_session', JSON.stringify(updatedUser));
      } else {
        showStatus('Ошибка обновления профиля', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка при отправке', 'error');
    }
  };

  // Create new Admin (Owner only)
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newNickname) {
      showStatus('Заполните обязательные поля', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          nickname: newNickname,
          role: newRole || 'Администратор',
          tgId: newTgId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Администратор ${newNickname} успешно добавлен!`, 'success');
        setNewUsername('');
        setNewPassword('');
        setNewNickname('');
        setNewRole('');
        setNewTgId('');
        fetchAdmins();
      } else {
        showStatus(data.error || 'Ошибка при добавлении администратора', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка при создании администратора', 'error');
    }
  };

  // Delete Admin
  const handleDeleteAdmin = async (id: string) => {
    if (!window.confirm('Вы действительно хотите удалить этого администратора?')) return;
    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showStatus('Администратор успешно удален', 'success');
        fetchAdmins();
      } else {
        const d = await res.json();
        showStatus(d.error || 'Ошибка удаления', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка', 'error');
    }
  };

  // Claim general take
  const handleClaimTake = async (takeId: string) => {
    try {
      const res = await fetch(`/api/takes/${takeId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentAdmin.id }),
      });
      if (res.ok) {
        showStatus('Тейк успешно взят в работу!', 'success');
        fetchTakes();
        setActiveTab('personal_takes');
        setActiveTakeChatId(takeId);
      } else {
        showStatus('Не удалось забрать тейк', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка', 'error');
    }
  };

  const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setReplyMediaLoading(true);
    const urls: string[] = [];
    try {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const url = await handleFileUpload(file);
        urls.push(url);
      }
      setReplyMediaList((prev) => [...prev, ...urls]);
    } catch (err: any) {
      showStatus(err.message || 'Ошибка загрузки файлов', 'error');
    } finally {
      setReplyMediaLoading(false);
    }
  };

  // Send dialogue message
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && replyMediaList.length === 0) || !activeTakeChatId) return;
    try {
      const res = await fetch(`/api/takes/${activeTakeChatId}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'admin',
          text: replyText.trim() || '🖼️ [Изображение]',
          mediaUrls: replyMediaList,
        }),
      });
      if (res.ok) {
        setReplyText('');
        setReplyMediaList([]);
        fetchTakes();
      } else {
        showStatus('Ошибка отправки сообщения', 'error');
      }
    } catch (err) {
      showStatus('Произошла ошибка', 'error');
    }
  };

  const activeChatTake = takes.find(t => t.id === activeTakeChatId);

  return (
    <div className="w-full min-h-screen bg-wine text-gummy font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-wine-dark/40 border-4 border-gummy rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle decorative cloud background */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gummy/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gummy/5 rounded-full blur-2xl pointer-events-none" />

        {/* TOP STATUS ROW */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b-2 border-gummy/30">
          <div>
            <span className="text-xs uppercase tracking-widest text-gummy/60 font-mono">Панель управления</span>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gummy mt-1">
              Привет, <span className="text-white underline decoration-gummy">{currentAdmin.nickname}</span>
            </h1>
            <p className="text-sm text-gummy/70 mt-1">Роль: {currentAdmin.role}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Database connection status badge */}
            <div 
              className="bg-wine border border-gummy/40 rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-lg cursor-help transition-all hover:border-gummy"
              title={dbStatus?.postgresMode ? 'Успешное подключение к PostgreSQL!' : `Ошибка подключения: ${dbStatus?.error || 'неизвестная ошибка'}`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dbStatus?.postgresMode ? 'bg-green-400' : 'bg-orange-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dbStatus?.postgresMode ? 'bg-green-500' : 'bg-orange-500'}`}></span>
              </span>
              <div className="text-left font-mono">
                <span className="block text-[10px] leading-none uppercase text-gummy/50 font-bold">База данных</span>
                <span className="text-xs font-bold text-white">{dbStatus?.postgresMode ? 'PostgreSQL' : 'Локальный JSON'}</span>
              </div>
            </div>

            {/* Real-time active users indicator */}
            <div className="bg-wine border border-gummy/40 rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
              </span>
              <div className="text-left font-mono">
                <span className="block text-[10px] leading-none uppercase text-gummy/50 font-bold">Онлайн на сайте</span>
                <span className="text-lg font-bold text-white">{activeUsersCount} чел.</span>
              </div>
            </div>

            <button
              id="logout-button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-gummy text-wine font-bold hover:bg-white hover:scale-105 transition-all flex items-center gap-2 text-sm shadow-md"
            >
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </div>

        {/* Global status message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl mb-6 flex items-center gap-3 border ${
              message.type === 'success' 
                ? 'bg-green-950/60 border-green-500/50 text-green-300' 
                : 'bg-red-950/60 border-red-500/50 text-red-300'
            }`}
          >
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* SIDEBAR NAVIGATION */}
          <div className="flex flex-col gap-2 bg-wine-dark/40 border border-gummy/20 rounded-xl p-3 h-fit">
            <button
              id="tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === 'profile' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
              }`}
            >
              <UserCheck size={18} /> Мой профиль
            </button>

            <button
              id="tab-general-takes"
              onClick={() => setActiveTab('general_takes')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                activeTab === 'general_takes' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={18} /> Общая папка тейков
              </div>
              <span className="bg-wine-dark/50 text-gummy text-xs px-2 py-0.5 rounded-full font-mono border border-gummy/20">
                {takes.filter(t => t.targetAdminId === 'all').length}
              </span>
            </button>

            <button
              id="tab-personal-takes"
              onClick={() => setActiveTab('personal_takes')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                activeTab === 'personal_takes' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={18} /> Мои личные тейки
              </div>
              <span className="bg-wine-dark/50 text-gummy text-xs px-2 py-0.5 rounded-full font-mono border border-gummy/20">
                {takes.filter(t => t.targetAdminId === currentAdmin.id || t.takenBy === currentAdmin.id).length}
              </span>
            </button>

            {isOwner && (
              <>
                <button
                  id="tab-surveys"
                  onClick={() => setActiveTab('surveys')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                    activeTab === 'surveys' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} /> Заявки (Анкеты)
                  </div>
                  <span className="bg-wine-dark/50 text-gummy text-xs px-2 py-0.5 rounded-full font-mono border border-gummy/20">
                    {surveys.length}
                  </span>
                </button>

                <button
                  id="tab-manage-admins"
                  onClick={() => setActiveTab('manage_admins')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                    activeTab === 'manage_admins' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
                  }`}
                >
                  <Settings size={18} /> Управление админами
                </button>

                <button
                  id="tab-manage-prices"
                  onClick={() => setActiveTab('manage_prices')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                    activeTab === 'manage_prices' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
                  }`}
                >
                  <Settings size={18} /> Настройка цен (Прайс)
                </button>

                <button
                  id="tab-support"
                  onClick={() => setActiveTab('support')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                    activeTab === 'support' ? 'bg-gummy text-wine shadow-lg' : 'hover:bg-wine-dark/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={18} /> Тех. поддержка & Идеи
                  </div>
                  <span className="bg-wine-dark/50 text-gummy text-xs px-2 py-0.5 rounded-full font-mono border border-gummy/20">
                    {takes.filter(t => t.type === 'support_idea' || t.type === 'support_complaint').length}
                  </span>
                </button>
              </>
            )}
          </div>

          {/* MAIN TAB CONTENT */}
          <div className="lg:col-span-3">
            
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="bg-wine-dark/20 border border-gummy/20 rounded-xl p-6">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
                  Редактировать мой профиль
                </h2>

                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase text-gummy/70">Никнейм в сообществе</label>
                      <input
                        id="profile-nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm"
                        placeholder="Например: Кибо"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase text-gummy/70">Роль в проекте</label>
                      <input
                        id="profile-role"
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm"
                        placeholder="Например: Дизайнер / Художник"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-gummy/70">Обо мне</label>
                    <textarea
                      id="profile-about"
                      value={aboutMe}
                      onChange={(e) => setAboutMe(e.target.value)}
                      rows={3}
                      className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm resize-none"
                      placeholder="Расскажите о себе, своих взглядах..."
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-gummy/70">Хобби и увлечения</label>
                    <input
                      id="profile-hobbies"
                      type="text"
                      value={hobbies}
                      onChange={(e) => setHobbies(e.target.value)}
                      className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm"
                      placeholder="Например: Игры, Рисование, Музыка"
                    />
                  </div>

                  {/* Photo/Media Grid for profile edit */}
                  <div className="flex flex-col gap-3 p-4 bg-wine-dark/40 border-2 border-dashed border-gummy/20 rounded-2xl">
                    <label className="text-xs font-bold uppercase text-gummy/70">Фото профиля (Максимум 10 штук)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Введите URL фотографии или выберите файл ниже"
                        id="new-photo-url-input"
                        className="flex-1 bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              setPhotosList(prev => [...prev, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-photo-url-input') as HTMLInputElement;
                            if (input && input.value.trim()) {
                              setPhotosList(prev => [...prev, input.value.trim()]);
                              input.value = '';
                            }
                          }}
                          className="bg-gummy hover:bg-white text-wine font-bold px-4 py-2 rounded-xl transition-all text-xs flex items-center gap-1"
                        >
                          <Plus size={12} /> Добавить
                        </button>
                        <label className="bg-wine border border-gummy/30 hover:border-gummy text-gummy font-bold px-4 py-2 rounded-xl cursor-pointer transition-all text-xs flex items-center justify-center gap-1">
                          <Image size={12} /> Загрузить
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files) return;
                              for (let i = 0; i < files.length; i++) {
                                try {
                                  showStatus(`Загрузка фото ${i + 1}...`, 'success');
                                  const url = await handleFileUpload(files[i]);
                                  setPhotosList(prev => [...prev, url]);
                                } catch (err: any) {
                                  showStatus(err.message || 'Ошибка загрузки', 'error');
                                }
                              }
                              showStatus('Все фото успешно загружены!', 'success');
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Photos Preview Grid */}
                    {photosList.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1">
                        {photosList.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square bg-wine border border-gummy/20 rounded-xl overflow-hidden">
                            <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-white font-mono"># {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setPhotosList(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-md cursor-pointer transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Music Playlist Grid for profile edit */}
                  <div className="flex flex-col gap-3 p-4 bg-wine-dark/40 border-2 border-dashed border-gummy/20 rounded-2xl">
                    <label className="text-xs font-bold uppercase text-gummy/70">Музыкальные файлы (MP3 / Плейлист)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Введите URL аудиозаписи (MP3) или выберите файл ниже"
                        id="new-music-url-input"
                        className="flex-1 bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              setMusicList(prev => [...prev, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-music-url-input') as HTMLInputElement;
                            if (input && input.value.trim()) {
                              setMusicList(prev => [...prev, input.value.trim()]);
                              input.value = '';
                            }
                          }}
                          className="bg-gummy hover:bg-white text-wine font-bold px-4 py-2 rounded-xl transition-all text-xs flex items-center gap-1"
                        >
                          <Plus size={12} /> Добавить
                        </button>
                        <label className="bg-wine border border-gummy/30 hover:border-gummy text-gummy font-bold px-4 py-2 rounded-xl cursor-pointer transition-all text-xs flex items-center justify-center gap-1">
                          <Music size={12} /> Загрузить
                          <input
                            type="file"
                            accept=".mp3,.wav,.m4a,.aac,.flac,.ogg"
                            multiple
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files) return;
                              for (let i = 0; i < files.length; i++) {
                                try {
                                  showStatus(`Загрузка трека ${i + 1}...`, 'success');
                                  const url = await handleFileUpload(files[i]);
                                  setMusicList(prev => [...prev, url]);
                                } catch (err: any) {
                                  showStatus(err.message || 'Ошибка загрузки', 'error');
                                }
                              }
                              showStatus('Музыка успешно загружена!', 'success');
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Music Playlist Preview */}
                    {musicList.length > 0 && (
                      <div className="flex flex-col gap-2 mt-1">
                        {musicList.map((url, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-wine/40 border border-gummy/20 rounded-xl px-3 py-2 text-xs text-white">
                            <span className="flex items-center gap-1.5 font-medium truncate flex-1 pr-3">
                              <Music size={12} className="text-gummy" /> <span className="truncate">{url.substring(url.lastIndexOf('/') + 1) || url}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gummy/50 font-mono">#{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => setMusicList(prev => prev.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-500 p-1 cursor-pointer transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase text-gummy/70">Telegram User ID (для бота)</label>
                      <input
                        id="profile-tgid"
                        type="text"
                        value={tgId}
                        onChange={(e) => setTgId(e.target.value)}
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm"
                        placeholder="Например: 582910398"
                      />
                      <span className="text-[10px] text-gummy/50 font-mono">
                        Узнать свой ID можно в ботах типа @userinfobot. Бот будет отправлять оповещения сюда.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase text-gummy/70">Изменить пароль (оставьте пустым для сохранения)</label>
                      <input
                        id="profile-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white focus:border-gummy outline-none transition-all text-sm"
                        placeholder="Новый сложный пароль"
                      />
                    </div>
                  </div>

                  {musicList.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase text-gummy/70 mb-1">Прослушать добавленную музыку</p>
                      {musicList.map((trackUrl, idx) => (
                        <MusicPlayer key={idx} url={trackUrl} title={`Превью трека #${idx + 1}`} />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 bg-wine/30 border border-gummy/20 rounded-xl p-4 mt-2">
                    <input
                      id="profile-isinrest"
                      type="checkbox"
                      checked={isInRest}
                      onChange={(e) => setIsInRest(e.target.checked)}
                      className="w-5 h-5 rounded border-gummy/30 text-gummy focus:ring-gummy bg-wine cursor-pointer accent-gummy"
                    />
                    <label htmlFor="profile-isinrest" className="text-xs sm:text-sm font-semibold text-white cursor-pointer select-none">
                      Режим отпуска (скрыть из списка доступных на сайте)
                    </label>
                  </div>

                  <button
                    id="save-profile-btn"
                    type="submit"
                    className="w-full mt-4 bg-gummy text-wine py-3 rounded-xl font-bold hover:bg-white transition-all text-sm shadow-md"
                  >
                    Сохранить изменения профиля
                  </button>
                </form>
              </div>
            )}

            {/* GENERAL TAKES TAB */}
            {activeTab === 'general_takes' && (
              <div className="bg-wine-dark/20 border border-gummy/20 rounded-xl p-6">
                <h2 className="text-xl font-display font-bold text-white mb-2 flex items-center gap-2">
                  Общая папка тейков
                </h2>
                <p className="text-sm text-gummy/70 mb-6">
                  Сюда приходят тейки, адресованные "Всем". Любой свободный администратор может забрать такой тейк себе в личную папку.
                </p>

                {takes.filter(t => t.targetAdminId === 'all').length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gummy/20 rounded-xl text-gummy/50">
                    <Users size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">В данный момент свободных тейков нет.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {takes.filter(t => t.targetAdminId === 'all').map((take) => (
                      <div key={take.id} className="bg-wine-dark/50 border-2 border-gummy/30 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                              take.type === 'take' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {take.type === 'take' ? 'Тейк' : 'Идея'}
                            </span>
                            <span className="text-xs text-gummy/50 font-mono">
                              {new Date(take.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-white font-medium whitespace-pre-line">{take.content}</p>
                          
                          {(() => {
                            const mediaUrls = parseMediaUrls(take.imageUrl);
                            if (mediaUrls.length === 0) return null;
                            return (
                              <div className="flex flex-col gap-2 mt-3">
                                <div className="flex flex-wrap gap-2">
                                  {mediaUrls.map((url, idx) => {
                                    const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) || url.includes('audio');
                                    const isVideo = url.match(/\.(mp4|mov|webm|mkv|avi)$/i) || url.includes('video');
                                    return (
                                      <a key={idx} href={url} target="_blank" rel="noreferrer" className="relative group border border-gummy/20 rounded-lg overflow-hidden w-20 h-20 flex items-center justify-center bg-wine/30 hover:border-gummy transition-all" title="Нажмите, чтобы открыть">
                                        {isAudio ? (
                                          <Music size={24} className="text-gummy" />
                                        ) : isVideo ? (
                                          <Play size={24} className="text-gummy" />
                                        ) : (
                                          <img src={url} alt={`Прикрепленный файл ${idx + 1}`} className="w-full h-full object-cover" />
                                        )}
                                        <span className="absolute bottom-0.5 right-0.5 bg-black/75 px-1 py-0.2 rounded text-[8px] text-white font-mono">#{idx + 1}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                                <button
                                  onClick={() => downloadAllAttachments(mediaUrls)}
                                  className="self-start text-[11px] font-bold text-wine bg-gummy hover:bg-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm mt-1"
                                >
                                  <Download size={12} /> Скачать все вложения ({mediaUrls.length})
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        <button
                          id={`claim-take-${take.id}`}
                          onClick={() => handleClaimTake(take.id)}
                          className="bg-gummy text-wine text-xs px-4 py-2.5 rounded-lg font-bold hover:bg-white transition-all whitespace-nowrap self-stretch md:self-auto flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} /> Взять в работу
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PERSONAL TAKES TAB */}
            {activeTab === 'personal_takes' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Chat select panel */}
                <div className="md:col-span-5 bg-wine-dark/20 border border-gummy/20 rounded-xl p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-gummy/20 pb-2 mb-1">
                    Мои диалоги
                  </h3>

                  {(() => {
                    const myTakes = takes.filter(t => t.targetAdminId === currentAdmin.id || t.takenBy === currentAdmin.id);
                    if (myTakes.length === 0) {
                      return <p className="text-xs text-gummy/50 text-center py-8">У вас пока нет взятых тейков.</p>;
                    }
                    
                    const sortedMyTakes = [...myTakes].sort((a, b) => {
                      const timeA = a.dialogue && a.dialogue.length > 0 
                        ? new Date(a.dialogue[a.dialogue.length - 1].createdAt).getTime() 
                        : new Date(a.createdAt).getTime();
                      const timeB = b.dialogue && b.dialogue.length > 0 
                        ? new Date(b.dialogue[b.dialogue.length - 1].createdAt).getTime() 
                        : new Date(b.createdAt).getTime();
                      return timeB - timeA;
                    });

                    return (
                      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                        {sortedMyTakes.map((take) => {
                          const isActive = activeTakeChatId === take.id;
                          const lastMsg = take.dialogue && take.dialogue.length > 0 
                            ? take.dialogue[take.dialogue.length - 1] 
                            : null;
                          
                          // Build status label
                          let statusLabel = 'Ожидает';
                          let StatusIcon = Clock;
                          let statusColor = 'text-yellow-400';
                          if (take.status === 'taken') {
                            statusLabel = 'В работе';
                            StatusIcon = MessageSquare;
                            statusColor = 'text-blue-400';
                          } else if (take.status === 'resolved') {
                            statusLabel = 'Решено';
                            StatusIcon = CheckCircle2;
                            statusColor = 'text-green-400';
                          }

                          return (
                            <button
                              key={take.id}
                              id={`chat-item-${take.id}`}
                              onClick={() => setActiveTakeChatId(take.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${
                                isActive 
                                  ? 'bg-gummy border-gummy text-wine animate-none' 
                                  : 'bg-wine border-gummy/20 hover:border-gummy/50 text-gummy'
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] uppercase font-mono font-bold ${isActive ? 'text-wine/80' : 'text-gummy-light'}`}>
                                    {take.type === 'take' ? 'Тейк' : 'Идея'}
                                  </span>
                                  {take.status !== 'resolved' && (!lastMsg || (lastMsg && lastMsg.sender === 'user')) && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-mono ${isActive ? 'text-wine/60' : 'text-gummy/50'}`}>
                                  {new Date(take.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className={`text-xs font-semibold truncate w-full ${isActive ? 'text-wine' : 'text-white'}`}>{take.content}</p>
                              
                              {/* Status Line */}
                              <div className="flex flex-col gap-0.5 border-t border-black/5 pt-1 mt-0.5 w-full text-[10px]">
                                <div className="flex justify-between items-center w-full">
                                  <span className={`font-mono flex items-center gap-1 font-bold ${isActive ? 'text-wine/70' : statusColor}`}>
                                    <StatusIcon size={10} />
                                    {statusLabel}
                                  </span>
                                  {lastMsg && (
                                    <span className={`text-[8px] opacity-60 font-mono`}>
                                      {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                                <p className={`truncate max-w-full italic text-[10px] ${isActive ? 'text-wine/75' : 'text-gummy/60'}`}>
                                  {lastMsg ? (
                                    <>
                                      <strong>{lastMsg.sender === 'admin' ? 'Вы: ' : 'Юзер: '}</strong>
                                      {lastMsg.text}
                                    </>
                                  ) : (
                                    'Нет сообщений'
                                  )}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Chat window panel */}
                <div className="md:col-span-7 bg-wine-dark/20 border border-gummy/20 rounded-xl p-4 flex flex-col h-[450px]">
                  {activeChatTake ? (
                    <div className="flex flex-col h-full">
                      {/* Active Chat Header */}
                      <div className="border-b border-gummy/20 pb-3 mb-3 flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-mono font-bold bg-wine-dark/40 border border-gummy/20 px-2 py-0.5 rounded">
                            {activeChatTake.type === 'take' ? 'Тейк' : 'Идея'}
                          </span>
                          <span className="text-xs text-gummy/60 font-mono">ID: {activeChatTake.id}</span>
                        </div>
                        <p className="text-sm font-semibold text-white mt-2 max-h-16 overflow-y-auto pr-1">
                          "{activeChatTake.content}"
                        </p>
                        {(() => {
                          const mediaUrls = parseMediaUrls(activeChatTake.imageUrl);
                          if (mediaUrls.length === 0) return null;
                          return (
                            <div className="flex flex-col gap-2 mt-2">
                              <div className="flex flex-wrap gap-2">
                                {mediaUrls.map((url, idx) => {
                                  const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) || url.includes('audio');
                                  const isVideo = url.match(/\.(mp4|mov|webm|mkv|avi)$/i) || url.includes('video');
                                  return (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-xs text-gummy hover:underline flex items-center gap-1.5 bg-wine/30 border border-gummy/20 px-2.5 py-1.5 rounded-lg transition-all hover:border-gummy">
                                      {isAudio ? <Music size={12} /> : isVideo ? <Play size={12} /> : <Image size={12} />}
                                      <span>{isAudio ? 'Музыка' : isVideo ? 'Видео' : 'Фото'} #{idx + 1}</span>
                                    </a>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => downloadAllAttachments(mediaUrls)}
                                className="self-start text-[10px] font-bold text-wine bg-gummy hover:bg-white px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer mt-1"
                              >
                                <Download size={10} /> Скачать все вложения ({mediaUrls.length})
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Dialogue Chat Messages */}
                      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-2 bg-wine/30 rounded-lg mb-3">
                        {/* Prompt Message */}
                        <div className="bg-wine-dark/30 border border-gummy/10 p-3 rounded-lg text-xs italic text-gummy/80">
                          Это начало вашего диалога с пользователем. Ответы будут отображаться в реальном времени.
                        </div>

                        {activeChatTake.dialogue && activeChatTake.dialogue.map((msg: any, index) => (
                          <div
                            key={index}
                            className={`max-w-[85%] rounded-xl p-3 text-xs flex flex-col gap-1 ${
                              msg.sender === 'admin'
                                ? 'bg-gummy text-wine self-end rounded-tr-none'
                                : 'bg-wine-dark/60 border border-gummy/30 text-white self-start rounded-tl-none'
                            }`}
                          >
                            <p className="font-medium whitespace-pre-line leading-relaxed">{msg.text}</p>
                            
                            {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {msg.mediaUrls.map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={url}
                                      alt="attachment"
                                      className="max-w-[160px] max-h-[120px] rounded-lg object-cover border border-gummy/25 hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            <span className="text-[9px] text-right font-mono opacity-60 self-end">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Upload Previews */}
                      {replyMediaList.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-wine/25 border border-gummy/10 rounded-xl mb-2">
                          {replyMediaList.map((url, idx) => (
                            <div key={idx} className="relative w-12 h-12 bg-wine border-2 border-gummy rounded-lg overflow-hidden group">
                              <img src={url} alt="Uploaded attachment" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setReplyMediaList(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Box */}
                      <form onSubmit={handleSendReply} className="flex gap-2">
                        <label className="flex items-center justify-center bg-wine border-2 border-gummy/20 text-gummy hover:text-white rounded-xl px-3 cursor-pointer hover:border-gummy transition-all select-none">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleReplyFileChange}
                            className="hidden"
                          />
                          <span className="text-sm font-bold">📎</span>
                        </label>
                        <input
                          id="chat-reply-input"
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={replyMediaLoading ? 'Загрузка файлов...' : 'Введите ответ пользователю...'}
                          className="flex-1 bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                          disabled={replyMediaLoading}
                        />
                        <button
                          id="chat-send-reply-btn"
                          type="submit"
                          disabled={replyMediaLoading}
                          className="bg-gummy text-wine hover:bg-white transition-all px-4 rounded-xl font-bold flex items-center justify-center shadow-md disabled:opacity-50 cursor-pointer"
                        >
                          {replyMediaLoading ? '...' : <Send size={14} />}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gummy/40 text-center">
                      <MessageSquare size={32} className="mb-2 opacity-30" />
                      <p className="text-xs">Выберите нужный тейк слева для начала общения.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* SURVEYS TAB */}
            {activeTab === 'surveys' && isOwner && (
              <div className="bg-wine-dark/20 border border-gummy/20 rounded-xl p-6">
                <h2 className="text-xl font-display font-bold text-white mb-2 flex items-center gap-2">
                  Поданные заявки в команду
                </h2>
                <p className="text-sm text-gummy/70 mb-6">
                  Кандидаты, заполнившие анкеты на вступление в команду. Список виден только Главному Владельцу.
                </p>

                {surveys.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gummy/20 rounded-xl text-gummy/50">
                    <FileText size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Поданных заявок пока нет.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {surveys.map((survey) => (
                      <div key={survey.id} className="bg-wine-dark/50 border-2 border-gummy/30 rounded-xl p-5 flex flex-col gap-3 relative">
                        <div className="absolute top-4 right-4 text-xs text-gummy/50 font-mono">
                          {new Date(survey.createdAt).toLocaleDateString()}
                        </div>

                        <div className="flex flex-col gap-1.5 pr-20">
                          <span className="text-[10px] text-gummy/50 font-bold uppercase tracking-wider">Кандидат возраст: {survey.age} лет</span>
                          <h3 className="text-base font-bold text-white">Желаемая роль: {survey.roleInterest}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-wine/30 p-3.5 rounded-lg border border-gummy/10">
                          <div>
                            <span className="text-[10px] uppercase text-gummy/60 font-semibold block">Откуда узнали</span>
                            <span className="text-xs text-gummy font-medium">{survey.source}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gummy/60 font-semibold block">Сфера деятельности</span>
                            <span className="text-xs text-gummy font-medium">{survey.sphere}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase text-gummy/60 font-semibold block mb-1">Как готов помочь в развитии</span>
                          <p className="text-xs text-white bg-wine-dark/30 p-3 rounded-lg border border-gummy/5 leading-relaxed whitespace-pre-wrap">
                            {survey.helpDescription}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MANAGE ADMINS TAB */}
            {activeTab === 'manage_admins' && isOwner && (
              <div className="bg-wine-dark/20 border border-gummy/20 rounded-xl p-6">
                
                {/* Create New Admin */}
                <div className="border-b border-gummy/20 pb-8 mb-8">
                  <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                    <Plus size={20} /> Добавить нового администратора
                  </h2>

                  <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Логин для входа *</label>
                      <input
                        id="new-admin-username"
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Например: admin_max"
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Пароль *</label>
                      <input
                        id="new-admin-password"
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Прочный пароль"
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Никнейм на сайте *</label>
                      <input
                        id="new-admin-nickname"
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="Например: Макс"
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Роль</label>
                      <input
                        id="new-admin-role"
                        type="text"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        placeholder="Например: Модератор чата"
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Telegram ID (для бота)</label>
                      <input
                        id="new-admin-tg"
                        type="text"
                        value={newTgId}
                        onChange={(e) => setNewTgId(e.target.value)}
                        placeholder="Например: 582910398"
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                      />
                    </div>

                    <button
                      id="create-admin-btn"
                      type="submit"
                      className="bg-gummy text-wine font-bold py-2.5 rounded-xl hover:bg-white hover:scale-105 transition-all text-xs shadow-md self-end"
                    >
                      Создать аккаунт
                    </button>
                  </form>
                </div>

                {/* Admins list view */}
                <div>
                  <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                    <UserCheck size={20} /> Список администраторов
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {admins.map((adm) => (
                      <div key={adm.id} className="bg-wine-dark/50 border border-gummy/20 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={adm.photoUrl}
                            alt={adm.nickname}
                            className="w-10 h-10 rounded-full border border-gummy object-cover"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-white">{adm.nickname}</h4>
                            <p className="text-[10px] text-gummy/60 font-mono">Логин: {adm.username} | ID: {adm.id}</p>
                            <p className="text-xs text-gummy/80">{adm.role}</p>
                          </div>
                        </div>

                        {adm.id !== 'owner' && (
                          <button
                            id={`delete-admin-${adm.id}`}
                            onClick={() => handleDeleteAdmin(adm.id)}
                            className="w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/80 border border-red-500/30 text-red-400 flex items-center justify-center transition-all shadow-md"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'manage_prices' && isOwner && (
              <div className="bg-wine-dark/20 border border-gummy/20 rounded-xl p-6">
                
                {/* Create/Edit Price Form */}
                <div className="border-b border-gummy/20 pb-8 mb-8">
                  <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                    {editingPriceId ? <Edit2 size={20} /> : <Plus size={20} />} 
                    {editingPriceId ? 'Редактировать услугу прайса' : 'Добавить новую услугу в прайс'}
                  </h2>

                  <form onSubmit={handleSavePrice} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-gummy/70">Название услуги *</label>
                        <input
                          id="price-form-title"
                          type="text"
                          value={priceTitle}
                          onChange={(e) => setPriceTitle(e.target.value)}
                          placeholder="Например: Кастомный арт маскота"
                          className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2.5 text-white outline-none focus:border-gummy text-xs"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-gummy/70">Стоимость (с валютой) *</label>
                        <input
                          id="price-form-value"
                          type="text"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          placeholder="Например: 500 ₽"
                          className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2.5 text-white outline-none focus:border-gummy text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gummy/70">Описание услуги *</label>
                      <textarea
                        id="price-form-description"
                        value={priceDescription}
                        onChange={(e) => setPriceDescription(e.target.value)}
                        placeholder="Кратко расскажите, что входит в эту стоимость..."
                        rows={3}
                        className="bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2.5 text-white outline-none focus:border-gummy text-xs resize-none"
                        required
                      />
                    </div>

                    <div className="flex gap-3 justify-end mt-2">
                      {editingPriceId && (
                        <button
                          id="price-form-cancel"
                          type="button"
                          onClick={() => {
                            setEditingPriceId(null);
                            setPriceTitle('');
                            setPriceValue('');
                            setPriceDescription('');
                          }}
                          className="bg-wine-dark/60 text-gummy border border-gummy/30 px-4 py-2 rounded-xl text-xs hover:bg-wine-dark transition-all"
                        >
                          Отмена
                        </button>
                      )}
                      <button
                        id="price-form-submit"
                        type="submit"
                        className="bg-gummy text-wine font-bold px-6 py-2.5 rounded-xl hover:bg-white hover:scale-105 transition-all text-xs shadow-md"
                      >
                        {editingPriceId ? 'Сохранить изменения' : 'Добавить услугу'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Prices list view */}
                <div>
                  <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                    <Settings size={20} /> Текущие цены в прайсе
                  </h2>

                  <div className="grid grid-cols-1 gap-4">
                    {pricesList.length === 0 ? (
                      <p className="text-xs text-gummy/50 text-center py-6">Загрузка или прайс-лист пуст...</p>
                    ) : (
                      pricesList.map((item) => (
                        <div key={item.id} className="bg-wine-dark/50 border border-gummy/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold text-white">{item.title}</h4>
                              <span className="text-xs font-bold text-gummy bg-wine/60 border border-gummy/30 px-2 py-0.5 rounded-full">
                                {item.price}
                              </span>
                            </div>
                            <p className="text-xs text-gummy/80 mt-1">{item.description}</p>
                          </div>

                          <div className="flex gap-2 self-stretch md:self-auto justify-end">
                            <button
                              id={`edit-price-${item.id}`}
                              onClick={() => handleStartEditPrice(item)}
                              className="w-8 h-8 rounded-lg bg-gummy/20 hover:bg-gummy hover:text-wine border border-gummy/30 text-gummy flex items-center justify-center transition-all shadow-md"
                              title="Редактировать"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              id={`delete-price-${item.id}`}
                              onClick={() => handleDeletePrice(item.id)}
                              className="w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/80 border border-red-500/30 text-red-400 flex items-center justify-center transition-all shadow-md"
                              title="Удалить"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* SUPPORT / TECH TICKETS TAB */}
            {activeTab === 'support' && isOwner && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Support Chat select panel */}
                <div className="md:col-span-5 bg-wine-dark/20 border border-gummy/20 rounded-xl p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-gummy/20 pb-2 mb-1 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-gummy animate-pulse" />
                    Тех. поддержка и Идеи
                  </h3>

                  {(() => {
                    const supportTakes = takes.filter(t => t.type === 'support_idea' || t.type === 'support_complaint');
                    if (supportTakes.length === 0) {
                      return <p className="text-xs text-gummy/50 text-center py-8">Обращений в поддержку пока нет.</p>;
                    }

                    const sortedSupport = [...supportTakes].sort((a, b) => {
                      const timeA = a.dialogue && a.dialogue.length > 0 
                        ? new Date(a.dialogue[a.dialogue.length - 1].createdAt).getTime() 
                        : new Date(a.createdAt).getTime();
                      const timeB = b.dialogue && b.dialogue.length > 0 
                        ? new Date(b.dialogue[b.dialogue.length - 1].createdAt).getTime() 
                        : new Date(b.createdAt).getTime();
                      return timeB - timeA;
                    });

                    return (
                      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                        {sortedSupport.map((take) => {
                          const isActive = activeTakeChatId === take.id;
                          const lastMsg = take.dialogue && take.dialogue.length > 0 
                            ? take.dialogue[take.dialogue.length - 1] 
                            : null;

                          // Build status label
                          let statusLabel = 'Ожидает';
                          let StatusIcon = Clock;
                          let statusColor = 'text-yellow-400';
                          if (take.status === 'taken') {
                            statusLabel = 'В работе';
                            StatusIcon = MessageSquare;
                            statusColor = 'text-blue-400';
                          } else if (take.status === 'resolved') {
                            statusLabel = 'Решено';
                            StatusIcon = CheckCircle2;
                            statusColor = 'text-green-400';
                          }

                          return (
                            <button
                              key={take.id}
                              id={`support-chat-item-${take.id}`}
                              onClick={() => setActiveTakeChatId(take.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${
                                isActive 
                                  ? 'bg-gummy border-gummy text-wine animate-none' 
                                  : 'bg-wine border-gummy/20 hover:border-gummy/50 text-gummy'
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                                    isActive ? 'bg-wine-dark/20 text-wine' : 'bg-wine-dark/40 border border-gummy/20 text-white'
                                  }`}>
                                    {take.type === 'support_idea' ? 'Идея' : 'Жалоба'}
                                  </span>
                                  {take.status !== 'resolved' && (!lastMsg || (lastMsg && lastMsg.sender === 'user')) && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-mono ${isActive ? 'text-wine/60' : 'text-gummy/50'}`}>
                                  {new Date(take.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              
                              <p className={`text-xs font-semibold truncate w-full ${isActive ? 'text-wine' : 'text-white'}`}>{take.content}</p>
                              
                              {take.userTgUsername && (
                                <span className={`text-[9px] font-mono opacity-80 ${isActive ? 'text-wine/85 font-semibold' : ''}`}>
                                  От: @{take.userTgUsername}
                                </span>
                              )}

                              {/* Status Line */}
                              <div className="flex flex-col gap-0.5 border-t border-black/5 pt-1 mt-0.5 w-full text-[10px]">
                                <div className="flex justify-between items-center w-full">
                                  <span className={`font-mono flex items-center gap-1 font-bold ${isActive ? 'text-wine/70' : statusColor}`}>
                                    <StatusIcon size={10} />
                                    {statusLabel}
                                  </span>
                                  {lastMsg && (
                                    <span className={`text-[8px] opacity-60 font-mono`}>
                                      {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                                <p className={`truncate max-w-full italic text-[10px] ${isActive ? 'text-wine/75' : 'text-gummy/60'}`}>
                                  {lastMsg ? (
                                    <>
                                      <strong>{lastMsg.sender === 'admin' ? 'Вы: ' : 'Юзер: '}</strong>
                                      {lastMsg.text}
                                    </>
                                  ) : (
                                    'Нет сообщений'
                                  )}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Support Chat window panel */}
                <div className="md:col-span-7 bg-wine-dark/20 border border-gummy/20 rounded-xl p-4 flex flex-col h-[450px]">
                  {activeChatTake && (activeChatTake.type === 'support_idea' || activeChatTake.type === 'support_complaint') ? (
                    <div className="flex flex-col h-full">
                      {/* Active Chat Header */}
                      <div className="border-b border-gummy/20 pb-3 mb-3 flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs uppercase font-mono font-bold bg-wine-dark/40 border border-gummy/20 px-2 py-0.5 rounded flex items-center gap-1">
                            {activeChatTake.type === 'support_idea' ? (
                              <>
                                <Lightbulb size={12} className="text-yellow-400" />
                                Идея
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} className="text-red-400" />
                                Жалоба / Тех. поддержка
                              </>
                            )}
                          </span>
                          <span className="text-xs text-gummy/60 font-mono">ID: {activeChatTake.id}</span>
                        </div>
                        
                        {activeChatTake.userTgUsername && (
                          <p className="text-xs text-gummy/80 font-mono mt-1">
                            Автор: <span className="font-bold text-white">@{activeChatTake.userTgUsername}</span> ({activeChatTake.userTgName || 'Без имени'})
                          </p>
                        )}

                        <p className="text-sm font-semibold text-white mt-2 max-h-16 overflow-y-auto pr-1">
                          "{activeChatTake.content}"
                        </p>
                        {(() => {
                          const mediaUrls = parseMediaUrls(activeChatTake.imageUrl);
                          if (mediaUrls.length === 0) return null;
                          return (
                            <div className="flex flex-col gap-2 mt-2">
                              <div className="flex flex-wrap gap-2">
                                {mediaUrls.map((url, idx) => {
                                  const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) || url.includes('audio');
                                  const isVideo = url.match(/\.(mp4|mov|webm|mkv|avi)$/i) || url.includes('video');
                                  return (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-xs text-gummy hover:underline flex items-center gap-1.5 bg-wine/30 border border-gummy/20 px-2.5 py-1.5 rounded-lg transition-all hover:border-gummy">
                                      {isAudio ? <Music size={12} /> : isVideo ? <Play size={12} /> : <Image size={12} />}
                                      <span>{isAudio ? 'Музыка' : isVideo ? 'Видео' : 'Фото'} #{idx + 1}</span>
                                    </a>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => downloadAllAttachments(mediaUrls)}
                                className="self-start text-[10px] font-bold text-wine bg-gummy hover:bg-white px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer mt-1"
                              >
                                <Download size={10} /> Скачать все вложения ({mediaUrls.length})
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Dialogue Chat Messages */}
                      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-2 bg-wine/30 rounded-lg mb-3">
                        <div className="bg-wine-dark/30 border border-gummy/10 p-3 rounded-lg text-xs italic text-gummy/80">
                          Это начало диалога техподдержки с пользователем.
                        </div>

                        {activeChatTake.dialogue && activeChatTake.dialogue.map((msg: any, index) => (
                          <div
                            key={index}
                            className={`max-w-[85%] rounded-xl p-3 text-xs flex flex-col gap-1 ${
                              msg.sender === 'admin'
                                ? 'bg-gummy text-wine self-end rounded-tr-none'
                                : 'bg-wine-dark/60 border border-gummy/30 text-white self-start rounded-tl-none'
                            }`}
                          >
                            <p className="font-medium whitespace-pre-line leading-relaxed">{msg.text}</p>
                            
                            {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {msg.mediaUrls.map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={url}
                                      alt="attachment"
                                      className="max-w-[160px] max-h-[120px] rounded-lg object-cover border border-gummy/25 hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            <span className="text-[9px] text-right font-mono opacity-60 self-end">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Upload Previews */}
                      {replyMediaList.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-wine/25 border border-gummy/10 rounded-xl mb-2">
                          {replyMediaList.map((url, idx) => (
                            <div key={idx} className="relative w-12 h-12 bg-wine border-2 border-gummy rounded-lg overflow-hidden group">
                              <img src={url} alt="Uploaded attachment" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setReplyMediaList(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Box */}
                      <form onSubmit={handleSendReply} className="flex gap-2">
                        <label className="flex items-center justify-center bg-wine border-2 border-gummy/20 text-gummy hover:text-white rounded-xl px-3 cursor-pointer hover:border-gummy transition-all select-none">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleReplyFileChange}
                            className="hidden"
                          />
                          <span className="text-sm font-bold">📎</span>
                        </label>
                        <input
                          id="support-reply-input"
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={replyMediaLoading ? 'Загрузка файлов...' : 'Введите ответ пользователю...'}
                          className="flex-1 bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white outline-none focus:border-gummy text-xs"
                          disabled={replyMediaLoading}
                        />
                        <button
                          id="support-send-reply-btn"
                          type="submit"
                          disabled={replyMediaLoading}
                          className="bg-gummy text-wine hover:bg-white transition-all px-4 rounded-xl font-bold flex items-center justify-center shadow-md disabled:opacity-50 cursor-pointer"
                        >
                          {replyMediaLoading ? '...' : <Send size={14} />}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gummy/40 text-center">
                      <ShieldAlert size={32} className="mb-2 opacity-30" />
                      <p className="text-xs">Выберите обращение слева для просмотра.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
