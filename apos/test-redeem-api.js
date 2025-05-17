const fetch = require('node-fetch');

async function testRedeemAPI() {
  console.log('🔍 Testando API de resgate de recompensas...\n');
  
  // Primeiro precisamos fazer login para ter uma sessão
  // Vamos usar um usuário de teste ou você pode inserir credenciais válidas
  const loginData = {
    email: 'admin@admin.com', // substitua com credenciais válidas
    password: '123456'      // substitua com senha válida
  };
  
  try {
    // 1. Fazer login
    console.log('1. Fazendo login...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });
    
    if (!loginResponse.ok) {
      console.log('Erro no login:', await loginResponse.text());
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login bem-sucedido!');
    
    // 2. Buscar recompensas disponíveis
    console.log('\n2. Buscando recompensas disponíveis...');
    const rewardsResponse = await fetch('http://localhost:3000/api/rewards', {
      headers: {
        'Cookie': cookies,
      },
    });
    
    const rewards = await rewardsResponse.json();
    console.log('Recompensas encontradas:', rewards);
    
    // 3. Tentar resgatar a primeira recompensa
    if (rewards && rewards.length > 0) {
      const firstReward = rewards[0];
      console.log(`\n3. Tentando resgatar: ${firstReward.name} (ID: ${firstReward.id})`);
      
      const redeemResponse = await fetch('http://localhost:3000/api/user/rewards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies,
        },
        body: JSON.stringify({ rewardId: firstReward.id }),
      });
      
      const redeemResult = await redeemResponse.json();
      console.log('Status:', redeemResponse.status);
      console.log('Resultado:', redeemResult);
      
      if (!redeemResponse.ok) {
        console.log('Erro detalhado:', redeemResult);
      }
    } else {
      console.log('Nenhuma recompensa disponível para teste');
    }
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

// Aguardar o servidor estar rodando
setTimeout(() => {
  testRedeemAPI();
}, 2000);