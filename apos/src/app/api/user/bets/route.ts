import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';

    // Definir o filtro de data com base no período selecionado
    let dateFilter: Date | null = null;
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para domingo = 0, segunda = 1
        dateFilter = new Date(now.setDate(diff));
        dateFilter.setHours(0, 0, 0, 0);
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        // Para 'all', não aplicamos filtro de data
        break;
    }

    // Consultar as apostas do usuário
    const bets = await prisma.bet.findMany({
      where: {
        userId,
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        round: {
          select: {
            result: true,
          },
        },
      },
    });

    // Processar os dados para o formato necessário no frontend
    const processedBets = bets.map((bet: any) => {
      const rawResult = bet.round?.result || 50;
      const displayResult = 100 - rawResult; // Valor de exibição
      
      // Calcular se o usuário ganhou a aposta
      const won = (bet.type === 'ABOVE' && rawResult < 50) || 
                  (bet.type === 'BELOW' && rawResult >= 50);
      
      // Calcular o lucro se ganhou
      const profit = won ? bet.amount * 1.8 : 0; // Multiplicador fixo de 1.8x
      
      return {
        id: bet.id,
        amount: bet.amount,
        type: bet.type,
        result: rawResult,
        displayResult,
        won,
        profit,
        timestamp: bet.createdAt.toISOString(),
        roundId: bet.roundId,
      };
    });

    return NextResponse.json({ bets: processedBets });
  } catch (error) {
    console.error('Erro ao buscar apostas:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
} 