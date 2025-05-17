/**
 * Sistema de fila para processar operações assíncronas
 * Isso permite que operações pesadas sejam executadas em background
 * sem bloquear o fluxo principal da aplicação
 */

type QueueTask = {
  id: string;
  task: () => Promise<any>;
  priority: number;
  addedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: any;
};

class TaskQueue {
  private queue: QueueTask[] = [];
  private isProcessing: boolean = false;
  private concurrentTasks: number = 0;
  private maxConcurrent: number = 5;
  private callbacks: { [key: string]: Array<(result: any) => void> } = {};

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Adiciona uma tarefa à fila
   * @param task Função assíncrona a ser executada
   * @param priority Prioridade (maior número = maior prioridade)
   * @returns ID da tarefa
   */
  enqueue(task: () => Promise<any>, priority: number = 0): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueTask: QueueTask = {
      id,
      task,
      priority,
      addedAt: Date.now(),
      status: 'pending',
    };

    this.queue.push(queueTask);
    
    // Ordenar fila por prioridade (maior primeiro) e tempo de adição (mais antigo primeiro)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.addedAt - b.addedAt;
    });

    // Iniciar processamento se não estiver em andamento
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Processa a fila de tarefas
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.concurrentTasks < this.maxConcurrent) {
      const task = this.queue.shift();
      if (!task) continue;

      this.concurrentTasks++;
      task.status = 'processing';

      // Executar tarefa em uma Promise separada para não bloquear o loop
      this.executeTask(task).finally(() => {
        this.concurrentTasks--;
        // Verificar se há mais tarefas para processar
        if (this.queue.length > 0) {
          this.processQueue();
        } else if (this.concurrentTasks === 0) {
          this.isProcessing = false;
        }
      });
    }

    if (this.concurrentTasks === 0) {
      this.isProcessing = false;
    }
  }

  /**
   * Executa uma tarefa específica
   */
  private async executeTask(task: QueueTask) {
    try {
      const result = await task.task();
      task.status = 'completed';
      task.result = result;

      // Chamar callbacks registrados para esta tarefa
      if (this.callbacks[task.id]) {
        this.callbacks[task.id].forEach(callback => callback(result));
        delete this.callbacks[task.id];
      }

      return result;
    } catch (error) {
      task.status = 'failed';
      task.error = error;
      console.error(`Tarefa ${task.id} falhou:`, error);
      
      // Chamar callbacks mesmo em caso de erro
      if (this.callbacks[task.id]) {
        this.callbacks[task.id].forEach(callback => callback(null));
        delete this.callbacks[task.id];
      }
      
      throw error;
    }
  }

  /**
   * Registra um callback para quando uma tarefa for concluída
   */
  onComplete(taskId: string, callback: (result: any) => void) {
    if (!this.callbacks[taskId]) {
      this.callbacks[taskId] = [];
    }
    this.callbacks[taskId].push(callback);
  }

  /**
   * Obtém o status de uma tarefa
   */
  getTaskStatus(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    return task ? task.status : 'not_found';
  }

  /**
   * Cancela uma tarefa pendente
   * @returns true se a tarefa foi cancelada, false se não foi encontrada ou já está em processamento
   */
  cancelTask(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId && t.status === 'pending');
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Obtém estatísticas atuais da fila
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeTasks: this.concurrentTasks,
      isProcessing: this.isProcessing,
      pendingTasks: this.queue.filter(t => t.status === 'pending').length,
      highPriorityTasks: this.queue.filter(t => t.priority > 5).length,
    };
  }
}

// Instância global da fila
export const taskQueue = new TaskQueue();

// Exportar funções de conveniência
export const enqueueTask = (task: () => Promise<any>, priority: number = 0) => 
  taskQueue.enqueue(task, priority);

export const onTaskComplete = (taskId: string, callback: (result: any) => void) =>
  taskQueue.onComplete(taskId, callback);

export const getTaskStatus = (taskId: string) =>
  taskQueue.getTaskStatus(taskId);

// Helpers específicos para tipos comuns de operações
export const enqueueTransaction = async (
  transactionFn: () => Promise<any>,
  options = { priority: 8 }
) => {
  return taskQueue.enqueue(transactionFn, options.priority);
};

export const enqueueEmailSending = async (
  emailData: any,
  options = { priority: 3 }
) => {
  return taskQueue.enqueue(
    async () => {
      // Aqui implementaremos o envio de email quando necessário
      console.log("Simulando envio de email:", emailData);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulação de operação assíncrona
      return { sent: true, to: emailData.to };
    },
    options.priority
  );
}; 