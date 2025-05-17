/**
 * Sistema de balanceamento de carga para operações pesadas
 * Permite distribuir processamento entre workers e threads
 */

// Interface para um nó de processamento
interface ProcessingNode {
  id: string;
  capacity: number; // Capacidade relativa (1-10)
  load: number;     // Carga atual (porcentagem 0-100)
  available: boolean;
  lastHeartbeat: number;
}

// Tipos de operações que podem ser distribuídas
type OperationType = 'query' | 'calculation' | 'auth' | 'transaction' | 'gameLogic';

// Função para distribuir entre nós
class LoadBalancer {
  private nodes: Map<string, ProcessingNode> = new Map();
  private operationDistribution: Map<OperationType, string[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Inicializar com um nó local por padrão
    this.registerNode('local', 10);
    
    // Iniciar verificação de saúde dos nós
    this.startHealthCheck();
    
    // Configurar distribuição padrão (todos os tipos vão para o nó local inicialmente)
    const operationTypes: OperationType[] = ['query', 'calculation', 'auth', 'transaction', 'gameLogic'];
    operationTypes.forEach(type => {
      this.operationDistribution.set(type, ['local']);
    });
  }
  
  /**
   * Registra um novo nó para processamento
   */
  registerNode(id: string, capacity: number): void {
    this.nodes.set(id, {
      id,
      capacity,
      load: 0,
      available: true,
      lastHeartbeat: Date.now()
    });
    
    console.log(`[LoadBalancer] Novo nó registrado: ${id} (capacidade ${capacity})`);
    
    // Redistribuir operações para incluir o novo nó
    this.rebalanceOperations();
  }
  
  /**
   * Remove um nó do pool de processamento
   */
  removeNode(id: string): void {
    if (id === 'local') {
      console.warn('[LoadBalancer] Nó local não pode ser removido');
      return;
    }
    
    this.nodes.delete(id);
    console.log(`[LoadBalancer] Nó removido: ${id}`);
    
    // Redistribuir operações para excluir o nó removido
    this.rebalanceOperations();
  }
  
  /**
   * Reporta carga de um nó
   */
  reportLoad(nodeId: string, load: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.load = Math.max(0, Math.min(100, load));
      node.lastHeartbeat = Date.now();
    }
  }
  
  /**
   * Seleciona o melhor nó para uma operação específica
   */
  selectNode(operationType: OperationType): string {
    // Obter lista de nós para este tipo de operação
    const nodes = this.operationDistribution.get(operationType) || ['local'];
    
    // Filtrar apenas nós disponíveis
    const availableNodes = nodes
      .map(id => this.nodes.get(id))
      .filter((node): node is ProcessingNode => 
        node !== undefined && node.available && node.load < 90);
    
    if (availableNodes.length === 0) {
      console.warn(`[LoadBalancer] Nenhum nó disponível para ${operationType}, usando local`);
      return 'local';
    }
    
    // Selecionar nó com menor carga relativa à sua capacidade
    availableNodes.sort((a, b) => {
      const loadFactorA = a.load / a.capacity;
      const loadFactorB = b.load / b.capacity;
      return loadFactorA - loadFactorB;
    });
    
    const selectedNode = availableNodes[0];
    
    // Aumentar a carga do nó selecionado (simulação)
    selectedNode.load += 5;
    if (selectedNode.load > 100) selectedNode.load = 100;
    
    return selectedNode.id;
  }
  
  /**
   * Atualiza a carga de um nó
   */
  updateNodeLoad(nodeId: string, loadDelta: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.load = Math.max(0, Math.min(100, node.load + loadDelta));
    }
  }
  
  /**
   * Redistribui operações entre nós disponíveis
   */
  private rebalanceOperations(): void {
    // Pular se só temos um nó
    if (this.nodes.size <= 1) return;
    
    const nodeIds = Array.from(this.nodes.keys());
    const operationTypes: OperationType[] = ['query', 'calculation', 'auth', 'transaction', 'gameLogic'];
    
    // Distribuir cada tipo de operação
    operationTypes.forEach(type => {
      // Aplicar estratégias específicas por tipo
      switch (type) {
        case 'auth':
          // Auth é crítico, usar todos os nós disponíveis
          this.operationDistribution.set(type, nodeIds);
          break;
          
        case 'transaction':
          // Transações são críticas mas pesadas, usar nós com alta capacidade
          const highCapacityNodes = Array.from(this.nodes.entries())
            .filter(([_, node]) => node.capacity >= 5)
            .map(([id]) => id);
          this.operationDistribution.set(type, highCapacityNodes.length ? highCapacityNodes : nodeIds);
          break;
          
        case 'gameLogic':
          // Lógica de jogo é sensível à latência, preferir nó local
          this.operationDistribution.set(type, ['local']);
          break;
          
        default:
          // Outros tipos usam todos os nós
          this.operationDistribution.set(type, nodeIds);
      }
    });
    
    console.log('[LoadBalancer] Operações rebalanceadas');
  }
  
  /**
   * Inicia verificação periódica da saúde dos nós
   */
  private startHealthCheck(): void {
    // Limpar intervalo existente se houver
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Verificar a cada 30 segundos
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 segundos sem heartbeat = nó indisponível
      
      this.nodes.forEach(node => {
        // Verificar tempo desde último heartbeat
        const timeSinceLastHeartbeat = now - node.lastHeartbeat;
        
        // Marcar como indisponível se não houver heartbeat recente
        if (timeSinceLastHeartbeat > timeout) {
          if (node.available) {
            console.warn(`[LoadBalancer] Nó ${node.id} marcado como indisponível (sem heartbeat)`);
            node.available = false;
            this.rebalanceOperations();
          }
        } else if (!node.available) {
          // Reativar nó se estiver recebendo heartbeats novamente
          console.log(`[LoadBalancer] Nó ${node.id} está disponível novamente`);
          node.available = true;
          this.rebalanceOperations();
        }
      });
    }, 30000);
  }
  
  /**
   * Retorna estatísticas atuais do balanceador
   */
  getStats(): any {
    return {
      totalNodes: this.nodes.size,
      availableNodes: Array.from(this.nodes.values()).filter(n => n.available).length,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        load: node.load,
        capacity: node.capacity,
        available: node.available,
      })),
      operationDistribution: Object.fromEntries(this.operationDistribution)
    };
  }
  
  /**
   * Finaliza o balanceador (para testes e fechamento limpo)
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.nodes.clear();
    this.operationDistribution.clear();
    console.log('[LoadBalancer] Finalizado');
  }
}

// Instância global do balanceador
export const loadBalancer = new LoadBalancer();

// Funções de conveniência
export const executeOnBestNode = async <T>(
  operationType: OperationType,
  operation: () => Promise<T>
): Promise<T> => {
  const nodeId = loadBalancer.selectNode(operationType);
  
  // No futuro, podemos implementar aqui a lógica para realmente
  // distribuir a operação para outros nós. Por enquanto, é apenas
  // uma simulação que executa localmente mas registra a distribuição.
  console.log(`[LoadBalancer] Executando ${operationType} no nó: ${nodeId}`);
  
  try {
    const result = await operation();
    
    // Simular redução da carga após conclusão
    setTimeout(() => {
      loadBalancer.updateNodeLoad(nodeId, -5);
    }, 1000);
    
    return result;
  } catch (error) {
    console.error(`[LoadBalancer] Erro ao executar ${operationType} no nó ${nodeId}:`, error);
    throw error;
  }
}; 