/**
 * Sistema de registro de módulos para arquitetura modular
 * Permite que o código seja organizado em módulos independentes e plugáveis
 */

// Tipos de dados para os módulos
export type ModuleStatus = 'registered' | 'initializing' | 'active' | 'error' | 'disabled';

// Interface para definição de um módulo
export interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  dependencies?: string[];
  initialize: () => Promise<void>;
  shutdown?: () => Promise<void>;
  status: ModuleStatus;
  errorMessage?: string;
  exports?: Record<string, any>;
}

// Registro de módulos
class ModuleRegistry {
  private modules: Map<string, Module> = new Map();
  private initializedModules: Set<string> = new Set();
  private isInitializing: boolean = false;
  
  /**
   * Registra um novo módulo no sistema
   */
  register(module: Omit<Module, 'status'>): void {
    if (this.modules.has(module.id)) {
      console.warn(`Módulo ${module.id} já está registrado. Ignorando.`);
      return;
    }
    
    this.modules.set(module.id, {
      ...module,
      status: 'registered'
    });
    
    console.log(`Módulo registrado: ${module.name} (${module.id}) v${module.version}`);
  }
  
  /**
   * Inicializa um módulo específico e suas dependências
   */
  async initializeModule(moduleId: string): Promise<void> {
    // Verificar se o módulo existe
    const moduleInstance = this.modules.get(moduleId);
    if (!moduleInstance) {
      throw new Error(`Módulo não encontrado: ${moduleId}`);
    }
    
    // Verificar se já está inicializado
    if (this.initializedModules.has(moduleId)) {
      return;
    }
    
    // Inicializar dependências primeiro
    if (moduleInstance.dependencies && moduleInstance.dependencies.length > 0) {
      for (const depId of moduleInstance.dependencies) {
        // Verificar dependência circular
        if (depId === moduleId) {
          moduleInstance.status = 'error';
          moduleInstance.errorMessage = 'Dependência circular detectada';
          throw new Error(`Dependência circular detectada no módulo ${moduleId}`);
        }
        
        // Verificar se a dependência existe
        if (!this.modules.has(depId)) {
          moduleInstance.status = 'error';
          moduleInstance.errorMessage = `Dependência não encontrada: ${depId}`;
          throw new Error(`Módulo ${moduleId} depende de ${depId}, mas este não está registrado`);
        }
        
        // Inicializar dependência
        await this.initializeModule(depId);
      }
    }
    
    // Inicializar o módulo
    try {
      moduleInstance.status = 'initializing';
      await moduleInstance.initialize();
      moduleInstance.status = 'active';
      this.initializedModules.add(moduleId);
      console.log(`Módulo inicializado: ${moduleInstance.name} (${moduleInstance.id})`);
    } catch (error) {
      moduleInstance.status = 'error';
      moduleInstance.errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Erro ao inicializar módulo ${moduleInstance.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Inicializa todos os módulos registrados em ordem de dependência
   */
  async initializeAll(): Promise<void> {
    if (this.isInitializing) {
      console.warn('Já existe uma inicialização em andamento.');
      return;
    }
    
    this.isInitializing = true;
    
    try {
      // Criar uma lista de módulos ordenados por dependências
      const sortedModules = this.getModulesInDependencyOrder();
      
      // Inicializar cada módulo na ordem correta
      for (const moduleId of sortedModules) {
        await this.initializeModule(moduleId);
      }
      
      console.log('Todos os módulos foram inicializados com sucesso.');
    } catch (error) {
      console.error('Erro durante a inicialização dos módulos:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }
  
  /**
   * Ordena módulos considerando suas dependências
   */
  private getModulesInDependencyOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    // Função recursiva para percorrer o grafo de dependências
    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return;
      visited.add(moduleId);
      
      const moduleInstance = this.modules.get(moduleId);
      if (!moduleInstance) return;
      
      // Visitar dependências primeiro
      if (moduleInstance.dependencies) {
        for (const depId of moduleInstance.dependencies) {
          if (this.modules.has(depId)) {
            visit(depId);
          }
        }
      }
      
      // Adicionar módulo após suas dependências
      result.push(moduleId);
    };
    
    // Visitar todos os módulos - usando Array.from() para compatibilidade
    Array.from(this.modules.keys()).forEach(moduleId => {
      visit(moduleId);
    });
    
    return result;
  }
  
  /**
   * Desativa e finaliza um módulo específico
   */
  async shutdownModule(moduleId: string): Promise<void> {
    const moduleInstance = this.modules.get(moduleId);
    if (!moduleInstance) {
      throw new Error(`Módulo não encontrado: ${moduleId}`);
    }
    
    // Verificar se o módulo está ativo
    if (moduleInstance.status !== 'active') {
      console.warn(`Módulo ${moduleId} não está ativo (status: ${moduleInstance.status})`);
      return;
    }
    
    // Verificar se algum outro módulo depende deste
    const dependentModules = Array.from(this.modules.values())
      .filter(m => 
        m.dependencies?.includes(moduleId) && 
        m.status === 'active'
      );
    
    if (dependentModules.length > 0) {
      const moduleIds = dependentModules.map(m => m.id).join(', ');
      throw new Error(
        `Não é possível desativar o módulo ${moduleId} pois outros módulos dependem dele: ${moduleIds}`
      );
    }
    
    // Executar shutdown se disponível
    if (moduleInstance.shutdown) {
      try {
        await moduleInstance.shutdown();
      } catch (error) {
        console.error(`Erro ao finalizar módulo ${moduleId}:`, error);
      }
    }
    
    // Atualizar status
    moduleInstance.status = 'disabled';
    this.initializedModules.delete(moduleId);
    console.log(`Módulo desativado: ${moduleInstance.name} (${moduleInstance.id})`);
  }
  
  /**
   * Finaliza todos os módulos na ordem inversa de inicialização
   */
  async shutdownAll(): Promise<void> {
    // Ordenar módulos na ordem inversa de dependências
    const moduleIds = this.getModulesInDependencyOrder().reverse();
    
    for (const moduleId of moduleIds) {
      if (this.initializedModules.has(moduleId)) {
        await this.shutdownModule(moduleId);
      }
    }
    
    console.log('Todos os módulos foram finalizados.');
  }
  
  /**
   * Obtém um módulo pelo ID
   */
  getModule(moduleId: string): Module | undefined {
    return this.modules.get(moduleId);
  }
  
  /**
   * Obtém um serviço exportado por um módulo
   */
  getService<T = any>(moduleId: string, serviceName: string): T | undefined {
    const moduleInstance = this.modules.get(moduleId);
    if (!moduleInstance || moduleInstance.status !== 'active') {
      return undefined;
    }
    
    return moduleInstance.exports?.[serviceName] as T;
  }
  
  /**
   * Retorna todos os módulos registrados
   */
  getAllModules(): Module[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Retorna estatísticas sobre os módulos
   */
  getStats() {
    const modules = this.getAllModules();
    
    return {
      total: modules.length,
      active: modules.filter(m => m.status === 'active').length,
      error: modules.filter(m => m.status === 'error').length,
      initializing: modules.filter(m => m.status === 'initializing').length,
      registered: modules.filter(m => m.status === 'registered').length,
      disabled: modules.filter(m => m.status === 'disabled').length,
    };
  }
}

// Instância global do registro de módulos
export const moduleRegistry = new ModuleRegistry();

// Exemplo de uso:
// moduleRegistry.register({
//   id: 'auth',
//   name: 'Authentication',
//   description: 'Sistema de autenticação',
//   version: '1.0.0',
//   initialize: async () => {
//     // Lógica de inicialização
//   },
//   exports: {
//     validateToken: (token: string) => {
//       // Implementação
//       return true;
//     }
//   }
// });

// Funções auxiliares para facilitar o uso
export const registerModule = (module: Omit<Module, 'status'>) => 
  moduleRegistry.register(module);

export const initializeModules = () => 
  moduleRegistry.initializeAll();

export const getService = <T = any>(moduleId: string, serviceName: string): T | undefined =>
  moduleRegistry.getService<T>(moduleId, serviceName); 