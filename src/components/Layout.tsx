import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Scale, LayoutDashboard, Users, GitBranch, FileText, Upload, LogOut, Menu, UserCog, Calendar, BookOpen, MessageCircle } from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/leads', icon: Users, label: 'Leads' },
    { href: '/whatsapp-conversations', icon: MessageCircle, label: 'Conversas' },
    { href: '/pipeline', icon: GitBranch, label: 'Pipeline' },
    { href: '/agenda', icon: Calendar, label: 'Agenda' },
    { href: '/instructions', icon: BookOpen, label: 'Instruções' },
    { href: '/report', icon: FileText, label: 'Relatório Semanal' },
    { href: '/leads/import', icon: Upload, label: 'Importar Leads' },
    ...(profile?.role === 'admin' || profile?.role === 'manager' ? [{ href: '/whatsapp-settings', icon: MessageCircle, label: 'Config WhatsApp' }] : []),
    ...(profile?.role === 'admin' ? [{ href: '/users', icon: UserCog, label: 'Usuários' }] : []),
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
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
