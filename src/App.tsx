import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LeadsList = lazy(() => import('./pages/LeadsList'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const ImportLeads = lazy(() => import('./pages/ImportLeads'));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'));
const Users = lazy(() => import('./pages/Users'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Instructions = lazy(() => import('./pages/Instructions'));
const WhatsAppSettings = lazy(() => import('./pages/WhatsAppSettings'));
const WhatsAppConversations = lazy(() => import('./pages/WhatsAppConversations'));
const Tags = lazy(() => import('./pages/Tags'));
const Stages = lazy(() => import('./pages/Stages'));
const CustomFields = lazy(() => import('./pages/CustomFields'));
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'));
const MarketingDashboard = lazy(() => import('./pages/MarketingDashboard'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Carregando...</span>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function Router() {
  const path = window.location.pathname;

  if (path === '/') return <Dashboard />;
  if (path === '/leads') return <LeadsList />;
  if (path.startsWith('/leads/') && path !== '/leads/import') {
    return <LeadDetail />;
  }
  if (path === '/leads/import') return <ImportLeads />;
  if (path === '/pipeline') return <Pipeline />;
  if (path === '/agenda') return <Agenda />;
  if (path === '/tags') return <Tags />;
  if (path === '/stages') return <Stages />;
  if (path === '/instructions') return <Instructions />;
  if (path === '/report') return <WeeklyReport />;
  if (path === '/whatsapp-settings') return <WhatsAppSettings />;
  if (path === '/whatsapp-conversations' || path.startsWith('/whatsapp-conversations?')) return <WhatsAppConversations />;
  if (path === '/custom-fields') return <CustomFields />;
  if (path === '/users') return <Users />;
  if (path === '/attendance-report') return <AttendanceReport />;
  if (path === '/marketing') return <MarketingDashboard />;

  return <Dashboard />;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Router />
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster 
        position="top-right"
        richColors
        closeButton
      />
    </QueryClientProvider>
  );
}

export default App;
