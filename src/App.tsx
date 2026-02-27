import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadsList from './pages/LeadsList';
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import ImportLeads from './pages/ImportLeads';
import WeeklyReport from './pages/WeeklyReport';
import Users from './pages/Users';
import Agenda from './pages/Agenda';
import Instructions from './pages/Instructions';
import WhatsAppSettings from './pages/WhatsAppSettings';
import Layout from './components/Layout';

function Router() {
  const path = window.location.pathname;

  if (path === '/') return <Dashboard />;
  if (path === '/leads') return <LeadsList />;
  if (path.startsWith('/leads/') && path !== '/leads/import') {
    const id = path.split('/')[2];
    return <LeadDetail />;
  }
  if (path === '/leads/import') return <ImportLeads />;
  if (path === '/pipeline') return <Pipeline />;
  if (path === '/agenda') return <Agenda />;
  if (path === '/instructions') return <Instructions />;
  if (path === '/report') return <WeeklyReport />;
  if (path === '/whatsapp-settings') return <WhatsAppSettings />;
  if (path === '/users') return <Users />;

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
    return <Login />;
  }

  return (
    <Layout>
      <Router />
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
