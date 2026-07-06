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
  MapPin, Eye, Play, Plus, BookOpen, Volume2, Globe 
} from 'lucide-react';

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
        <GlobalDecorations />

        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/info" element={<MainInfoPage admins={admins} unions={unions} />} />
          <Route path="/price" element={<PricePage prices={prices} />} />
          <Route path="/socials" element={<SocialsPage />} />
          <Route path="/admin" element={<AdminsOverviewPage admins={admins} />} />
          <Route path="/admins" element={<AdminsOverviewPage admins={admins} />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/take" element={<TakeSubmissionPage admins={admins} />} />
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
const GlobalDecorations: React.FC = () => {
  const { pathname } = useLocation();
  // Do not show distracting background noise in the admin panel
  if (pathname.includes('admin-panel')) return null;

  return (
    <>
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

  return (
    <PageTransition>
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-wine-dark/40 border-4 border-gummy rounded-3xl p-8 md:p-12 shadow-2xl relative">
        {/* Mascot on left */}
        <div className="flex justify-center md:justify-end pr-0 md:pr-4">
          <MascotPlaceholder pose="greeting" size={240} />
        </div>

        {/* Text bubble and buttons on right */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-6">
          
          {/* Custom SVG dialogue bubble sketch look */}
          <div className="relative bg-gummy text-wine p-6 md:p-8 rounded-3xl border-4 border-white shadow-lg max-w-sm">
            <h2 className="text-xl md:text-2xl font-display font-bold leading-snug">
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
              className="flex-1 bg-gummy text-wine font-bold text-lg py-4 px-8 rounded-2xl hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-lg border-2 border-transparent hover:border-wine"
            >
              Да
            </button>
            <button
              id="start-definitely-btn"
              onClick={() => navigate('/info')}
              className="flex-1 bg-transparent border-4 border-gummy text-gummy font-bold text-lg py-4 px-6 rounded-2xl hover:bg-gummy hover:text-wine hover:scale-105 active:scale-95 transition-all shadow-lg"
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

  return (
    <PageTransition>
      <div className="max-w-5xl w-full flex flex-col gap-8">
        
        {/* ROW OF 6 CORE BUTTONS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 bg-wine-dark/40 border-4 border-gummy rounded-2xl p-4 shadow-xl">
          <button
            id="nav-price"
            onClick={() => navigate('/price')}
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm cursor-pointer"
          >
            Прайс
          </button>
          <button
            id="nav-socials"
            onClick={() => navigate('/socials')}
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm cursor-pointer"
          >
            Соцсети
          </button>
          <button
            id="nav-admin"
            onClick={() => navigate('/admin')}
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm cursor-pointer"
          >
            Администрация
          </button>
          <button
            id="nav-take"
            onClick={() => navigate('/take')}
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm cursor-pointer"
          >
            Написать тейк
          </button>
          <a
            id="nav-support"
            href="https://t.me/our_support_channel"
            target="_blank"
            rel="noreferrer"
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm flex items-center justify-center gap-1"
          >
            Техподдержка <ExternalLink size={13} />
          </a>
          <button
            id="nav-anketa"
            onClick={() => navigate('/anketa')}
            className="py-3 px-4 rounded-xl bg-gummy text-wine font-display font-bold text-center hover:bg-white hover:scale-105 transition-all shadow-md text-sm cursor-pointer"
          >
            Подать заявку
          </button>
        </div>

        {/* MASCOT LYING & LOOKING UP AT BUTTONS */}
        <div className="flex justify-center -my-3">
          <MascotPlaceholder pose="lying" size={200} />
        </div>

        {/* ABOUT INFO & STANDING MASCOT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center relative">
          
          {/* Decorative flying clouds and flowers extending beyond border on the left */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-0 opacity-45 pointer-events-none hidden xl:flex">
            <AnimatedCloud size={100} delay={0} />
            <AnimatedFlower size={55} delay={1.5} />
            <AnimatedCloud size={80} delay={3} />
            <AnimatedFlower size={45} delay={0.5} />
          </div>

          {/* Info field in center (span 3 cols) */}
          <div className="md:col-span-3 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-xl relative z-10">
            <span className="text-[10px] uppercase tracking-widest font-mono text-gummy/60 font-bold block mb-1">Информация</span>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white mb-4">О нас</h2>
            <p className="text-sm md:text-base text-gummy-light leading-relaxed whitespace-pre-line">
              ПРИНИМАЕМ СПЛЕТНИ СО ВСЕХ КФ  Наша команда обрабатывает все ваши идеи, анонимные тейки и предложения, чтобы публиковать их яркими и веселыми. 
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <span className="text-xs bg-wine/60 border border-gummy/30 px-3 py-1 rounded-full font-semibold">100% Анонимно</span>
              <span className="text-xs bg-wine/60 border border-gummy/30 px-3 py-1 rounded-full font-semibold">Уважение</span>
            </div>
          </div>

          {/* Standing mascot on the right (span 1 col) */}
          <div className="flex justify-center md:justify-start z-10">
            <MascotPlaceholder pose="neutral" size={170} />
          </div>
        </div>

        {/* BOTTOM UNIONS BLOCK: Союз Memory Base */}
        <div className="bg-wine-dark/60 border-2 border-gummy/40 rounded-2xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="text-gummy" size={18} />
              <h3 className="font-display font-bold text-white text-lg">Союз Memory Base</h3>
            </div>
            <p className="text-xs text-gummy/80 leading-relaxed">
              Крупнейшее дружественное сообщество в КМБП по борьбе с мошенничеством. 
              <span className="block mt-1 font-semibold text-gummy">Если вы столкнулись с мошенником, обращайтесь к ним.</span>
            </p>
          </div>
          <a
            id="union-memorybase-btn"
            href="https://t.me/memory_base"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-xl bg-gummy text-wine font-bold text-xs hover:bg-white hover:scale-105 transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap self-stretch md:self-auto justify-center"
          >
            Связаться с ними <ExternalLink size={12} />
          </a>
        </div>

        {/* Quick nav helper to Admin Panel */}
        <div className="flex justify-center mt-4">
          <Link to="/admin-panel" className="text-xs text-gummy/50 hover:text-gummy hover:underline flex items-center gap-1.5 font-mono">
            <Shield size={12} /> Вход для администрации
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
const PricePage: React.FC<PricePageProps> = ({ prices }) => {
  const navigate = useNavigate();

  return (
    <PageTransition>
      {/* Corner animated clouds */}
      <AnimatedCloud className="absolute top-8 right-8 hidden md:block" size={140} delay={1} />
      <AnimatedCloud className="absolute bottom-8 left-8 hidden md:block" size={120} delay={3} />

      <div className="max-w-4xl w-full min-h-[500px] flex flex-col justify-between gap-8 relative">
        
        {/* Price list top-left */}
        <div className="bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-xl max-w-2xl self-start">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Прайс-лист услуг</h2>
          <p className="text-xs text-gummy/60 mb-6 font-mono">Wine Mascot Community Services</p>

          <div className="flex flex-col gap-4">
            {prices.length === 0 ? (
              // Fallback default prices if server database empty
              <>
                <div className="border-b border-gummy/20 pb-3 flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-base font-bold text-gummy">А</h4>
                    <p className="text-xs text-gummy-light mt-0.5">А.</p>
                  </div>
                  <span className="text-lg font-bold text-white whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">450 ₽</span>
                </div>
                <div className="border-b border-gummy/20 pb-3 flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-base font-bold text-gummy">А</h4>
                    <p className="text-xs text-gummy-light mt-0.5">А.</p>
                  </div>
                  <span className="text-lg font-bold text-white whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">700 ₽</span>
                </div>
              </>
            ) : (
              prices.map((item) => (
                <div key={item.id} className="border-b border-gummy/20 pb-4 flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-gummy-light mt-1">{item.description}</p>
                  </div>
                  <span className="text-base font-bold text-gummy whitespace-nowrap bg-wine-dark/40 border border-gummy/20 px-3 py-1 rounded-xl">{item.price}</span>
                </div>
              ))
            )}
          </div>
          
          <button
            id="price-back-btn"
            onClick={() => navigate('/info')}
            className="mt-8 bg-gummy text-wine font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
          >
            Вернуться назад
          </button>
        </div>

        {/* Mascot bottom-right */}
        <div className="self-end mr-4 md:mr-16">
          <MascotPlaceholder pose="pointing-left" size={180} />
        </div>

      </div>
    </PageTransition>
  );
};

// 4. SOCIALS PAGE
const SocialsPage: React.FC = () => {
  const navigate = useNavigate();

  // Top-left and bottom-right clouds
  return (
    <PageTransition>
      <AnimatedCloud className="absolute top-8 left-8 hidden md:block" size={130} delay={0.5} />
      <AnimatedCloud className="absolute bottom-8 right-8 hidden md:block" size={130} delay={2.5} />

      <div className="max-w-4xl w-full h-[550px] relative flex flex-col justify-between p-6">
        
        {/* CORNER SOCIALS */}
        
        {/* Top-Left: VK */}
        <div className="absolute top-4 left-4 bg-wine-dark/60 border-2 border-gummy/30 rounded-2xl p-4 w-44 shadow-lg text-center">
          <h3 className="font-bold text-white text-base mb-2">ВКонтакте</h3>
          <a
            id="social-vk-btn"
            href="https://vk.com/gummy_wine"
            target="_blank"
            rel="noreferrer"
            className="w-full inline-block bg-gummy text-wine text-xs font-bold py-2 rounded-xl hover:bg-white transition-all"
          >
            Перейти
          </a>
        </div>

        {/* Top-Right: Instagram */}
        <div className="absolute top-4 right-4 bg-wine-dark/60 border-2 border-gummy/30 rounded-2xl p-4 w-44 shadow-lg text-center">
          <h3 className="font-bold text-white text-base mb-2">Instagramm *</h3>
          <a
            id="social-inst-btn"
            href="https://instagram.com/gummy_wine"
            target="_blank"
            rel="noreferrer"
            className="w-full inline-block bg-gummy text-wine text-xs font-bold py-2 rounded-xl hover:bg-white transition-all"
          >
            Перейти
          </a>
        </div>

        {/* Bottom-Left: TikTok */}
        <div className="absolute bottom-4 left-4 bg-wine-dark/60 border-2 border-gummy/30 rounded-2xl p-4 w-44 shadow-lg text-center">
          <h3 className="font-bold text-white text-base mb-2">TikTok</h3>
          <a
            id="social-tiktok-btn"
            href="https://tiktok.com/@gummy_wine"
            target="_blank"
            rel="noreferrer"
            className="w-full inline-block bg-gummy text-wine text-xs font-bold py-2 rounded-xl hover:bg-white transition-all"
          >
            Перейти
          </a>
        </div>

        {/* Bottom-Right: TGK (Telegram Channel) */}
        <div className="absolute bottom-4 right-4 bg-wine-dark/60 border-2 border-gummy/30 rounded-2xl p-4 w-44 shadow-lg text-center">
          <h3 className="font-bold text-white text-base mb-2">Телеграм</h3>
          <a
            id="social-tgk-btn"
            href="https://t.me/gummy_wine_channel"
            target="_blank"
            rel="noreferrer"
            className="w-full inline-block bg-gummy text-wine text-xs font-bold py-2 rounded-xl hover:bg-white transition-all"
          >
            Перейти
          </a>
        </div>

        {/* CENTER BLOCK: НАШ ЧАТ */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-wine-dark/80 border-4 border-gummy rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl z-20">
          <Sparkles className="mx-auto text-gummy mb-3 animate-pulse" size={28} />
          <h2 className="font-display font-bold text-white text-xl md:text-2xl mb-2">НАШ ЧАТ</h2>
          <p className="text-xs text-gummy/70 mb-6 leading-relaxed">
            Присоединяйтесь к теплому сообществу единомышленников, делитесь идеями и общайтесь с администрацией!
          </p>
          
          <div className="flex flex-col gap-3">
            <a
              id="social-chat-btn"
              href="https://t.me/gummy_wine_chat"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 rounded-xl bg-gummy text-wine font-bold text-sm hover:bg-white transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              Перейти в чат <ExternalLink size={14} />
            </a>
            
            <button
              id="socials-back-btn"
              onClick={() => navigate('/info')}
              className="w-full py-2.5 rounded-xl bg-transparent border border-gummy/30 text-gummy/60 hover:text-gummy text-xs font-semibold transition-all"
            >
              Вернуться назад
            </button>
          </div>
        </div>

      </div>
    </PageTransition>
  );
};

// 5. ADMINS OVERVIEW PAGE
interface AdminsOverviewPageProps {
  admins: Admin[];
}
const AdminsOverviewPage: React.FC<AdminsOverviewPageProps> = ({ admins }) => {
  const navigate = useNavigate();
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  return (
    <PageTransition>
      <div className="max-w-5xl w-full flex flex-col gap-6 relative">
        <div className="flex justify-between items-center pb-4 border-b-2 border-gummy/20">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white">Администрация проекта</h2>
            <p className="text-xs text-gummy/70 mt-1">Ознакомьтесь с нашей творческой командой!</p>
          </div>
          <button
            id="admins-back-btn"
            onClick={() => navigate('/info')}
            className="px-4 py-2 bg-gummy text-wine font-bold rounded-xl text-xs hover:bg-white transition-all shadow"
          >
            Назад на главную
          </button>
        </div>

        {/* Admins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.length === 0 ? (
            <p className="text-sm text-gummy/50 col-span-full text-center py-12">Команда настраивается...</p>
          ) : (
            admins.map((adm) => (
              <div key={adm.id} className="bg-wine-dark/40 border-2 border-gummy/30 rounded-2xl p-5 flex flex-col items-center text-center gap-4 shadow-lg hover:border-gummy transition-all relative group">
                <div className="absolute top-3 right-3 bg-wine-dark/80 px-2.5 py-0.5 rounded-full border border-gummy/20 text-[10px] font-mono text-gummy">
                  {adm.role}
                </div>

                <img
                  src={adm.photoUrl}
                  alt={adm.nickname}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gummy shadow-md group-hover:scale-105 transition-all mt-2"
                />

                <div>
                  <h3 className="font-display font-bold text-white text-lg">{adm.nickname}</h3>
                  <p className="text-xs text-gummy/60 mt-0.5">{adm.role}</p>
                </div>

                <button
                  id={`learn-more-btn-${adm.id}`}
                  onClick={() => setSelectedAdmin(adm)}
                  className="w-full bg-gummy text-wine text-xs font-bold py-2.5 rounded-xl hover:bg-white hover:scale-[1.02] transition-all"
                >
                  Ознакомиться
                </button>
              </div>
            ))
          )}
        </div>

        {/* Mascot pointing from bottom-right corner */}
        <div className="self-end mr-8 mt-4">
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
                className="bg-wine-dark border-4 border-gummy rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
              >
                {/* Cloud decor in top right of modal */}
                <AnimatedCloud className="absolute -top-6 -right-6 opacity-30 pointer-events-none" size={100} />

                <div className="flex flex-col gap-5 mt-2">
                  <div className="flex gap-4 items-center">
                    <img
                      src={selectedAdmin.photoUrl}
                      alt={selectedAdmin.nickname}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gummy"
                    />
                    <div>
                      <h3 className="font-display font-bold text-white text-xl">{selectedAdmin.nickname}</h3>
                      <span className="text-xs bg-wine/60 border border-gummy/20 px-2.5 py-0.5 rounded-full text-gummy font-semibold inline-block mt-0.5">
                        {selectedAdmin.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gummy/60 font-bold uppercase">О себе</span>
                    <p className="text-sm text-gummy-light bg-wine/30 border border-gummy/10 p-3.5 rounded-xl whitespace-pre-wrap leading-relaxed">
                      {selectedAdmin.aboutMe || 'Информация уточняется...'}
                    </p>
                  </div>

                  {selectedAdmin.hobbies && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-gummy/60 font-bold uppercase">Увлечения & Хобби</span>
                      <p className="text-sm text-white font-medium">{selectedAdmin.hobbies}</p>
                    </div>
                  )}

                  {/* Attached Music Playback */}
                  {selectedAdmin.musicUrl && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-gummy/60 font-bold uppercase">Любимый трек / Вайб</span>
                      <MusicPlayer url={selectedAdmin.musicUrl} title={`Любимый вайб: ${selectedAdmin.nickname}`} />
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      id="modal-write-take-btn"
                      onClick={() => {
                        setSelectedAdmin(null);
                        navigate('/take', { state: { selectedAdminId: selectedAdmin.id } });
                      }}
                      className="flex-1 bg-gummy text-wine font-bold text-xs py-3 rounded-xl hover:bg-white transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={14} /> Написать тейк
                    </button>
                    
                    <button
                      id="modal-close-btn"
                      onClick={() => setSelectedAdmin(null)}
                      className="px-5 bg-transparent border border-gummy/30 hover:border-gummy text-gummy text-xs font-bold rounded-xl transition-all"
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
      <div className="max-w-3xl w-full flex flex-col gap-6 relative">
        {/* Animated small cloud in top-right */}
        <AnimatedCloud className="absolute top-2 right-2 hidden sm:block" size={90} />

        <div className="bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-xl relative z-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-6 border-b border-gummy/20 pb-3">
            Правила проекта
          </h2>

          <div className="flex flex-col gap-5 text-sm md:text-base leading-relaxed text-gummy-light">
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-gummy text-wine font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-white">Минимум нецензурной лексики.</strong>
                <p className="text-xs text-gummy/70 mt-1">Мы ценим вежливое и комфортное общение. Избегайте чрезмерного мата и ругани.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-gummy text-wine font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-white">Никакой травли и деанонимизации.</strong>
                <p className="text-xs text-gummy/70 mt-1">Анонимность авторов тейков защищена на 100%. Публичное оскорбление или попытки раскрытия личных данных строго запрещены.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-gummy text-wine font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-white">Уважение к труду команды.</strong>
                <p className="text-xs text-gummy/70 mt-1">Наши администраторы обрабатывают ваши тейки добровольно. Относитесь к ним с теплом!</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-gummy text-wine font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-white">Только честные обсуждения.</strong>
                <p className="text-xs text-gummy/70 mt-1">Присылайте только достоверные сплетни или личное мнение, не вводите участников в заблуждение.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              id="rules-back-btn"
              onClick={() => navigate('/info')}
              className="bg-gummy text-wine font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Вернуться назад
            </button>
            <button
              id="rules-write-take-btn"
              onClick={() => navigate('/take')}
              className="bg-transparent border border-gummy hover:bg-gummy hover:text-wine text-gummy font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
            >
              Перейти к тейкам
            </button>
          </div>
        </div>

        {/* Mascot in bottom-left */}
        <div className="self-start ml-4 mt-2">
          <MascotPlaceholder pose="pointing-right" size={140} />
        </div>

      </div>
    </PageTransition>
  );
};

// 7. TAKE SUBMISSION PAGE
interface TakeSubmissionPageProps {
  admins: Admin[];
}
const TakeSubmissionPage: React.FC<TakeSubmissionPageProps> = ({ admins }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<'take' | 'idea'>('take');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetAdminId, setTargetAdminId] = useState('all');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle pre-selected admin from profile routing
  useEffect(() => {
    if (location.state && location.state.selectedAdminId) {
      setTargetAdminId(location.state.selectedAdminId);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMsg('Пожалуйста, введите текст вашего тейка.');
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
          imageUrl,
          targetAdminId,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setContent('');
        setImageUrl('');
        setTargetAdminId('all');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Ошибка отправки тейка');
      }
    } catch (err) {
      setErrorMsg('Произошла ошибка при соединении с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative">
        
        {/* LEFT COLUMN: MASCOT (cols 4) */}
        <div className="md:col-span-4 flex flex-col items-center gap-3">
          <MascotPlaceholder pose="thinking" size={200} />
          <div className="bg-wine-dark/40 border border-gummy/20 rounded-xl p-3 text-center text-xs max-w-xs text-gummy/80 leading-relaxed">
            Поделитесь важной сплетней или классной идеей! Ваша анонимность полностью защищена.
          </div>
        </div>

        {/* RIGHT COLUMN: MINI-BOARD FOR FORM (cols 8) */}
        <div className="md:col-span-8 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-xl">
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
                Ваш тейк сохранен в системе и передан администраторам. Если потребуется, они начнут анонимное общение с вами!
              </p>
              <button
                id="take-success-new-btn"
                onClick={() => setSuccess(false)}
                className="mt-4 bg-gummy text-wine font-bold text-xs px-6 py-3 rounded-xl hover:bg-white transition-all shadow-md"
              >
                Отправить ещё один
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
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

              {/* Optional Image Attachment */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-gummy/70">Прикрепить картинку (вставьте URL-ссылку)</label>
                <input
                  id="take-image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... (опционально)"
                  className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
                />
              </div>

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
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center justify-center">
        
        {/* Left Mascot */}
        <div className="md:col-span-3 flex justify-center">
          <MascotPlaceholder pose="greeting" size={170} />
        </div>

        {/* Center Panel */}
        <div className="md:col-span-6 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-8 text-center shadow-2xl relative">
          <HelpCircle className="mx-auto text-gummy mb-4" size={32} />
          <h2 className="font-display font-bold text-white text-xl md:text-2xl mb-4 leading-normal">
            Хочешь к нам в команду? Мы хотим тебя видеть!
          </h2>
          <p className="text-xs text-gummy/70 mb-8 leading-relaxed max-w-sm mx-auto">
            Наша команда постоянно расширяется. Если вы хотите внести свой вклад, развивать канал, модерировать или рисовать для нас — заполните небольшую анкету, и мы обязательно свяжемся с вами!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="anketa-fill-btn"
              onClick={() => navigate('/survey')}
              className="px-6 py-3 rounded-xl bg-gummy text-wine font-bold text-xs hover:bg-white transition-all shadow-md"
            >
              Заполнить анкету
            </button>
            <button
              id="anketa-back-btn"
              onClick={() => navigate('/info')}
              className="px-6 py-3 rounded-xl bg-transparent border border-gummy/30 hover:border-gummy text-gummy text-xs font-semibold transition-all"
            >
              Назад
            </button>
          </div>
        </div>

        {/* Right Mascot */}
        <div className="md:col-span-3 flex justify-center">
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !sphere || !age || !roleInterest || !helpDescription) {
      setErrorMsg('Пожалуйста, ответьте на все вопросы анкеты.');
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
        }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Произошла ошибка при сохранении заявки.');
      }
    } catch (err) {
      setErrorMsg('Сбой подключения к серверу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-3xl w-full bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="border-b border-gummy/20 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white">Анкета кандидата</h2>
            <p className="text-xs text-gummy/60 mt-0.5">Помогите нам узнать о вас поближе</p>
          </div>
          <button
            id="survey-back-btn"
            onClick={() => navigate('/anketa')}
            className="text-xs text-gummy/60 hover:text-gummy underline font-mono"
          >
            назад
          </button>
        </div>

        {success ? (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gummy text-wine flex items-center justify-center shadow-lg">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="font-display font-bold text-xl text-white">Анкета успешно принята!</h3>
            <p className="text-xs text-gummy/80 max-w-sm leading-relaxed mx-auto">
              Ваша заявка направлена Главному Владельцу канала. Мы изучим её и напишем вам, если ваша кандидатура подойдёт. Спасибо за интерес!
            </p>
            <button
              id="survey-success-back"
              onClick={() => navigate('/info')}
              className="mt-6 bg-gummy text-wine font-bold text-xs px-6 py-3 rounded-xl hover:bg-white transition-all shadow-md"
            >
              Вернуться на главную
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errorMsg && (
              <div className="bg-red-950/60 border border-red-500/50 p-3.5 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            {/* Q1 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gummy">1. Откуда вы узнали о нашем проекте? *</label>
              <input
                id="q-source"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Из Телеграма, от друзей, реклама в пабликах..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q2 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gummy">2. Из какой вы сферы деятельности? *</label>
              <input
                id="q-sphere"
                type="text"
                value={sphere}
                onChange={(e) => setSphere(e.target.value)}
                placeholder="Рисование, дизайн, модерация, кодинг..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q3 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gummy">3. Сколько вам лет? *</label>
              <input
                id="q-age"
                type="number"
                min={5}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Например: 18"
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q4 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gummy">4. Чем конкретно вы хотите заниматься в проекте? *</label>
              <input
                id="q-role"
                type="text"
                value={roleInterest}
                onChange={(e) => setRoleInterest(e.target.value)}
                placeholder="Вести посты, модерировать чат, рисовать арты..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy"
                required
              />
            </div>

            {/* Q5 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gummy">5. Как именно вы готовы помочь развивать проект? *</label>
              <textarea
                id="q-help"
                value={helpDescription}
                onChange={(e) => setHelpDescription(e.target.value)}
                rows={3}
                placeholder="Опишите ваши навыки, предыдущий опыт или классные идеи для продвижения..."
                className="bg-wine border-2 border-gummy/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-gummy resize-none"
                required
              />
            </div>

            <button
              id="survey-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-4 bg-gummy text-wine font-bold text-xs py-3.5 rounded-xl hover:bg-white transition-all shadow-md"
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
const UnionsPage: React.FC<UnionsPageProps> = ({ unions }) => {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center justify-center">
        
        {/* Left Mascot */}
        <div className="md:col-span-3 flex justify-center">
          <MascotPlaceholder pose="greeting" size={170} />
        </div>

        {/* Center content */}
        <div className="md:col-span-6 bg-wine-dark/50 border-4 border-gummy rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col gap-6">
          <div className="border-b border-gummy/20 pb-3 mb-1 text-center">
            <h2 className="font-display font-bold text-white text-xl md:text-2xl">Наши союзы</h2>
            <p className="text-xs text-gummy/50 mt-0.5 font-mono">Wine Mascot Alliance & Partners</p>
          </div>

          <div className="flex flex-col gap-4">
            {unions.length === 0 ? (
              <p className="text-xs text-gummy/50 text-center py-6">Партнёрские союзы настраиваются...</p>
            ) : (
              unions.map((union) => (
                <div key={union.id} className="bg-wine border border-gummy/20 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white text-base">{union.name}</h3>
                    <a
                      href={union.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gummy hover:underline flex items-center gap-1"
                    >
                      Ресурс <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="text-xs text-gummy-light leading-relaxed whitespace-pre-wrap">{union.description}</p>
                </div>
              ))
            )}
          </div>

          <button
            id="unions-back-btn"
            onClick={() => navigate('/info')}
            className="w-full py-3 bg-gummy text-wine font-bold text-xs rounded-xl hover:bg-white transition-all shadow-md"
          >
            Вернуться на главную
          </button>
        </div>

        {/* Right Mascot */}
        <div className="md:col-span-3 flex justify-center">
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
