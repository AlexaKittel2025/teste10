import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

// Interface para o status de manutenção
interface MaintenanceStatus {
  enabled: boolean;
  plannedEndTime: string;
  title: string;
  message: string;
}

export default function MaintenanceAdmin() {
  const router = useRouter();
  const [status, setStatus] = useState<MaintenanceStatus>({
    enabled: false,
    plannedEndTime: '',
    title: 'Sistema em Manutenção',
    message: 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
  });
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [configInitialized, setConfigInitialized] = useState(true);

  // Carregar status atual ao montar
  useEffect(() => {
    const savedToken = localStorage.getItem('admin-api-token');
    if (savedToken) {
      setAdminToken(savedToken);
      fetchCurrentStatus(savedToken);
    }
  }, []);

  const fetchCurrentStatus = async (token = adminToken) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/maintenance', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
        setConfigInitialized(true);
      } else {
        const errorData = await response.json();
        // Se for erro de arquivo não encontrado, atualizar o estado
        if (errorData.error && errorData.error.includes('não encontrado')) {
          setConfigInitialized(false);
        }
        setError(errorData.error || 'Falha ao obter status de manutenção');
      }
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao comunicar com o servidor');
      setConfigInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  const initializeConfig = async () => {
    try {
      setInitLoading(true);
      setError(null);
      
      const response = await fetch('/api/maintenance/init', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message || 'Configuração inicializada com sucesso');
        setConfigInitialized(true);
        fetchCurrentStatus();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Falha ao inicializar configuração');
      }
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao comunicar com o servidor');
    } finally {
      setInitLoading(false);
    }
  };

  const saveToken = () => {
    localStorage.setItem('admin-api-token', adminToken);
    setSuccess('Token salvo com sucesso');
    setTimeout(() => {
      setSuccess(null);
      fetchCurrentStatus(adminToken);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(status)
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'Configuração salva com sucesso');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Falha ao salvar configuração');
      }
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao comunicar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // Calcular a data-hora mínima para o campo de data
  const getMinDateTime = () => {
    const now = new Date();
    return new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16); // 5 minutos a partir de agora
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>Gerenciar Manutenção | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-2xl font-bold text-center text-gray-900">
                  Controle de Manutenção
                </h1>

                {/* Seção de autenticação de admin */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="Token de Admin"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={saveToken}
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Salvar
                    </button>
                  </div>
                  <p className="text-xs mt-2 text-gray-500">
                    O token deve ser configurado no .env.local como ADMIN_API_TOKEN
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-700">{success}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inicialização da configuração */}
                {!configInitialized && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          Configuração de manutenção não inicializada
                        </p>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={initializeConfig}
                            disabled={initLoading}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                          >
                            {initLoading ? 'Inicializando...' : 'Inicializar Configuração'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {configInitialized && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Status da manutenção */}
                    <div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="enabled"
                          checked={status.enabled}
                          onChange={(e) => setStatus({ ...status, enabled: e.target.checked })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                          Ativar modo de manutenção
                        </label>
                      </div>
                      {status.enabled && (
                        <p className="mt-1 text-sm text-red-500">
                          Atenção: Isso irá bloquear o acesso normal ao sistema!
                        </p>
                      )}
                    </div>

                    {/* Título da manutenção */}
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Título da manutenção
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={status.title}
                        onChange={(e) => setStatus({ ...status, title: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* Mensagem da manutenção */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                        Mensagem da manutenção
                      </label>
                      <textarea
                        id="message"
                        value={status.message}
                        onChange={(e) => setStatus({ ...status, message: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>

                    {/* Data/hora prevista de término */}
                    <div>
                      <label htmlFor="plannedEndTime" className="block text-sm font-medium text-gray-700">
                        Previsão de término (opcional)
                      </label>
                      <input
                        type="datetime-local"
                        id="plannedEndTime"
                        value={status.plannedEndTime}
                        onChange={(e) => setStatus({ ...status, plannedEndTime: e.target.value })}
                        min={getMinDateTime()}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Deixe em branco se não houver previsão definida
                      </p>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => fetchCurrentStatus()}
                        className="flex-1 bg-gray-200 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        disabled={loading}
                      >
                        Resetar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        disabled={loading}
                      >
                        {loading ? 'Salvando...' : 'Salvar Configuração'}
                      </button>
                    </div>
                  </form>
                )}
                
                <div className="text-sm text-center text-gray-500 pt-4">
                  <a 
                    href="/admin" 
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    ← Voltar para o Dashboard Admin
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Proteger página apenas para admins
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  
  // Verificar se o usuário está autenticado e é admin
  if (!session || session.user?.role !== 'admin') {
    return {
      redirect: {
        destination: '/auth/login?callbackUrl=/admin/maintenance',
        permanent: false,
      },
    };
  }
  
  return {
    props: {}
  };
}; 