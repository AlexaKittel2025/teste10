import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

interface SystemStatus {
  uptime: number;
  timestamp: number;
  serverTime: string;
  nodeVersion: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  systemResources: {
    totalMemory: number;
    freeMemory: number;
    cpus: number;
    loadAverage: number[];
  };
  maintenance: {
    enabled: boolean;
    plannedEndTime: string;
    title: string;
    message: string;
  };
  environment: string;
}

export default function SystemStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateInterval, setUpdateInterval] = useState(10); // segundos
  const [token, setToken] = useState('');
  
  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    
    // Carregar token do localStorage
    const savedToken = localStorage.getItem('admin-api-token') || '';
    setToken(savedToken);
    
    // Carregar status inicial
    fetchSystemStatus(savedToken);
    
    // Configurar atualização periódica
    const intervalId = setInterval(() => {
      fetchSystemStatus(savedToken);
    }, updateInterval * 1000);
    
    // Limpar intervalo ao desmontar
    return () => clearInterval(intervalId);
  }, [session, status, updateInterval]);
  
  const fetchSystemStatus = async (authToken: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
        setError(null);
      } else {
        setError('Erro ao carregar status do sistema');
      }
    } catch (err) {
      console.error('Erro ao obter status do sistema:', err);
      setError('Erro ao comunicar com o servidor');
    } finally {
      setLoading(false);
    }
  };
  
  // Função auxiliar para formatar bytes em unidades legíveis
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Função para formatar tempo de atividade
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };
  
  // Calcular porcentagem de uso de memória
  const getMemoryUsagePercent = () => {
    if (!systemStatus) return 0;
    
    const used = systemStatus.systemResources.totalMemory - systemStatus.systemResources.freeMemory;
    return Math.round((used / systemStatus.systemResources.totalMemory) * 100);
  };
  
  // Função para definir cor com base na carga
  const getLoadColor = (loadAvg: number) => {
    const cpus = systemStatus?.systemResources.cpus || 1;
    const normalizedLoad = loadAvg / cpus;
    
    if (normalizedLoad < 0.5) return 'bg-green-500';
    if (normalizedLoad < 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  if (status === 'loading' || loading && !systemStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-2xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <Head>
        <title>Status do Sistema | Painel Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
            Status do Sistema
          </h1>
          
          <Link href="/admin" legacyBehavior>
            <a className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm">
              ← Voltar ao Painel
            </a>
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-400">
            Última atualização: {systemStatus ? new Date(systemStatus.timestamp).toLocaleString() : 'N/A'}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">Atualizar a cada:</span>
            <select 
              value={updateInterval}
              onChange={(e) => setUpdateInterval(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
            </select>
            
            <button 
              onClick={() => fetchSystemStatus(token)}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              Atualizar Agora
            </button>
          </div>
        </div>
        
        {systemStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Informações básicas */}
            <div className="bg-gray-800 rounded-lg shadow p-5 col-span-1">
              <h2 className="text-xl font-semibold mb-4">Informações do Servidor</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Ambiente</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${systemStatus.environment === 'production' ? 'bg-purple-500' : 'bg-yellow-500'}`}></div>
                    <div className="font-medium">
                      {systemStatus.environment === 'production' ? 'Produção' : 'Desenvolvimento'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">Tempo Ativo</div>
                  <div className="font-medium">{formatUptime(systemStatus.uptime)}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">Data/Hora do Servidor</div>
                  <div className="font-medium">{new Date(systemStatus.serverTime).toLocaleString()}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">Versão do Node.js</div>
                  <div className="font-medium">{systemStatus.nodeVersion}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">CPUs Disponíveis</div>
                  <div className="font-medium">{systemStatus.systemResources.cpus}</div>
                </div>
              </div>
            </div>
            
            {/* Status de Manutenção */}
            <div className="bg-gray-800 rounded-lg shadow p-5 col-span-1">
              <h2 className="text-xl font-semibold mb-4">Status de Manutenção</h2>
              
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${systemStatus.maintenance.enabled ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <div className="font-medium">
                    {systemStatus.maintenance.enabled ? 'Em Manutenção' : 'Sistema Online'}
                  </div>
                </div>
              </div>
              
              {systemStatus.maintenance.enabled ? (
                <div className="bg-red-900 bg-opacity-30 border border-red-700 p-4 rounded-lg">
                  <h3 className="text-red-400 font-medium mb-2">{systemStatus.maintenance.title}</h3>
                  <p className="text-sm mb-2">{systemStatus.maintenance.message}</p>
                  
                  {systemStatus.maintenance.plannedEndTime && (
                    <div className="mt-3 text-sm">
                      <span className="text-gray-400">Fim previsto:</span>{' '}
                      <span className="font-medium">
                        {new Date(systemStatus.maintenance.plannedEndTime).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-900 bg-opacity-20 border border-green-700 p-4 rounded-lg">
                  <h3 className="text-green-400 font-medium mb-2">Sistema em Operação Normal</h3>
                  <p className="text-sm">Todos os serviços estão funcionando corretamente.</p>
                </div>
              )}
              
              <div className="mt-6">
                <Link href="/admin/maintenance" legacyBehavior>
                  <a className="inline-block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm">
                    Gerenciar Manutenção
                  </a>
                </Link>
              </div>
            </div>
            
            {/* Uso de Recursos */}
            <div className="bg-gray-800 rounded-lg shadow p-5 col-span-1">
              <h2 className="text-xl font-semibold mb-4">Recursos do Sistema</h2>
              
              <div className="space-y-6">
                {/* Uso de Memória */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-gray-400">Uso de Memória</div>
                    <div className="text-sm font-medium">{getMemoryUsagePercent()}%</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        getMemoryUsagePercent() < 70 ? 'bg-green-500' : 
                        getMemoryUsagePercent() < 90 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} 
                      style={{ width: `${getMemoryUsagePercent()}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <div>Total: {formatBytes(systemStatus.systemResources.totalMemory)}</div>
                    <div>Livre: {formatBytes(systemStatus.systemResources.freeMemory)}</div>
                  </div>
                </div>
                
                {/* Uso de Heap */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-gray-400">Heap Node.js</div>
                    <div className="text-sm font-medium">
                      {Math.round((systemStatus.memoryUsage.heapUsed / systemStatus.memoryUsage.heapTotal) * 100)}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="h-2.5 bg-blue-500 rounded-full" 
                      style={{ width: `${(systemStatus.memoryUsage.heapUsed / systemStatus.memoryUsage.heapTotal) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <div>Usado: {formatBytes(systemStatus.memoryUsage.heapUsed)}</div>
                    <div>Total: {formatBytes(systemStatus.memoryUsage.heapTotal)}</div>
                  </div>
                </div>
                
                {/* Carga do Sistema */}
                <div>
                  <div className="text-sm text-gray-400 mb-2">Carga do Sistema (1m, 5m, 15m)</div>
                  <div className="flex gap-2">
                    {systemStatus.systemResources.loadAverage.map((load, index) => (
                      <div key={index} className="flex-1 bg-gray-700 rounded p-2 text-center">
                        <div className={`text-xl font-bold ${
                          load / systemStatus.systemResources.cpus < 0.5 ? 'text-green-400' :
                          load / systemStatus.systemResources.cpus < 0.8 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {load.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {index === 0 ? '1m' : index === 1 ? '5m' : '15m'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detalhes de Memória */}
            <div className="bg-gray-800 rounded-lg shadow p-5 col-span-1 md:col-span-3">
              <h2 className="text-xl font-semibold mb-4">Detalhes de Memória</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">RSS</div>
                  <div className="text-xl font-bold">{formatBytes(systemStatus.memoryUsage.rss)}</div>
                  <div className="text-xs text-gray-400 mt-1">Tamanho total da memória alocada</div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Heap Total</div>
                  <div className="text-xl font-bold">{formatBytes(systemStatus.memoryUsage.heapTotal)}</div>
                  <div className="text-xs text-gray-400 mt-1">Tamanho total do heap de memória</div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Heap Usado</div>
                  <div className="text-xl font-bold">{formatBytes(systemStatus.memoryUsage.heapUsed)}</div>
                  <div className="text-xs text-gray-400 mt-1">Heap de memória em uso</div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Memória Externa</div>
                  <div className="text-xl font-bold">{formatBytes(systemStatus.memoryUsage.external)}</div>
                  <div className="text-xs text-gray-400 mt-1">Memória usada por objetos externos</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 