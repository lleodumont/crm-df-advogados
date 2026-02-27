import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, Eye, Phone, Trash2 } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserRole = Database['public']['Tables']['user_profiles']['Row']['role'];

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'atendimento' as UserRole,
  });

  useEffect(() => {
    if (profile?.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    loadUsers();
  }, [profile]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            active: true,
          });

        if (profileError) throw profileError;

        alert('Usuário criado com sucesso!');
        setFormData({ email: '', password: '', full_name: '', role: 'atendimento' });
        setShowForm(false);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert('Erro ao criar usuário: ' + error.message);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
      alert('Role atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Erro ao atualizar role');
    }
  };

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ active: !currentActive })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling user active:', error);
      alert('Erro ao atualizar status');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'comercial':
        return Phone;
      case 'atendimento':
        return UserPlus;
      case 'viewer':
        return Eye;
      default:
        return UserPlus;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'comercial':
        return 'bg-blue-100 text-blue-800';
      case 'atendimento':
        return 'bg-green-100 text-green-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    const labels = {
      admin: 'Administrador',
      comercial: 'Comercial',
      atendimento: 'Atendimento',
      viewer: 'Visualizador',
    };
    return labels[role];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Usuários</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Criar Novo Usuário</h2>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perfil
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="atendimento">Atendimento (SDR)</option>
                  <option value="comercial">Comercial (Advogada/Closer)</option>
                  <option value="viewer">Visualizador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Usuário
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Perfis e Permissões</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Admin:</strong> Acesso completo ao sistema, gerencia usuários</li>
          <li><strong>Comercial:</strong> Visualiza todos os leads, cria propostas, acessa valores</li>
          <li><strong>Atendimento:</strong> Gerencia leads, agenda reuniões, registra atividades</li>
          <li><strong>Visualizador:</strong> Somente leitura, acessa dashboard e relatórios</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perfil
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Criação
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const RoleIcon = getRoleIcon(user.role);

              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name || 'Sem nome'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative group">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        <RoleIcon className="w-4 h-4" />
                        {getRoleLabel(user.role)}
                      </div>
                      <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                        {(['admin', 'comercial', 'atendimento', 'viewer'] as UserRole[]).map((role) => (
                          <button
                            key={role}
                            onClick={() => updateUserRole(user.id, role)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                          >
                            {getRoleLabel(role)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleUserActive(user.id, user.active)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user.id !== profile?.id && (
                      <button
                        onClick={() => toggleUserActive(user.id, user.active)}
                        className="text-gray-600 hover:text-gray-900"
                        title={user.active ? 'Desativar' : 'Ativar'}
                      >
                        {user.active ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">Nenhum usuário encontrado</div>
          </div>
        )}
      </div>
    </div>
  );
}
