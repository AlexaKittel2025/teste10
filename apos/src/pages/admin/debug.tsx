import Link from 'next/link';

export default function DebugIndex() {
  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Ferramentas de Depuração</h1>
        
        <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-8">
          <div className="font-semibold mb-2">⚠️ ATENÇÃO</div>
          <p>
            Estas ferramentas são apenas para depuração e desenvolvimento. Não devem ser usadas em ambientes de produção.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Usuários</h2>
            <div className="space-y-4">
              <Link
                href="/admin/debug-users"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-center"
              >
                Ver Usuários Cadastrados
              </Link>
              
              <Link
                href="/admin/debug-create-admin"
                className="block w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded text-center"
              >
                Criar Usuário Administrador
              </Link>
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Autenticação</h2>
            <div className="space-y-4">
              <Link
                href="/auth/login"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded text-center"
              >
                Página de Login
              </Link>
              
              <Link
                href="/admin/debug-test-login"
                className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-center"
              >
                Testar Autenticação Diretamente
              </Link>
              
              <Link
                href="/auth/login-direct"
                className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded text-center"
              >
                Login Alternativo
              </Link>
              
              <div className="bg-gray-700 p-4 rounded text-sm">
                <div className="mb-2 font-semibold">Credenciais do Administrador:</div>
                <div><span className="text-gray-400">Email:</span> financeiro@pedirsanto.com</div>
                <div><span className="text-gray-400">Senha:</span> sosederbelE@1</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 