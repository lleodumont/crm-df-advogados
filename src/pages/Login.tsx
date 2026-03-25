import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Scale } from 'lucide-react';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await resetPassword(email);
      setMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
      // Keep isRecovering true so they see the message in that context, 
      // or optionally switch back after a delay.
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar recuperação de senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-xl mb-4">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">DF CRM</h1>
          <p className="text-gray-600 mt-2">Divórcios</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {isRecovering ? 'Recuperar Senha' : 'Entrar'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={isRecovering ? handleResetPassword : handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>

            {!isRecovering && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovering(true);
                      setError('');
                      setMessage('');
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 bg-slate-900 text-white rounded-lg font-medium transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 hover:shadow-lg'
              }`}
            >
              {loading 
                ? (isRecovering ? 'Enviando...' : 'Entrando...') 
                : (isRecovering ? 'Enviar link de recuperação' : 'Entrar')}
            </button>

            {isRecovering && (
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(false);
                  setError('');
                  setMessage('');
                }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-900 font-medium py-2"
              >
                Voltar para o login
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Sistema de gestão comercial para escritório de Direito de Família
        </p>
      </div>
    </div>
  );
}
