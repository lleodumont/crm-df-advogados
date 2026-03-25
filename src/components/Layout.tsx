import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Scale, LayoutDashboard, Users, GitBranch, FileText, Upload, LogOut, Menu, UserCog, Calendar, BookOpen, MessageCircle, Tag, Layers, TableProperties, AlertTriangle, BarChart2 } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [staleLeadsCount, setStaleLeadsCount] = useState(0);

  useEffect(() => {
    const fetchStale = async () => {
      const { data } = await supabase.from('vw_stale_strategic_leads').select('lead_id');
      setStaleLeadsCount(data?.length ?? 0);
    };
    fetchStale();
    const interval = setInterval(fetchStale, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/leads', icon: Users, label: 'Leads' },
    { href: '/whatsapp-conversations', icon: MessageCircle, label: 'Conversas' },
    { href: '/pipeline', icon: GitBranch, label: 'Pipeline' },
    { href: '/agenda', icon: Calendar, label: 'Agenda' },
    { href: '/tags', icon: Tag, label: 'Etiquetas' },
    { href: '/stages', icon: Layers, label: 'Etapas' },
    { href: '/instructions', icon: BookOpen, label: 'Instruções' },
    { href: '/report', icon: FileText, label: 'Relatório Semanal' },
    { href: '/attendance-report', icon: BarChart2, label: 'Atendimentos' },
    { href: '/leads/import', icon: Upload, label: 'Importar Leads' },
    ...(profile?.role === 'admin' || profile?.role === 'manager' ? [{ href: '/whatsapp-settings', icon: MessageCircle, label: 'Config WhatsApp' }] : []),
    ...(profile?.role === 'admin' ? [
      { href: '/custom-fields', icon: TableProperties, label: 'Campos Per.' },
      { href: '/users', icon: UserCog, label: 'Usuários' }
    ] : []),
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
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <Scale className="w-8 h-8" />
                <div>
                  <h1 className="font-bold text-lg">DF CRM</h1>
                  <p className="text-xs text-slate-400">Divórcios</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
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

      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        {staleLeadsCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span><strong>{staleLeadsCount} lead{staleLeadsCount > 1 ? 's' : ''} estratégico{staleLeadsCount > 1 ? 's' : ''}</strong> sem atividade há mais de 24h</span>
            <a href="/leads?stale=true" className="ml-auto text-amber-700 underline font-medium">Ver agora</a>
          </div>
        )}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
