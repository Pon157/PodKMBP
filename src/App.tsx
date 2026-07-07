import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PriceItem, UnionItem, Admin, Take, Survey 
} from './types';
import { MascotPlaceholder } from './components/MascotPlaceholder';
import { AnimatedCloud, AnimatedFlower } from './components/DecorativeItems';
import { MusicPlayer } from './components/MusicPlayer';
import { AdminPanel } from './components/AdminPanel';
import { 
  Sparkles, ExternalLink, MessageSquare, AlertCircle, 
  ChevronRight, Heart, Send, Check, Shield, HelpCircle, 
  MapPin, Eye, Play, Plus, BookOpen, Volume2, Globe, Trash2, Lock
} from 'lucide-react';

// Safe profile urls parser supporting JSON arrays, comma-separated, or single urls
export function parseProfileUrls(urlField: string | null | undefined): string[] {
  if (!urlField) return [];
  try {
    const trimmed = urlField.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    }
  } catch (e) {
    // legacy or single URL fallback
  }
  if (urlField.includes(',')) {
    return urlField.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [urlField.trim()].filter(Boolean);
}

// Generates or retrieves a unique client ID for online counters
const getClientId = () => {
  let id = localStorage.getItem('wine_client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('wine_client_id', id);
  }
  return id;
};

// ---------------- ROOT APP COMPONENT ----------------

export default function App() {
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [unions, setUnions] = useState<UnionItem[]>([]);
  
  // Auth admin state
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

  // Telegram User Session State
  const [tgUser, setTgUser] = useState<{ tgId: string; username: string | null; firstName: string | null; avatarUrl?: string | null } | null>(() => {
    const saved = localStorage.getItem('wine_tg_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem('wine_tg_user');
      }
    }
    return null;
  });

  const handleLogoutTg = () => {
    if (window.confirm('Вы действительно хотите выйти из аккаунта Telegram?')) {
      setTgUser(null);
      localStorage.removeItem('wine_tg_user');
    }
  };

  const refreshAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      if (res.ok) {
        setAdmins(await res.json());
      }
    } catch (err) {
      console.error('Failed to refresh admins list', err);
    }
  };

  useEffect(() => {
    // Read auth session from localStorage
    const saved = localStorage.getItem('wine_admin_session');
    if (saved) {
      try {
        setCurrentAdmin(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('wine_admin_session');
      }
    }

    // Load initial public content from Express API
    const loadInitialData = async () => {
      try {
        const [resAdmins, resPrices, resUnions] = await Promise.all([
          fetch('/api/admins'),
          fetch('/api/prices'),
          fetch('/api/unions')
        ]);
        if (resAdmins.ok) setAdmins(await resAdmins.json());
        if (resPrices.ok) setPrices(await resPrices.json());
        if (resUnions.ok) setUnions(await resUnions.json());
      } catch (err) {
        console.error('Failed to load portal configuration data', err);
      }
    };

    loadInitialData();

    // Setup active users pinging loop
    const clientId = getClientId();
    const activePing = async () => {
      try {
        const res = await fetch('/api/active-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.activeCount) {
            setActiveUsersCount(data.activeCount);
          }
        }
      } catch (err) {
        console.error('Active status ping failed', err);
      }
    };

    activePing();
    const interval = setInterval(activePing, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdminLogin = (adminUser: Admin) => {
    setCurrentAdmin(adminUser);
    localStorage.setItem('wine_admin_session', JSON.stringify(adminUser));
  };

  const handleAdminLogout = () => {
    setCurrentAdmin(null);
    localStorage.removeItem('wine_admin_session');
  };

  return (
    <Router>
      <div className="min-h-screen bg-wine text-gummy relative selection:bg-gummy selection:text-wine overflow-x-hidden font-sans">
        
        {/* Decorative elements present globally on non-panel pages */}
        <GlobalDecorations tgUser={tgUser} onLogoutTg={handleLogoutTg} />

        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/info" element={<MainInfoPage admins={admins} unions={unions} />} />
          <Route path="/price" element={<PricePage prices={prices} />} />
          <Route path="/socials" element={<SocialsPage />} />
          <Route path="/admin" element={<AdminsOverviewPage admins={admins} />} />
          <Route path="/admins" element={<AdminsOverviewPage admins={admins} />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/take" element={<TakeSubmissionPage admins={admins} tgUser={tgUser} setTgUser={setTgUser} />} />
          <Route path="/anketa" element={<AnketaPage />} />
          <Route path="/survey" element={<SurveyFormPage />} />
          <Route path="/unions" element={<UnionsPage unions={unions} />} />
          
          {/* Admin panel routing wrapper */}
          <Route 
            path="/admin-panel" 
            element={
              currentAdmin ? (
                <AdminPanel 
                  currentAdmin={currentAdmin} 
                  onLogout={handleAdminLogout} 
                  activeUsersCount={activeUsersCount} 
                  onRefreshAdmins={refreshAdmins}
                />
              ) : (
                <AdminLoginPage onLogin={handleAdminLogin} />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

// Global ambient animated float elements
interface GlobalDecorationsProps {
  tgUser: { tgId: string; username: string | null; firstName: string | null; avatarUrl?: string | null } | null;
  onLogoutTg: () => void;
}
const GlobalDecorations: React.FC<GlobalDecorationsProps> = ({ tgUser, onLogoutTg }) => {
  const { pathname } = useLocation();
  // Do not show distracting background noise in the admin panel
  if (pathname.includes('admin-panel')) return null;

  return (
    <>
      {/* Telegram Profile Widget */}
      {tgUser && (
        <div className="fixed top-4 left-4 z-50 group">
          {/* Container */}
          <div className="flex items-center gap-3 bg-wine-dark/95 hover:bg-wine-dark border border-gummy/40 rounded-full py-1.5 pl-1.5 pr-4 shadow-xl transition-all duration-300 cursor-pointer backdrop-blur-md">
            
            {/* Avatar or Placeholder */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gummy bg-wine/80 flex items-center justify-center text-xs font-bold text-gummy">
              {tgUser.avatarUrl ? (
                <img 
                  src={tgUser.avatarUrl} 
                  alt={tgUser.firstName || 'TG Avatar'} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span>{tgUser.firstName ? tgUser.firstName.substring(0, 1).toUpperCase() : 'TG'}</span>
            </div>

            {/* User details snippet */}
            <div className="flex flex-col">
              <span className="text-white font-semibold text-[11px] leading-tight max-w-[120px] truncate">
                {tgUser.firstName || tgUser.username || 'User'}
              </span>
              <span className="text-gummy/60 text-[9px] leading-none">
                {tgUser.username ? `@${tgUser.username}` : `id: ${tgUser.tgId}`}
              </span>
            </div>
          </div>

          {/* Hover Info Panel / Tooltip */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-wine-dark/95 border-2 border-gummy rounded-2xl p-4 shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 origin-top-left z-[100] backdrop-blur-md">
            <div className="flex items-center gap-3 mb-3 border-b border-gummy/20 pb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gummy bg-wine flex items-center justify-center text-sm font-bold text-gummy">
                {tgUser.avatarUrl ? (
                  <img 
                    src={tgUser.avatarUrl} 
                    alt={tgUser.firstName || 'TG Avatar'} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span>{tgUser.firstName ? tgUser.firstName.substring(0, 1).toUpperCase() : 'TG'}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-xs truncate">
                  {tgUser.firstName || 'Пользователь'}
                </span>
                {tgUser.username && (
                  <span className="text-gummy text-[11px] truncate">
                    @{tgUser.username}
                  </span>
                )}
                <span className="text-gummy/50 text-[10px] font-mono mt-0.5">
                  ID: {tgUser.tgId}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-[10px] text-gummy/80 leading-relaxed mb-3">
              <p>🤖 Вы авторизованы через Telegram и можете отправлять тейки и идеи.</p>
            </div>

            <button
              onClick={onLogoutTg}
              className="w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all"
            >
              Выйти из Telegram
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-gummy/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/10 w-[500px] h-[500px] bg-gummy/5 rounded-full blur-3xl" />
      </div>
    </>
  );
};

// Helper components for page transitions
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative z-10 w-full min-h-screen flex items-center justify-center p-4 md:p-8"
    >
      {children}
    </motion.div>
  );
};

// ---------------- PAGES ----------------

// 1. START PAGE
const StartPage: React.FC = () => {
  const navigate = useNavigate();
  const [startImageFailed, setStartImageFailed] = useState(false);

  return (
    <PageTransition>
      <div className="max-w-4xl xl:max-w-6xl 2xl:max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 xl:gap-16 items-center bg-wine-dark/40 border-4 border-gummy rounded-3xl p-6 sm:p-8 md:p-12 xl:p-16 2xl:p-24 shadow-2xl relative transition-all">
        {/* Mascot on left */}
        <div className="flex justify-center md:justify-end pr-0 md:pr-4">
          {!startImageFailed ? (
            <motion.div
              animate={{ y: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="w-full max-w-[200px] sm:max-w-[240px] xl:max-w-[360px] 2xl:max-w-[460px]"
            >
              <img
                src="/mainmenu(start).PNG"
                alt="Маскот"
                className="w-full h-auto object-contain drop-shadow-2xl"
                onError={() => setStartImageFailed(true)}
              />
            </motion.div>
          ) : (
            <MascotPlaceholder pose="greeting" size={240} className="xl:scale-150 transition-transform" />
          )}
        </div>

        {/* Text bubble and buttons on right */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-6 xl:gap-10">
          
          {/* Custom SVG dialogue bubble sketch look */}
          <div className="relative bg-gummy text-wine p-6 md:p-8 xl:p-12 rounded-3xl border-4 border-white shadow-lg max-w-sm xl:max-w-lg 2xl:max-w-xl">
            <h2 className="text-xl md:text-2xl xl:text-4xl 2xl:text-5xl font-display font-bold leading-snug">
              Хочешь ознакомиться?
            </h2>
            {/* Dialogue Bubble tail pointing to mascot */}
            <div className="absolute bottom-1/2 -left-4 w-4 h-4 bg-gummy border-l-4 border-b-4 border-white transform rotate-45 hidden md:block" />
            <div className="absolute -top-4 left-1/2 w-4 h-4 bg-gummy border-t-4 border-l-4 border-white transform rotate-45 md:hidden" />
          </div>

          {/* Action buttons leading to /info */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none">
            <button
              id="start-yes-btn"
              onClick={() => navigate('/info')}
              className="flex-1 bg-gummy text-wine font-bold text-lg xl:text-2xl py-4 xl:py-5 px-8 xl:px-12 rounded-2xl hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-lg border-2 border-transparent hover:border-wine cursor-pointer"
            >
              Да
            </button>
            <button
              id="start-definitely-btn"
              onClick={() => navigate('/info')}
              className="flex-1 bg-transparent border-4 border-gummy text-gummy font-bold text-lg xl:text-2xl py-4 xl:py-5 px-6 xl:px-10 rounded-2xl hover:bg-gummy hover:text-wine hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Точно да
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

// 2. MAIN INFO PAGE
interface MainInfoPageProps {
  admins: Admin[];
  unions: UnionItem[];
}
const MainInfoPage: React.FC<MainInfoPageProps> = ({ admins, unions }) => {
  const navigate = useNavigate();
  const [infoImageFailed, setInfoImageFailed] = useState(false);

  return (
    <PageTransition>
      <div className="max-w-5xl xl:max-w-7xl 2xl:max-w-screen-2xl w-full flex flex-col gap-8 xl:gap-14 2xl:gap-20 transition-all">
        
        {/* ROW OF CORE BUTTONS (now 7 buttons, responsive layout) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5 bg-wine-dark/40 border-4 border-gummy rounded-2xl p-4 shadow-xl">
          <button
            id="nav-price"
            onClick={() => navigate('/price')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Прайс 💎
          </button>
          <button
            id="nav-socials"
            onClick={() => navigate('/socials')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Соцсети 🌐
          </button>
          <button
            id="nav-admin"
            onClick={() => navigate('/admin')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Администрация 👑
          </button>
          <button
            id="nav-take"
            onClick={() => navigate('/take')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md animate-pulse"
          >
            Написать тейк 📝
          </button>
          <a
            id="nav-support"
            href="https://t.me/our_support_channel"
            target="_blank"
            rel="noreferrer"
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Поддержка <ExternalLink size={13} />
          </a>
          <button
            id="nav-anketa"
            onClick={() => navigate('/anketa')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Заявка 📄
          </button>
          <button
            id="nav-unions"
            onClick={() => navigate('/unions')}
            className="py-3.5 px-4 rounded-xl bg-gummy/15 hover:bg-gummy border-2 border-gummy/30 hover:border-transparent text-gummy hover:text-wine font-display font-bold text-center hover:scale-105 transition-all shadow-md text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 duration-200 backdrop-blur-md"
          >
            Союзы 🤝
          </button>
        </div>

        {/* MASCOT LYING & LOOKING UP AT BUTTONS */}
        <div className="flex justify-center -my-3">
          {!infoImageFailed ? (
            <motion.div
              animate={{ y: [3, -3, 3], rotate: [0, 0.5, -0.5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="w-full max-w-[200px] xl:max-w-[300px] 2xl:max-w-[360px]"
            >
              <img
                src="/mainmenu(info).png"
                alt="Маскот Инфо"
                className="w-full h-auto object-contain drop-shadow-2xl"
                onError={() => setInfoImageFailed(true)}
              />
            </motion.div>
          ) : (
            <MascotPlaceholder pose="lying" size={200} className="xl:scale-125 transition-transform" />
          )}
        </div>

        {/* ABOUT INFO & STANDING MASCOT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 xl:gap-16 items-center relative">
          
          {/* Decorative flying clouds and flowers extending beyond border on the left */}
          <div className="absolute -left-24 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-0 opacity-45 pointer-events-none hidden xl:flex">
            <AnimatedCloud size={120} delay={0} />
            <AnimatedFlower size={65} delay={1.5} />
            <AnimatedCloud size={100} delay={3} />
            <AnimatedFlower size={55} delay={0.5} />
          </div>

          {/* Info field in center (span 3 cols) */}
          <div className="md:col-span-3 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-10 xl:p-14 2xl:p-20 shadow-xl relative z-10 transition-all">
            <span className="text-[10px] xl:text-xs uppercase tracking-widest font-mono text-gummy/60 font-bold block mb-1">Информация</span>
            <h2 className="text-xl md:text-2xl xl:text-4xl 2xl:text-5xl font-display font-bold text-white mb-4">О нас</h2>
            <p className="text-sm md:text-base xl:text-lg 2xl:text-2xl text-gummy-light leading-relaxed xl:leading-loose whitespace-pre-line">
              ПРИНИМАЕМ СПЛЕТНИ СО ВСЕХ КФ  Наша команда обрабатывает все ваши идеи, анонимные тейки и предложения, чтобы публиковать их яркими и веселыми. 
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <span className="text-xs xl:text-sm bg-wine/60 border border-gummy/30 px-3 py-1 xl:px-4 xl:py-1.5 rounded-full font-semibold">100% Анонимно</span>
              <span className="text-xs xl:text-sm bg-wine/60 border border-gummy/30 px-3 py-1 xl:px-4 xl:py-1.5 rounded-full font-semibold">Уважение</span>
            </div>
          </div>

          {/* Standing mascot on the right (span 1 col) */}
          <div className="flex justify-center md:justify-start z-10 xl:scale-130 2xl:scale-150 transition-transform origin-center">
            <MascotPlaceholder pose="neutral" size={170} />
          </div>
        </div>

        {/* BOTTOM UNIONS BLOCK: Союз Memory Base */}
        <div className="bg-wine-dark/60 border-2 border-gummy/40 rounded-2xl p-6 xl:p-10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 xl:gap-8 transition-all">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="text-gummy" size={20} />
              <h3 className="font-display font-bold text-white text-lg xl:text-2xl 2xl:text-3xl">Союз Memory Base</h3>
            </div>
            <p className="text-xs xl:text-sm 2xl:text-lg text-gummy/80 leading-relaxed">
              Крупнейшее дружественное сообщество в КМБП по борьбе с мошенничеством. 
              <span className="block mt-1 font-semibold text-gummy">Если вы столкнулись с мошенником, обращайтесь к ним.</span>
            </p>
          </div>
          <a
            id="union-memorybase-btn"
            href="https://t.me/memory_base"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 xl:px-8 xl:py-4 rounded-xl bg-gummy hover:bg-white text-wine font-bold text-xs xl:text-sm 2xl:text-base hover:scale-105 transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap self-stretch md:self-auto justify-center cursor-pointer"
          >
            Связаться с ними <ExternalLink size={14} />
          </a>
        </div>

        {/* Quick nav helper to Admin Panel */}
        <div className="flex justify-center mt-4">
          <Link to="/admin-panel" className="text-xs xl:text-sm text-gummy/50 hover:text-gummy hover:underline flex items-center gap-1.5 font-mono">
            <Shield size={14} /> Вход для администрации
          </Link>
        </div>

      </div>
    </PageTransition>
  );
};

// 3. PRICE PAGE
interface PricePageProps {
  prices: PriceItem[];
}
const PricePage: React.FC<PricePageProps> = ({ prices: initialPrices }) => {
  const navigate = useNavigate();
  const [prices, setPrices] = useState<PriceItem[]>(initialPrices);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        if (res.ok) {
          const data = await res.json();
          setPrices(data);
        }
      } catch (err) {
        console.error('Failed to load prices', err);
      }
    };
    fetchPrices();
  }, []);

  return (
    <PageTransition>
      {/* Corner animated clouds */}
      <AnimatedCloud className="absolute top-8 right-8 hidden md:block" size={140} delay={1} />
      <AnimatedCloud className="absolute bottom-8 left-8 hidden md:block" size={120} delay={3} />

      <div className="max-w-4xl xl:max-w-6xl 2xl:max-w-7xl w-full min-h-[500px] flex flex-col justify-between gap-8 xl:gap-14 relative transition-all">
        
        {/* Price list top-left */}
        <div className="bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 sm:p-8 md:p-10 xl:p-16 shadow-xl max-w-2xl xl:max-w-4xl w-full self-start transition-all">
          <h2 className="text-2xl md:text-3xl xl:text-5xl font-display font-bold text-white mb-2 xl:mb-4">Прайс-лист услуг</h2>
          <p className="text-xs xl:text-sm text-gummy/60 mb-6 xl:mb-10 font-mono">Наши услуги :3</p>
 
           <div className="flex flex-col gap-4">
             {prices.length === 0 ? (
               // Fallback default prices if server database empty
               <>
                 <div className="border-b border-gummy/20 pb-3 xl:pb-5 flex justify-between items-start gap-4">
                   <div>
                     <h4 className="text-base xl:text-2xl font-bold text-gummy">А</h4>
                     <p className="text-xs xl:text-base text-gummy-light mt-0.5">А.</p>
                   </div>
                   <span className="text-lg xl:text-2xl font-bold text-white whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">450 ₽</span>
                 </div>
                 <div className="border-b border-gummy/20 pb-3 xl:pb-5 flex justify-between items-start gap-4">
                   <div>
                     <h4 className="text-base xl:text-2xl font-bold text-gummy">А</h4>
                     <p className="text-xs xl:text-base text-gummy-light mt-0.5">А.</p>
                   </div>
                   <span className="text-lg xl:text-2xl font-bold text-white whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">700 ₽</span>
                 </div>
               </>
             ) : (
               prices.map((item) => (
                 <div key={item.id} className="border-b border-gummy/20 pb-4 xl:pb-6 flex justify-between items-start gap-4">
                   <div>
                     <h4 className="text-base xl:text-2xl font-bold text-white">{item.title}</h4>
                     <p className="text-xs xl:text-base text-gummy-light mt-1">{item.description}</p>
                   </div>
                   <span className="text-base xl:text-2xl font-bold text-gummy whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">{item.price}</span>
                 </div>
               ))
             )}
           </div>
           
           <button
             id="price-back-btn"
             onClick={() => navigate('/info')}
             className="mt-8 bg-gummy text-wine font-bold text-xs xl:text-base px-5 py-2.5 xl:px-8 xl:py-4 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
           >
             Вернуться назад
           </button>
         </div>
 
         {/* Mascot bottom-right */}
         <div className="self-end mr-4 md:mr-16 xl:scale-150 transition-transform origin-right">
           <MascotPlaceholder pose="pointing-left" size={180} />
         </div>

      </div>
    </PageTransition>
  );
};

// 4. SOCIALS PAGE
const SocialsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <AnimatedCloud className="absolute top-8 left-8 hidden md:block" size={130} delay={0.5} />
      <AnimatedCloud className="absolute bottom-8 right-8 hidden md:block" size={130} delay={2.5} />

      <div className="max-w-4xl xl:max-w-6xl 2xl:max-w-7xl w-full flex flex-col gap-6 md:gap-10 p-4 sm:p-6 transition-all">
        
        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl xl:text-5xl font-display font-bold text-white mb-2">Наши соцсети</h2>
          <p className="text-xs xl:text-sm text-gummy/60 font-mono">Оставайтесь на связи с нами во всех уголках интернета! ✨</p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          
          {/* Main Chat Card */}
          <div className="md:col-span-7 bg-wine-dark/60 border-4 border-gummy rounded-3xl p-6 md:p-10 xl:p-14 flex flex-col justify-between shadow-2xl relative overflow-hidden group transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gummy/5 rounded-full blur-2xl pointer-events-none group-hover:bg-gummy/10 transition-all duration-500" />
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="text-gummy animate-pulse" size={28} />
                <span className="text-[10px] xl:text-xs uppercase tracking-widest font-mono text-gummy/60 font-bold">Официальное сообщество</span>
              </div>
              <h3 className="font-display font-bold text-white text-2xl xl:text-4xl mb-3">НАШ ЧАТ</h3>
              <p className="text-xs xl:text-sm text-gummy/80 leading-relaxed max-w-md">
                Присоединяйтесь к нашему теплому, веселому и дружному сообществу. Здесь вы можете общаться, делиться тейками, находить единомышленников и напрямую задавать вопросы администрации!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a
                id="social-chat-btn"
                href="https://t.me/gummy_wine_chat"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 px-6 rounded-xl bg-gummy text-wine font-bold text-sm xl:text-base hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer duration-200"
              >
                Перейти в чат <ExternalLink size={14} />
              </a>
              <button
                id="socials-back-btn"
                onClick={() => navigate('/info')}
                className="py-3 px-6 rounded-xl bg-transparent border border-gummy/30 text-gummy/60 hover:text-gummy text-xs xl:text-sm font-semibold transition-all hover:border-gummy cursor-pointer"
              >
                Вернуться назад
              </button>
            </div>
          </div>

          {/* Side Grid: The 4 social channels */}
          <div className="md:col-span-5 grid grid-cols-2 gap-4">
            {/* VK */}
            <div className="bg-wine-dark/40 border-2 border-gummy/20 hover:border-gummy/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg text-center transition-all duration-300">
              <h4 className="font-bold text-white text-sm xl:text-lg mb-4">ВКонтакте</h4>
              <a
                id="social-vk-btn"
                href="https://vk.com"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-block bg-gummy/15 hover:bg-gummy text-gummy hover:text-wine text-xs xl:text-sm font-bold py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer duration-200 border border-gummy/20 hover:border-transparent"
              >
                Перейти
              </a>
            </div>

            {/* Instagram */}
            <div className="bg-wine-dark/40 border-2 border-gummy/20 hover:border-gummy/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg text-center transition-all duration-300">
              <h4 className="font-bold text-white text-sm xl:text-lg mb-4">Instagram *</h4>
              <a
                id="social-inst-btn"
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-block bg-gummy/15 hover:bg-gummy text-gummy hover:text-wine text-xs xl:text-sm font-bold py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer duration-200 border border-gummy/20 hover:border-transparent"
              >
                Перейти
              </a>
            </div>

            {/* TikTok */}
            <div className="bg-wine-dark/40 border-2 border-gummy/20 hover:border-gummy/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg text-center transition-all duration-300">
              <h4 className="font-bold text-white text-sm xl:text-lg mb-4">TikTok</h4>
              <a
                id="social-tiktok-btn"
                href="https://tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-block bg-gummy/15 hover:bg-gummy text-gummy hover:text-wine text-xs xl:text-sm font-bold py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer duration-200 border border-gummy/20 hover:border-transparent"
              >
                Перейти
              </a>
            </div>

            {/* Telegram */}
            <div className="bg-wine-dark/40 border-2 border-gummy/20 hover:border-gummy/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg text-center transition-all duration-300">
              <h4 className="font-bold text-white text-sm xl:text-lg mb-4">Телеграм</h4>
              <a
                id="social-tgk-btn"
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-block bg-gummy/15 hover:bg-gummy text-gummy hover:text-wine text-xs xl:text-sm font-bold py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer duration-200 border border-gummy/20 hover:border-transparent"
              >
                Перейти
              </a>
            </div>
          </div>

        </div>

        {/* Small warning disclaimer about Instagram */}
        <p className="text-[10px] xl:text-xs text-gummy/40 text-center mt-2 leading-relaxed">
          * Instagram признан экстремистской организацией на территории РФ.
        </p>

      </div>
    </PageTransition>
  );
};

// 5. ADMINS OVERVIEW PAGE
interface AdminsOverviewPageProps {
  admins: Admin[];
}
const AdminsOverviewPage: React.FC<AdminsOverviewPageProps> = ({ admins: initialAdmins }) => {
  const navigate = useNavigate();
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [selectedAdminPhotoIdx, setSelectedAdminPhotoIdx] = useState<number>(0);
  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);

  const handleSelectAdmin = (admin: Admin | null) => {
    setSelectedAdmin(admin);
    setSelectedAdminPhotoIdx(0);
  };

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await fetch('/api/admins');
        if (res.ok) {
          const data = await res.json();
          setAdmins(data);
        }
      } catch (err) {
        console.error('Failed to load admins list', err);
      }
    };
    fetchAdmins();
  }, []);

  return (
    <PageTransition>
      <div className="max-w-5xl xl:max-w-7xl 2xl:max-w-screen-2xl w-full flex flex-col gap-6 xl:gap-12 relative transition-all">
        <div className="flex justify-between items-center pb-4 border-b-2 border-gummy/20">
          <div>
            <h2 className="text-2xl md:text-3xl xl:text-5xl font-display font-bold text-white">Администрация проекта</h2>
            <p className="text-xs xl:text-sm text-gummy/70 mt-1">Ознакомьтесь с нашей творческой командой!</p>
          </div>
          <button
            id="admins-back-btn"
            onClick={() => navigate('/info')}
            className="px-4 py-2 xl:px-6 xl:py-3.5 bg-gummy text-wine font-bold rounded-xl text-xs xl:text-sm hover:bg-white transition-all shadow cursor-pointer"
          >
            Назад на главную
          </button>
        </div>

        {/* Admins Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.length === 0 ? (
            <p className="text-sm text-gummy/50 col-span-full text-center py-12">Команда настраивается...</p>
          ) : (
            admins.map((adm) => (
              <div key={adm.id} className="bg-wine-dark/40 border-2 border-gummy/30 rounded-2xl p-5 xl:p-8 flex flex-col items-center text-center gap-4 shadow-lg hover:border-gummy transition-all relative group">
                <div className="absolute top-3 right-3 bg-wine-dark/80 px-2.5 py-0.5 rounded-full border border-gummy/20 text-[10px] xl:text-xs font-mono text-gummy">
                  {adm.role}
                </div>

                <img
                  src={parseProfileUrls(adm.photoUrl)[0] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                  alt={adm.nickname}
                  className="w-24 h-24 xl:w-32 xl:h-32 rounded-full object-cover border-4 border-gummy shadow-md group-hover:scale-105 transition-all mt-2"
                />

                <div>
                  <h3 className="font-display font-bold text-white text-lg xl:text-2xl">{adm.nickname}</h3>
                  <p className="text-xs xl:text-base text-gummy/60 mt-0.5">{adm.role}</p>
                </div>

                <button
                  id={`learn-more-btn-${adm.id}`}
                  onClick={() => handleSelectAdmin(adm)}
                  className="w-full bg-gummy text-wine text-xs xl:text-sm font-bold py-2.5 xl:py-3.5 rounded-xl hover:bg-white hover:scale-[1.02] transition-all cursor-pointer"
                >
                  Ознакомиться
                </button>
              </div>
            ))
          )}
        </div>

        {/* Mascot pointing from bottom-right corner */}
        <div className="self-end mr-8 mt-4 xl:scale-150 transition-transform origin-right">
          <MascotPlaceholder pose="pointing-left" size={140} />
        </div>

        {/* FULL ADMIN INFO DETAILED MODAL */}
        <AnimatePresence>
          {selectedAdmin && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-wine-dark border-4 border-gummy rounded-3xl p-6 md:p-10 xl:p-14 max-w-lg xl:max-w-2xl w-full shadow-2xl relative overflow-hidden transition-all"
              >
                {/* Cloud decor in top right of modal */}
                <AnimatedCloud className="absolute -top-6 -right-6 opacity-30 pointer-events-none" size={100} />

                <div className="flex flex-col gap-5 mt-2">
                  <div className="flex flex-col gap-4">
                    {(() => {
                      const photos = parseProfileUrls(selectedAdmin.photoUrl);
                      const activePhoto = photos[selectedAdminPhotoIdx] || photos[0] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
                      return (
                        <div className="flex flex-col gap-3">
                          {/* Main Showcase Image */}
                          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-gummy bg-wine/20 shadow-inner flex items-center justify-center">
                            <img src={activePhoto} alt={selectedAdmin.nickname} className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 bg-black/70 px-2.5 py-1 rounded-md text-[10px] xl:text-xs font-mono text-gummy border border-gummy/20">
                              Фото {selectedAdminPhotoIdx + 1} из {Math.max(1, photos.length)}
                            </div>
                          </div>
                          
                          {/* Gallery Thumbnails */}
                          {photos.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full justify-center">
                              {photos.map((ph, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedAdminPhotoIdx(idx)}
                                  className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                                    selectedAdminPhotoIdx === idx ? 'border-gummy scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <img src={ph} alt={`Миниатюра ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-4 border-t border-gummy/20 pt-3">
                      <div className="flex-1">
                        <h3 className="font-display font-bold text-white text-xl xl:text-3xl">{selectedAdmin.nickname}</h3>
                        <span className="text-xs xl:text-sm bg-wine/60 border border-gummy/20 px-2.5 py-0.5 rounded-full text-gummy font-semibold inline-block mt-1.5">
                          {selectedAdmin.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] xl:text-xs text-gummy/60 font-bold uppercase">О себе</span>
                    <p className="text-sm xl:text-base text-gummy-light bg-wine/30 border border-gummy/10 p-3.5 rounded-xl whitespace-pre-wrap leading-relaxed">
                      {selectedAdmin.aboutMe || 'Информация уточняется...'}
                    </p>
                  </div>

                  {selectedAdmin.hobbies && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] xl:text-xs text-gummy/60 font-bold uppercase">Увлечения & Хобби</span>
                      <p className="text-sm xl:text-lg text-white font-medium">{selectedAdmin.hobbies}</p>
                    </div>
                  )}

                  {/* Attached Music Playback */}
                  {(() => {
                    const tracks = parseProfileUrls(selectedAdmin.musicUrl);
                    if (tracks.length === 0) return null;
                    return (
                      <div className="flex flex-col gap-2 border-t border-gummy/10 pt-3">
                        <span className="text-[10px] xl:text-xs text-gummy/60 font-bold uppercase tracking-widest mb-1">Плейлист / Любимые треки ({tracks.length})</span>
                        <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {tracks.map((trackUrl, idx) => (
                            <MusicPlayer
                              key={idx}
                              url={trackUrl}
                              title={`Трек #${idx + 1}: ${trackUrl.substring(trackUrl.lastIndexOf('/') + 1) || selectedAdmin.nickname}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3 mt-4">
                    <button
                      id="modal-write-take-btn"
                      onClick={() => {
                        setSelectedAdmin(null);
                        navigate('/take', { state: { selectedAdminId: selectedAdmin.id } });
                      }}
                      className="flex-1 bg-gummy text-wine font-bold text-xs xl:text-base py-3 xl:py-4 rounded-xl hover:bg-white transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={14} /> Написать тейк
                    </button>
                    
                    <button
                      id="modal-close-btn"
                      onClick={() => setSelectedAdmin(null)}
                      className="px-5 bg-transparent border border-gummy/30 hover:border-gummy text-gummy text-xs xl:text-base font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Закрыть
                    </button>
                  </div>

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </PageTransition>
  );
};

// 6. RULES PAGE
const RulesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <div className="max-w-3xl xl:max-w-5xl 2xl:max-w-6xl w-full flex flex-col gap-6 xl:gap-12 relative transition-all">
        {/* Animated small cloud in top-right */}
        <AnimatedCloud className="absolute top-2 right-2 hidden sm:block" size={90} />

        <div className="bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-10 xl:p-16 shadow-xl relative z-10 transition-all">
          <h2 className="text-2xl md:text-3xl xl:text-5xl font-display font-bold text-white mb-6 xl:mb-10 border-b border-gummy/20 pb-3 xl:pb-5">
            Правила проекта
          </h2>

          <div className="flex flex-col gap-5 xl:gap-8 text-sm md:text-base xl:text-xl leading-relaxed text-gummy-light">
            <div className="flex gap-3 xl:gap-5 items-start">
              <span className="w-6 h-6 xl:w-10 xl:h-10 rounded-full bg-gummy text-wine font-mono font-bold text-xs xl:text-lg flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-white xl:text-2xl">Минимум нецензурной лексики.</strong>
                <p className="text-xs xl:text-lg text-gummy/70 mt-1 xl:mt-2">Мы ценим вежливое и комфортное общение. Избегайте чрезмерного мата и ругани.</p>
              </div>
            </div>

            <div className="flex gap-3 xl:gap-5 items-start">
              <span className="w-6 h-6 xl:w-10 xl:h-10 rounded-full bg-gummy text-wine font-mono font-bold text-xs xl:text-lg flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-white xl:text-2xl">Никакой травли и деанонимизации.</strong>
                <p className="text-xs xl:text-lg text-gummy/70 mt-1 xl:mt-2">Анонимность авторов тейков защищена на 100%. Публичное оскорбление или попытки раскрытия личных данных строго запрещены.</p>
              </div>
            </div>

            <div className="flex gap-3 xl:gap-5 items-start">
              <span className="w-6 h-6 xl:w-10 xl:h-10 rounded-full bg-gummy text-wine font-mono font-bold text-xs xl:text-lg flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-white xl:text-2xl">Уважение к труду команды.</strong>
                <p className="text-xs xl:text-lg text-gummy/70 mt-1 xl:mt-2">Наши администраторы обрабатывают ваши тейки добровольно. Относитесь к ним с теплом!</p>
              </div>
            </div>

            <div className="flex gap-3 xl:gap-5 items-start">
              <span className="w-6 h-6 xl:w-10 xl:h-10 rounded-full bg-gummy text-wine font-mono font-bold text-xs xl:text-lg flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-white xl:text-2xl">Только честные обсуждения.</strong>
                <p className="text-xs xl:text-lg text-gummy/70 mt-1 xl:mt-2">Присылайте только достоверные сплетни или личное мнение, не вводите участников в заблуждение.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              id="rules-back-btn"
              onClick={() => navigate('/info')}
              className="bg-gummy text-wine font-bold text-xs xl:text-base px-5 py-2.5 xl:px-8 xl:py-4 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Вернуться назад
            </button>
            <button
              id="rules-write-take-btn"
              onClick={() => navigate('/take')}
              className="bg-transparent border border-gummy hover:bg-gummy hover:text-wine text-gummy font-bold text-xs xl:text-base px-5 py-2.5 xl:px-8 xl:py-4 rounded-xl transition-all cursor-pointer"
            >
              Перейти к тейкам
            </button>
          </div>
        </div>

        {/* Mascot in bottom-left */}
        <div className="self-start ml-4 mt-2 xl:scale-150 transition-transform origin-left">
          <MascotPlaceholder pose="pointing-right" size={140} />
        </div>

      </div>
    </PageTransition>
  );
};

// 7. TAKE SUBMISSION PAGE
interface TakeSubmissionPageProps {
  admins: Admin[];
  tgUser: { tgId: string; username: string | null; firstName: string | null; avatarUrl?: string | null } | null;
  setTgUser: (user: { tgId: string; username: string | null; firstName: string | null; avatarUrl?: string | null } | null) => void;
}
const TakeSubmissionPage: React.FC<TakeSubmissionPageProps> = ({ admins: initialAdmins, tgUser, setTgUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [admins, setAdmins] = useState<Admin[]>(initialAdmins);
  const [type, setType] = useState<'take' | 'idea'>('take');
  const [content, setContent] = useState('');
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [targetAdminId, setTargetAdminId] = useState('all');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [authCode, setAuthCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('verifsitepodsl_bot');
  const [authLoading, setAuthLoading] = useState(false);
  const [takeImageFailed, setTakeImageFailed] = useState(false);

  // Math Captcha States
  const [captcha, setCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Fetch fresh CAPTCHA
  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptcha(data);
        setCaptchaAnswer('');
      }
    } catch (err) {
      console.error('Failed to load captcha', err);
    }
  };

  // Fetch fresh admins, CAPTCHA & config on mount
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await fetch('/api/admins');
        if (res.ok) {
          const data = await res.json();
          setAdmins(data);
        }
      } catch (err) {
        console.error('Failed to load admins', err);
      }
    };
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.botUsername) {
            setBotUsername(data.botUsername);
          }
        }
      } catch (err) {
        console.error('Failed to load config', err);
      }
    };
    fetchAdmins();
    fetchCaptcha();
    fetchConfig();
  }, []);

  // Handle Telegram login initiation
  const handleInitTgLogin = async () => {
    setAuthLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/tg-login-init', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAuthCode(data.code);
        setBotUsername(data.botUsername);
      } else {
        setErrorMsg('Не удалось инициировать вход. Пожалуйста, обновите страницу.');
      }
    } catch (err) {
      setErrorMsg('Ошибка соединения с сервером при попытке входа.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Poll Telegram login status
  useEffect(() => {
    if (!authCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/tg-login-status?code=${authCode}`);
        if (res.ok) {
          const session = await res.json();
          if (session.status === 'authenticated') {
            const user = {
              tgId: session.tgId,
              username: session.username,
              firstName: session.firstName,
              avatarUrl: session.avatarUrl
            };
            setTgUser(user);
            localStorage.setItem('wine_tg_user', JSON.stringify(user));
            setAuthCode(null);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed checking authentication session status', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [authCode]);

  // Handle Logout
  const handleLogoutTg = () => {
    if (window.confirm('Вы действительно хотите выйти из аккаунта Telegram?')) {
      setTgUser(null);
      localStorage.removeItem('wine_tg_user');
      setAuthCode(null);
    }
  };

  // Handle file uploads directly
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

  // Handle pre-selected admin from profile routing
  useEffect(() => {
    if (location.state && location.state.selectedAdminId) {
      setTargetAdminId(location.state.selectedAdminId);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgUser) {
      setErrorMsg('Для отправки тейка необходимо войти через Telegram.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Пожалуйста, введите текст вашего тейка.');
      return;
    }
    if (!captchaAnswer.trim()) {
      setErrorMsg('Пожалуйста, решите защитный пример (капчу).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content,
          imageUrl: mediaList.length > 0 ? JSON.stringify(mediaList) : null,
          targetAdminId,
          userTgId: tgUser.tgId,
          userTgUsername: tgUser.username,
          userTgName: tgUser.firstName,
          captchaId: captcha?.captchaId,
          captchaAnswer,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setContent('');
        setMediaList([]);
        setTargetAdminId('all');
        setCaptchaAnswer('');
        fetchCaptcha();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Ошибка отправки тейка');
        fetchCaptcha();
      }
    } catch (err) {
      setErrorMsg('Произошла ошибка при соединении с сервером');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl xl:max-w-7xl 2xl:max-w-screen-2xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 xl:gap-14 items-center relative transition-all">
        
        {/* LEFT COLUMN: MASCOT (cols 4) */}
        <div className="md:col-span-4 flex flex-col items-center gap-4">
          {!takeImageFailed ? (
            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="w-full max-w-[200px] sm:max-w-[240px] xl:max-w-[320px] 2xl:max-w-[380px]"
            >
              <img
                src="/take.png"
                alt="Маскот Тейк"
                className="w-full h-auto object-contain drop-shadow-2xl"
                onError={() => setTakeImageFailed(true)}
              />
            </motion.div>
          ) : (
            <MascotPlaceholder pose={tgUser ? "thinking" : "neutral"} size={200} className="xl:scale-130 transition-transform" />
          )}
          <div className="bg-wine-dark/40 border border-gummy/20 rounded-xl p-3 text-center text-xs xl:text-sm max-w-xs text-gummy/80 leading-relaxed">
            {tgUser 
              ? "Поделитесь важной сплетней или классной идеей! Ваша анонимность полностью защищена."
              : "Для защиты от спама и для ведения чата с админом, пожалуйста, авторизуйтесь через Telegram!"
            }
          </div>
        </div>

        {/* RIGHT COLUMN: MINI-BOARD FOR FORM (cols 8) */}
        <div className="md:col-span-8 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 sm:p-8 md:p-10 xl:p-14 2xl:p-20 shadow-xl transition-all">
          <div className="border-b border-gummy/20 pb-4 mb-5 flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-display font-bold text-white">Доска отправки тейков</h2>
            <button
              id="take-back-btn"
              onClick={() => navigate('/info')}
              className="text-xs text-gummy/70 hover:text-gummy underline font-mono"
            >
              на главную
            </button>
          </div>

          {success ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-10 flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-gummy text-wine flex items-center justify-center shadow-lg">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="font-display font-bold text-xl text-white">Успешно отправлено!</h3>
              <p className="text-sm text-gummy/80 max-w-sm leading-relaxed">
                Ваш тейк сохранен в системе и передан администраторам. Вы получите анонимные ответы прямо в вашем Telegram-боте!
              </p>
              <button
                id="take-success-new-btn"
                onClick={() => setSuccess(false)}
                className="mt-4 bg-gummy text-wine font-bold text-xs px-6 py-3 rounded-xl hover:bg-white transition-all shadow-md"
              >
                Отправить ещё один
              </button>
            </motion.div>
          ) : !tgUser ? (
            /* TELEGRAM BOT AUTHENTICATION CARD */
            <div className="text-center py-6 flex flex-col items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-gummy/20 text-gummy flex items-center justify-center border-2 border-gummy shadow-md">
                <Lock size={26} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white mb-1.5">Вход через Telegram</h3>
                <p className="text-xs text-gummy/70 max-w-md leading-relaxed mx-auto">
                  Авторизация привязывает ваши будущие тейки к Telegram ID, чтобы администраторы могли ответить вам напрямую в чат-бот. При этом ваша личность на сайте остается на 100% анонимной!
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-500/50 p-3.5 rounded-xl text-xs text-red-300 flex items-center gap-2 max-w-md w-full">
                  <AlertCircle size={15} /> {errorMsg}
                </div>
              )}

              {authCode ? (
                <div className="bg-wine-dark/80 border border-gummy/30 rounded-2xl p-5 flex flex-col gap-4 items-center max-w-md w-full shadow-inner">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-gummy/50 font-bold">Уникальный токен входа</span>
                    <span className="text-lg font-mono font-bold text-white bg-wine/80 px-4 py-1.5 rounded-lg border border-gummy/10">{authCode}</span>
                  </div>

                  <a
                    href={`https://t.me/${botUsername}?start=login_${authCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-gummy hover:bg-white text-wine font-bold text-sm py-3 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
                  >
                    🚀 Запустить бота в Telegram
                  </a>

                  <div className="flex items-center gap-2.5 mt-1 text-gummy/60">
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-gummy animate-spin" />
                    <span className="text-xs leading-none">Ожидание подтверждения от бота...</span>
                  </div>

                  <button
                    onClick={() => setAuthCode(null)}
                    className="text-xs text-gummy/50 hover:text-gummy underline font-mono mt-1"
                  >
                    Отменить вход
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleInitTgLogin}
                  disabled={authLoading}
                  className="bg-gummy hover:bg-white text-wine font-bold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg flex items-center gap-2 hover:scale-105"
                >
                  {authLoading ? 'Генерация сессии...' : 'Войти через Telegram'} <Sparkles size={16} />
                </button>
              )}
            </div>
          ) : (
            /* STANDARD TAKE SUBMISSION FORM FOR LOGGED IN USERS */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* Logged in User Indicator */}
              <div className="bg-gummy/10 border border-gummy/20 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-gummy">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span>Вы вошли как: <b>{tgUser.firstName}</b> {tgUser.username ? `(@${tgUser.username})` : ''}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogoutTg}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Выйти
                </button>
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-500/50 p-3.5 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle size={15} /> {errorMsg}
                </div>
              )}

              {/* Selector for Take vs Idea */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="type-take-btn"
                  type="button"
                  onClick={() => setType('take')}
                  className={`py-3 rounded-xl font-bold text-xs border-2 transition-all ${
                    type === 'take' 
                      ? 'bg-gummy border-gummy text-wine shadow-lg' 
                      : 'bg-transparent border-gummy/30 text-gummy hover:border-gummy'
                  }`}
                >
                  Сплетня / Тейк 💬
                </button>
                <button
                  id="type-idea-btn"
                  type="button"
                  onClick={() => setType('idea')}
                  className={`py-3 rounded-xl font-bold text-xs border-2 transition-all ${
                    type === 'idea' 
                      ? 'bg-gummy border-gummy text-wine shadow-lg' 
                      : 'bg-transparent border-gummy/30 text-gummy hover:border-gummy'
                  }`}
                >
                  Предложить идею 💡
                </button>
              </div>

              {/* Target Admin Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-gummy/70">Адресат тейка</label>
                <select
                  id="take-target-select"
                  value={targetAdminId}
                  onChange={(e) => setTargetAdminId(e.target.value)}
                  className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy cursor-pointer"
                >
                  <option value="all">Всем администраторам (кто первый возьмет)</option>
                  {admins.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      Лично админу: {adm.nickname} ({adm.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dialogue Box Textarea */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-gummy/70">Текст сообщения *</label>
                <textarea
                  id="take-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy resize-none placeholder-gummy/30"
                  placeholder="Опишите подробно все детали сплетни или вашей идеи..."
                  required
                />
              </div>

              {/* Multiple Media Attachments */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase text-gummy/70">Прикрепить фото / медиа (макс. 10 шт. до 5МБ каждая)</label>
                
                <div className="flex gap-2 items-center">
                  <div className="flex-1 bg-wine/30 border border-gummy/20 rounded-xl px-4 py-2.5 text-gummy/50 text-xs">
                    Загружено: {mediaList.length} / 10 файлов
                  </div>
                  <label className="bg-gummy hover:bg-white text-wine font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all text-xs flex items-center justify-center shrink-0">
                    Выбрать файл 🖼️
                    <input
                      type="file"
                      multiple
                      accept="image/*,audio/*,video/*"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        if (mediaList.length + files.length > 10) {
                          setErrorMsg('Превышен лимит! Максимум можно прикрепить 10 файлов.');
                          return;
                        }
                        
                        setErrorMsg('Идет загрузка файлов...');
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          if (file.size > 5 * 1024 * 1024) {
                            setErrorMsg(`Файл "${file.name}" превышает 5МБ.`);
                            continue;
                          }
                          try {
                            const url = await handleFileUpload(file);
                            setMediaList(prev => [...prev, url]);
                            setErrorMsg('');
                          } catch (err: any) {
                            setErrorMsg(err.message || 'Ошибка при загрузке файла');
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Grid of uploaded files with remove button */}
                {mediaList.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-wine-dark/30 border-2 border-dashed border-gummy/20 p-4 rounded-2xl">
                    {mediaList.map((url, index) => {
                      const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i) || url.includes('audio');
                      return (
                        <div key={index} className="relative group aspect-square bg-wine border border-gummy/20 rounded-xl overflow-hidden flex flex-col items-center justify-center p-2">
                          {isAudio ? (
                            <span className="text-2xl">🎵</span>
                          ) : (
                            <img src={url} alt="Загружено" className="w-full h-full object-cover rounded-lg" />
                          )}
                          
                          {/* Sizing Indicator */}
                          <span className="absolute bottom-1 left-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-white"># {index + 1}</span>
                          
                          {/* Delete Hover Action */}
                          <button
                            type="button"
                            onClick={() => setMediaList(prev => prev.filter((_, idx) => idx !== index))}
                            className="absolute top-1 right-1 bg-red-600/90 text-white rounded-md p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Visual SVG CAPTCHA Code block */}
              {captcha && (
                <div className="bg-wine/40 border-2 border-gummy/10 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-col gap-0.5 text-left w-full sm:w-auto">
                    <span className="text-[10px] font-bold uppercase text-gummy/70">Защита от спама и ботов *</span>
                    <span className="text-[11px] text-gummy/50">Решите пример для подтверждения:</span>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <div 
                      className="rounded-lg overflow-hidden border border-gummy/20 cursor-pointer shrink-0"
                      title="Обновить капчу"
                      onClick={fetchCaptcha}
                      dangerouslySetInnerHTML={{ __html: captcha.svg }}
                    />
                    <input
                      type="text"
                      required
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Ответ"
                      className="w-20 bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 text-white text-xs text-center outline-none focus:border-gummy"
                    />
                  </div>
                </div>
              )}

              <button
                id="take-submit-btn"
                type="submit"
                disabled={loading}
                className="mt-3 bg-gummy text-wine font-bold text-xs py-3.5 rounded-xl hover:bg-white transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading ? 'Отправка...' : 'Отправить на доску'} <Send size={13} />
              </button>

            </form>
          )}

        </div>

      </div>
    </PageTransition>
  );
};

// 8. ANKETA INTRO PAGE
const AnketaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <div className="max-w-5xl xl:max-w-7xl 2xl:max-w-screen-2xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 xl:gap-14 items-center justify-center transition-all">
        
        {/* Left Mascot */}
        <div className="md:col-span-3 flex justify-center xl:scale-130 transition-transform">
          <MascotPlaceholder pose="greeting" size={170} />
        </div>

        {/* Center Panel */}
        <div className="md:col-span-6 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-8 xl:p-14 text-center shadow-2xl relative transition-all">
          <HelpCircle className="mx-auto text-gummy mb-4 xl:scale-150 xl:mb-6" size={32} />
          <h2 className="font-display font-bold text-white text-xl md:text-2xl xl:text-4xl mb-4 leading-normal">
            Хочешь к нам в команду? Мы хотим тебя видеть!
          </h2>
          <p className="text-xs xl:text-base text-gummy/70 mb-8 xl:mb-12 leading-relaxed max-w-sm xl:max-w-lg mx-auto">
            Наша команда постоянно расширяется. Если вы хотите внести свой вклад, развивать канал, модерировать посты — заполните небольшую анкету, и мы обязательно свяжемся с вами!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="anketa-fill-btn"
              onClick={() => navigate('/survey')}
              className="px-6 py-3 xl:py-4.5 rounded-xl bg-gummy text-wine font-bold text-xs xl:text-base hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Заполнить анкету
            </button>
            <button
              id="anketa-back-btn"
              onClick={() => navigate('/info')}
              className="px-6 py-3 xl:py-4.5 rounded-xl bg-transparent border border-gummy/30 hover:border-gummy text-gummy text-xs xl:text-base font-semibold transition-all cursor-pointer"
            >
              Назад
            </button>
          </div>
        </div>

        {/* Right Mascot */}
        <div className="md:col-span-3 flex justify-center xl:scale-130 transition-transform">
          <MascotPlaceholder pose="neutral" size={170} />
        </div>

      </div>
    </PageTransition>
  );
};

// 9. SURVEY QUESTIONNAIRE FORM PAGE
const SurveyFormPage: React.FC = () => {
  const navigate = useNavigate();

  const [source, setSource] = useState('');
  const [sphere, setSphere] = useState('');
  const [age, setAge] = useState('');
  const [roleInterest, setRoleInterest] = useState('');
  const [helpDescription, setHelpDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Math Captcha States
  const [captcha, setCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptcha(data);
        setCaptchaAnswer('');
      }
    } catch (err) {
      console.error('Failed to load captcha', err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !sphere || !age || !roleInterest || !helpDescription) {
      setErrorMsg('Пожалуйста, ответьте на все вопросы анкеты.');
      return;
    }
    if (!captchaAnswer.trim()) {
      setErrorMsg('Пожалуйста, введите ответ капчи.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          sphere,
          age,
          roleInterest,
          helpDescription,
          captchaId: captcha?.captchaId,
          captchaAnswer,
        }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Произошла ошибка при сохранении заявки.');
        fetchCaptcha();
      }
    } catch (err) {
      setErrorMsg('Сбой подключения к серверу.');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-3xl xl:max-w-5xl 2xl:max-w-6xl w-full bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-10 xl:p-16 shadow-xl transition-all">
        <div className="border-b border-gummy/20 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl md:text-2xl xl:text-4xl font-display font-bold text-white">Анкета кандидата</h2>
            <p className="text-xs xl:text-base text-gummy/60 mt-0.5">Помогите нам узнать о вас поближе</p>
          </div>
          <button
            id="survey-back-btn"
            onClick={() => navigate('/anketa')}
            className="text-xs xl:text-base text-gummy/60 hover:text-gummy underline font-mono cursor-pointer"
          >
            назад
          </button>
        </div>

        {success ? (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 xl:w-24 xl:h-24 rounded-full bg-gummy text-wine flex items-center justify-center shadow-lg">
              <Check className="w-8 h-8 xl:w-12 xl:h-12" strokeWidth={3} />
            </div>
            <h3 className="font-display font-bold text-xl xl:text-3xl text-white">Анкета успешно принята!</h3>
            <p className="text-xs xl:text-lg text-gummy/80 max-w-sm xl:max-w-xl leading-relaxed mx-auto">
              Ваша заявка направлена Главному Владельцу канала. Мы изучим её и напишем вам, если ваша кандидатура подойдёт. Спасибо за интерес!
            </p>
            <button
              id="survey-success-back"
              onClick={() => navigate('/info')}
              className="mt-6 bg-gummy text-wine font-bold text-xs xl:text-base px-6 py-3 xl:px-8 xl:py-4.5 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Вернуться на главную
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 xl:gap-6">
            {errorMsg && (
              <div className="bg-red-950/60 border border-red-500/50 p-3.5 rounded-xl text-xs xl:text-base text-red-300 flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            {/* Q1 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs xl:text-lg font-semibold text-gummy">1. Откуда вы узнали о нашем проекте? *</label>
              <input
                id="q-source"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Из Телеграма, от друзей, реклама в пабликах..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 xl:py-4 text-white text-xs xl:text-base outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q2 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs xl:text-lg font-semibold text-gummy">2. Из какой вы сферы деятельности? *</label>
              <input
                id="q-sphere"
                type="text"
                value={sphere}
                onChange={(e) => setSphere(e.target.value)}
                placeholder="КМБП, другое км."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 xl:py-4 text-white text-xs xl:text-base outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q3 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs xl:text-lg font-semibold text-gummy">3. Сколько вам лет? *</label>
              <input
                id="q-age"
                type="number"
                min={5}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Например: 18"
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 xl:py-4 text-white text-xs xl:text-base outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q4 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs xl:text-lg font-semibold text-gummy">4. Чем конкретно вы хотите заниматься в проекте? *</label>
              <input
                id="q-role"
                type="text"
                value={roleInterest}
                onChange={(e) => setRoleInterest(e.target.value)}
                placeholder="Вести посты, модерировать чат..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 xl:py-4 text-white text-xs xl:text-base outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q5 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs xl:text-lg font-semibold text-gummy">5. Как именно вы готовы помочь развивать проект? *</label>
              <textarea
                id="q-help"
                value={helpDescription}
                onChange={(e) => setHelpDescription(e.target.value)}
                rows={3}
                placeholder="Опишите ваши навыки, предыдущий опыт или классные идеи для продвижения..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 xl:py-4 text-white text-xs xl:text-base outline-none focus:border-gummy resize-none"
                required
              />
            </div>

            {/* Math Captcha Element */}
            {captcha && (
              <div className="bg-wine/40 border-2 border-gummy/10 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between mt-1">
                <div className="flex flex-col gap-0.5 text-left w-full sm:w-auto">
                  <span className="text-[10px] xl:text-xs font-bold uppercase text-gummy/70">Защита от спама и ботов *</span>
                  <span className="text-[11px] xl:text-sm text-gummy/50">Решите пример для подтверждения:</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <div 
                    className="rounded-lg overflow-hidden border border-gummy/20 cursor-pointer shrink-0"
                    title="Обновить капчу"
                    onClick={fetchCaptcha}
                    dangerouslySetInnerHTML={{ __html: captcha.svg }}
                  />
                  <input
                    type="text"
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Ответ"
                    className="w-20 xl:w-28 bg-wine border-2 border-gummy/20 rounded-xl px-3 py-2 xl:py-3.5 text-white text-xs xl:text-base text-center outline-none focus:border-gummy"
                  />
                </div>
              </div>
            )}

            <button
              id="survey-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-4 bg-gummy text-wine font-bold text-xs xl:text-base py-3.5 xl:py-4.5 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
            >
              {loading ? 'Отправка анкеты...' : 'Отправить анкету владельцу'}
            </button>

          </form>
        )}
      </div>
    </PageTransition>
  );
};

// 10. UNIONS PAGE
interface UnionsPageProps {
  unions: UnionItem[];
}
const UnionsPage: React.FC<UnionsPageProps> = ({ unions: initialUnions }) => {
  const navigate = useNavigate();
  const [unions, setUnions] = useState<UnionItem[]>(initialUnions);

  useEffect(() => {
    const fetchUnions = async () => {
      try {
        const res = await fetch('/api/unions');
        if (res.ok) {
          const data = await res.json();
          setUnions(data);
        }
      } catch (err) {
        console.error('Failed to load unions', err);
      }
    };
    fetchUnions();
  }, []);

  return (
    <PageTransition>
      <div className="max-w-5xl xl:max-w-7xl 2xl:max-w-screen-2xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 xl:gap-14 items-center justify-center transition-all">
        
        {/* Left Mascot */}
        <div className="md:col-span-3 flex justify-center xl:scale-130 transition-transform">
          <MascotPlaceholder pose="greeting" size={170} />
        </div>

        {/* Center content */}
        <div className="md:col-span-6 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 sm:p-8 md:p-10 xl:p-16 shadow-2xl relative flex flex-col gap-6 transition-all">
          <div className="border-b border-gummy/20 pb-3 mb-1 text-center">
            <h2 className="font-display font-bold text-white text-xl md:text-2xl xl:text-4xl">Наши союзы</h2>
            <p className="text-xs xl:text-sm text-gummy/50 mt-0.5 font-mono">Wine Mascot Alliance & Partners</p>
          </div>

          <div className="flex flex-col gap-4">
            {unions.length === 0 ? (
              <p className="text-xs xl:text-sm text-gummy/50 text-center py-6">Партнёрские союзы настраиваются...</p>
            ) : (
              unions.map((union) => (
                <div key={union.id} className="bg-wine border border-gummy/20 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white text-base xl:text-xl">{union.name}</h3>
                    <a
                      href={union.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs xl:text-sm text-gummy hover:underline flex items-center gap-1"
                    >
                      Ресурс <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="text-xs xl:text-base text-gummy-light leading-relaxed whitespace-pre-wrap">{union.description}</p>
                </div>
              ))
            )}
          </div>

          <button
            id="unions-back-btn"
            onClick={() => navigate('/info')}
            className="w-full py-3 xl:py-4.5 bg-gummy text-wine font-bold text-xs xl:text-base rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
          >
            Вернуться на главную
          </button>
        </div>

        {/* Right Mascot */}
        <div className="md:col-span-3 flex justify-center xl:scale-130 transition-transform">
          <MascotPlaceholder pose="neutral" size={170} />
        </div>

      </div>
    </PageTransition>
  );
};

// 11. ADMIN LOGIN PAGE
interface AdminLoginPageProps {
  onLogin: (admin: Admin) => void;
}
const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Введите логин и пароль.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        onLogin(data.user);
      } else {
        setErrorMsg(data.error || 'Неверные авторизационные данные.');
      }
    } catch (err) {
      setErrorMsg('Не удалось подключиться к серверу авторизации.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-md w-full bg-wine-dark/50 border-4 border-gummy rounded-3xl p-8 shadow-2xl relative">
        <div className="text-center mb-6">
          <Shield className="mx-auto text-gummy mb-2 animate-bounce" size={32} />
          <h2 className="font-display font-bold text-white text-xl">Авторизация админа</h2>
          <p className="text-xs text-gummy/60 mt-1">Доступ к панели управления тейками</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
          
          {errorMsg && (
            <div className="bg-red-950/60 border border-red-500/50 p-3 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gummy/70">Логин пользователя</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gummy/70">Пароль доступа</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
              required
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="mt-2 bg-gummy text-wine font-bold text-xs py-3.5 rounded-xl hover:bg-white transition-all shadow-md uppercase tracking-wider"
          >
            {loading ? 'Вход...' : 'Войти в систему'}
          </button>

          <button
            id="login-back-btn"
            type="button"
            onClick={() => navigate('/info')}
            className="bg-transparent text-gummy/50 hover:text-gummy text-xs transition-all text-center mt-2"
          >
            Вернуться на главную
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-gummy/10 text-center text-[10px] text-gummy/40 font-mono leading-relaxed">
          <p>По умолчанию созданы аккаунты:</p>
          <p className="mt-1">Владелец: <span className="text-gummy/60 font-bold">owner</span> / <span className="text-gummy/60 font-bold">owner123</span></p>
          <p>Админ: <span className="text-gummy/60 font-bold">kibo</span> / <span className="text-gummy/60 font-bold">kibo123</span></p>
        </div>
      </div>
    </PageTransition>
  );
};