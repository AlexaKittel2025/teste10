// Este arquivo complementa as definições de tipo do Prisma
declare module '@prisma/client' {
  export interface PrismaClientOptions {
    log?: Array<string>;
  }

  export class PrismaClient {
    constructor(options?: PrismaClientOptions);
    
    user: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    bet: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
      aggregate(args: any): Promise<any>;
    };
    round: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      aggregate(args: any): Promise<any>;
    };
    transaction: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    playerLevel: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    reward: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    rewardRedemption: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    systemConfig: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    chatMessage: {
      findUnique(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete(args: any): Promise<any>;
      count(args?: any): Promise<number>;
    };
    
    $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
  }
} 