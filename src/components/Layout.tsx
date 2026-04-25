import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, setupAudioUnlock } from '../lib/notificationSound';
import { LayoutDashboard, Users, GitBranch, FileText, Upload, LogOut, Menu, UserCog, Calendar, BookOpen, MessageCircle, Tag, Layers, TableProperties, AlertTriangle, BarChart2, X, UserPlus, TrendingUp, ShoppingBag } from 'lucide-react';

interface Toast {
  id: number;
  type: 'message' | 'lead';
  title: string;
  body: string;
  leadId?: string;
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [staleLeadsCount, setStaleLeadsCount] = useState(0);
  const [unreadLeads, setUnreadLeads] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('unread_leads');
      const all = saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      // Se já estamos na página de um lead, marca como lido imediatamente
      const match = window.location.pathname.match(/^\/leads\/([^/]+)/);
      if (match) { all.delete(match[1]); localStorage.setItem('unread_leads', JSON.stringify([...all])); }
      return all;
    } catch { return new Set<string>(); }
  });
  const [newLeads, setNewLeads] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const currentPathRef = useRef(window.location.pathname);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markLeadRead = useCallback((leadId: string) => {
    setUnreadLeads((prev) => {
      const s = new Set(prev);
      s.delete(leadId);
      localStorage.setItem('unread_leads', JSON.stringify([...s]));
      return s;
    });
  }, []);

  // Validar unreadLeads contra o DB para remover IDs de leads deletados
  useEffect(() => {
    if (unreadLeads.size === 0) return;
    const ids = [...unreadLeads];
    supabase.from('leads').select('id').in('id', ids).then(({ data }) => {
      const existing = new Set((data || []).map((r: any) => r.id));
      const valid = new Set(ids.filter((id) => existing.has(id)));
      if (valid.size !== unreadLeads.size) {
        localStorage.setItem('unread_leads', JSON.stringify([...valid]));
        setUnreadLeads(valid);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchStale = async () => {
      const { data } = await supabase.from('vw_stale_strategic_leads').select('lead_id');
      setStaleLeadsCount(data?.length ?? 0);
    };
    fetchStale();
    const interval = setInterval(fetchStale, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setupAudioUnlock();

    const uid = Math.random().toString(36).slice(2);

    const msgChannel = supabase
      .channel(`global_new_messages_${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          if (payload.new?.direction === 'inbound') {
            const leadId = payload.new.lead_id as string | null;
            const onLeadChat = leadId && currentPathRef.current.includes(`/leads/${leadId}`);
            if (!onLeadChat) {
              playNotificationSound('message');
              if (leadId) {
                setUnreadLeads((prev) => {
                  const s = new Set([...prev, leadId]);
                  localStorage.setItem('unread_leads', JSON.stringify([...s]));
                  return s;
                });
              }
              addToast({
                type: 'message',
                title: 'Nova mensagem',
                body: payload.new.content || 'Mensagem recebida',
                ...(leadId ? { leadId } : {}),
              });
            }
          }
        }
      )
      .subscribe(() => {});

    const leadChannel = supabase
      .channel(`global_new_leads_${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.new?.source === 'whatsapp') {
            playNotificationSound('lead');
            setNewLeads((n) => n + 1);
            addToast({
              type: 'lead',
              title: 'Novo lead via WhatsApp',
              body: payload.new.full_name || payload.new.phone || 'Novo contato',
              leadId: payload.new.id,
            });
          }
        }
      )
      .subscribe(() => {});

    const updatePath = () => {
      const path = window.location.pathname;
      currentPathRef.current = path;
      const match = path.match(/^\/leads\/([^/]+)/);
      if (match) markLeadRead(match[1]);
    };
    const onLeadRead = (e: Event) => markLeadRead((e as CustomEvent).detail.leadId);

    window.addEventListener('popstate', updatePath);
    window.addEventListener('lead:read', onLeadRead);

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(leadChannel);
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('lead:read', onLeadRead);
    };
  }, [addToast, markLeadRead]);

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
    { href: '/marketing', icon: TrendingUp, label: 'Marketing' },
    { href: '/base-clientes', icon: ShoppingBag, label: 'Base de Clientes' },
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
                <div>
                  <h1 className="font-bold text-lg">Fábrica de Líderes</h1>
                  <p className="text-xs text-slate-400">CRM</p>
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
            const isConversas = item.href === '/whatsapp-conversations';

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isLeads) setNewLeads(0);
                }}
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
                {isLeads && newLeads > 0 && (
                  <span className={`${staleLeadsCount > 0 ? 'ml-1' : 'ml-auto'} bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center`}>
                    {newLeads > 9 ? '9+' : newLeads}
                  </span>
                )}
                {isConversas && unreadLeads.size > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadLeads.size > 9 ? '9+' : unreadLeads.size}
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

      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm max-w-xs w-full cursor-pointer ${
              toast.type === 'lead' ? 'bg-green-600' : 'bg-blue-600'
            }`}
            onClick={() => {
              if (toast.leadId) {
                markLeadRead(toast.leadId);
                window.location.href = `/leads/${toast.leadId}?tab=whatsapp`;
              }
              removeToast(toast.id);
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'lead' ? <UserPlus className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">{toast.title}</p>
              <p className="text-white/80 text-xs mt-0.5 truncate">{toast.body}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
              className="flex-shrink-0 text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
