import { ReactNode, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Scale, LayoutDashboard, Users, GitBranch, FileText, Upload, LogOut, Menu, UserCog, Calendar, BookOpen, MessageCircle, Tag, Layers, TableProperties, AlertTriangle, BarChart2, LayoutTemplate, Zap } from 'lucide-react';
import { playNewLeadSound } from '../lib/sounds';


interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);  // desktop: wide/narrow
  const [drawerOpen, setDrawerOpen] = useState(false);    // mobile: drawer aberto/fechado
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [staleLeadsCount, setStaleLeadsCount] = useState(0);
  const initialLeadsLoaded = useRef(false);

  useEffect(() => {
    const fetchStale = async () => {
      const { data } = await supabase.from('vw_stale_strategic_leads').select('lead_id');
      setStaleLeadsCount(data?.length ?? 0);
    };
    fetchStale();
    const interval = setInterval(fetchStale, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Notificação sonora de novo lead
  useEffect(() => {
    const channel = supabase
      .channel('layout_new_leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        if (initialLeadsLoaded.current) {
          playNewLeadSound();
        }
      })
      .subscribe();

    // Marca que o carregamento inicial passou após 3s
    const timer = setTimeout(() => { initialLeadsLoaded.current = true; }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timer);
    };
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isComercial = profile?.role === 'comercial';
  const isJuridico = profile?.role === 'juridico';
  const isAtendimento = profile?.role === 'atendimento';

  const navItems = isJuridico
    ? [
        { href: '/juridico', icon: Scale, label: 'Jurídico' },
        { href: '/whatsapp-conversations', icon: MessageCircle, label: 'Conversas' },
      ]
    : [
        ...(isAdmin || isComercial || isAtendimento || profile?.role === 'viewer'
          ? [{ href: '/', icon: LayoutDashboard, label: 'Dashboard' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento || profile?.role === 'viewer'
          ? [{ href: '/leads', icon: Users, label: 'Leads' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/whatsapp-conversations', icon: MessageCircle, label: 'Conversas' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/pipeline', icon: GitBranch, label: 'Pipeline' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/agenda', icon: Calendar, label: 'Agenda' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/tags', icon: Tag, label: 'Etiquetas' }]
          : []),
        ...(isAdmin
          ? [{ href: '/stages', icon: Layers, label: 'Etapas' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/instructions', icon: BookOpen, label: 'Instruções' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/report', icon: FileText, label: 'Relatório Semanal' }]
          : []),
        ...(isAdmin || isComercial || isAtendimento
          ? [{ href: '/attendance-report', icon: BarChart2, label: 'Atendimentos' }]
          : []),
        ...(isAdmin || isComercial
          ? [{ href: '/leads/import', icon: Upload, label: 'Importar Leads' }]
          : []),
        ...(isAdmin
          ? [{ href: '/whatsapp-settings', icon: MessageCircle, label: 'Config WhatsApp' }]
          : []),
        ...(isAdmin
          ? [{ href: '/whatsapp-templates', icon: LayoutTemplate, label: 'Templates WhatsApp' }]
          : []),
        ...(isAdmin
          ? [{ href: '/automations', icon: Zap, label: 'Automações' }]
          : []),
        ...(isAdmin
          ? [{ href: '/custom-fields', icon: TableProperties, label: 'Campos Per.' }]
          : []),
        ...(isAdmin
          ? [{ href: '/users', icon: UserCog, label: 'Usuários' }]
          : []),
      ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Scale className="w-6 h-6" />
          <span className="font-bold text-base">DF Advogados</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──
           Mobile: escondido via style transform, visível só quando drawerOpen=true
           Desktop (md+): sempre visível, largura controlada por sidebarOpen
      ── */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 text-white z-50 transition-all duration-300 ${
          sidebarOpen ? 'md:w-64' : 'md:w-20'
        } w-64`}
        style={{
          transform: isMobile
            ? drawerOpen ? 'translateX(0)' : 'translateX(-100%)'
            : 'translateX(0)',
        }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <Scale className="w-8 h-8" />
                <div>
                  <h1 className="font-bold text-lg">DF Advogados</h1>
                  <p className="text-xs text-slate-400">Funil de vendas</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="hidden md:block p-1 hover:bg-slate-800 rounded transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="md:hidden p-1 hover:bg-slate-800 rounded transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-slate-800 rounded transition-colors mx-auto"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.href;
            const isLeads = item.href === '/leads';

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                {isLeads && staleLeadsCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {staleLeadsCount > 9 ? '9+' : staleLeadsCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          {sidebarOpen ? (
            <div className="mb-3">
              <div className="text-sm font-medium text-white">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-slate-400 capitalize">{profile?.role}</div>
            </div>
          ) : null}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors w-full"
            title={!sidebarOpen ? 'Sair' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main
        className={`transition-all duration-300 pt-16 md:pt-0 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        }`}
      >
        {staleLeadsCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span><strong>{staleLeadsCount} lead{staleLeadsCount > 1 ? 's' : ''} estratégico{staleLeadsCount > 1 ? 's' : ''}</strong> sem atividade há mais de 24h</span>
            <a href="/leads?stale=true" className="ml-auto text-amber-700 underline font-medium whitespace-nowrap">Ver agora</a>
          </div>
        )}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
