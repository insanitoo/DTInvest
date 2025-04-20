const axios = require('axios');

const API_URL = 'http://localhost:5000';
let cookie = null;

// Função para configurar o axios com cookie
const axiosWithAuth = () => {
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    }
  });
};

// Fazer login para obter o cookie
const login = async () => {
  try {
    const response = await axios.post(`${API_URL}/api/login`, {
      phoneNumber: '999999999',
      password: 'protótipo'
    }, { withCredentials: true });
    
    cookie = response.headers['set-cookie'][0];
    console.log('Login bem-sucedido:', response.data.phoneNumber);
    return response.data;
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
    throw error;
  }
};

// Criar uma nova transação
const createTransaction = async () => {
  try {
    const api = axiosWithAuth();
    const response = await api.post('/api/transactions', {
      type: 'deposit',
      amount: 5000,
      bankAccount: '123456789',
      bankName: 'Banco Angolano de Investimentos (BAI)'
    });
    
    console.log('Transação criada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar transação:', error.message);
    throw error;
  }
};

// Aprovar uma transação (atualizar para "completed")
const approveTransaction = async (transactionId) => {
  try {
    const api = axiosWithAuth();
    const response = await api.put(`/api/admin/transactions/${transactionId}`, {
      status: 'completed'
    });
    
    console.log('Transação aprovada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao aprovar transação:', error.message);
    throw error;
  }
};

// Verificar saldo após aprovação
const checkBalance = async () => {
  try {
    const api = axiosWithAuth();
    const response = await api.get('/api/user');
    
    console.log('Saldo atual do usuário:', response.data.balance);
    return response.data;
  } catch (error) {
    console.error('Erro ao verificar saldo:', error.message);
    throw error;
  }
};

// Executar testes
const runTests = async () => {
  try {
    // 1. Fazer login
    const user = await login();
    console.log('Saldo inicial:', user.balance);
    
    // 2. Criar transação
    const transaction = await createTransaction();
    
    // 3. Aprovar transação
    if (transaction && transaction.id) {
      await approveTransaction(transaction.id);
      
      // 4. Verificar saldo atualizado
      await checkBalance();
    } else {
      console.error('Nenhuma transação criada');
    }
  } catch (error) {
    console.error('Teste falhou:', error.message);
  }
};

// Executar
runTests();