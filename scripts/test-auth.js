const axios = require('axios');

// Função para tentar fazer login
async function loginUser() {
  try {
    const response = await axios.post('http://localhost:5000/api/login', {
      phoneNumber: '999999999',
      password: 'protótipo',
    }, {
      withCredentials: true,
    });
    
    console.log('Login bem-sucedido:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro de login:', error.response?.data || error.message);
    return null;
  }
}

// Função para verificar o usuário atual
async function getCurrentUser(cookie) {
  try {
    const response = await axios.get('http://localhost:5000/api/user', {
      headers: {
        Cookie: cookie
      },
      withCredentials: true,
    });
    
    console.log('Usuário atual:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter usuário:', error.response?.data || error.message);
    return null;
  }
}

// Função para buscar estatísticas de administrador
async function getAdminStats(cookie) {
  try {
    const response = await axios.get('http://localhost:5000/api/admin/stats', {
      headers: {
        Cookie: cookie
      },
      withCredentials: true,
    });
    
    console.log('Estatísticas de admin:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error.response?.data || error.message);
    return null;
  }
}

// Função principal para executar os testes
async function runTests() {
  console.log('Iniciando testes de autenticação...');
  
  // Tenta fazer login
  const loginResponse = await axios.post('http://localhost:5000/api/login', {
    phoneNumber: '999999999',
    password: 'protótipo',
  }, {
    withCredentials: true,
  })
  .catch(error => {
    console.error('Erro de login:', error.response?.data || error.message);
    return { data: null, headers: {} };
  });
  
  if (!loginResponse.data) {
    console.log('Não foi possível fazer login. Finalizando testes.');
    return;
  }
  
  console.log('Login bem-sucedido:', loginResponse.data);
  
  // Captura o cookie de sessão
  const cookie = loginResponse.headers['set-cookie']?.[0];
  
  if (!cookie) {
    console.log('Não foi possível obter o cookie de sessão. Finalizando testes.');
    return;
  }
  
  console.log('Cookie obtido:', cookie);
  
  // Testa a rota de usuário atual
  await getCurrentUser(cookie);
  
  // Testa a rota de estatísticas do admin
  await getAdminStats(cookie);
}

// Executa os testes
runTests();