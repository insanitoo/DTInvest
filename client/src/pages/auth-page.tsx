import { useState, useEffect } from 'react';
import { Link, useLocation } from "wouter";
import { useAuth } from '@/hooks/use-auth-new';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  phoneNumber: z.string().min(9, 'Número de telefone deve ter 9 dígitos'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  phoneNumber: z.string()
    .min(9, 'Número de telefone deve ter 9 dígitos')
    .regex(/^[0-9 ]+$/, 'Número de telefone deve conter apenas números')
    .transform(val => val.replace(/\s+/g, '')),
  password: z.string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(50, 'Senha muito longa'),
  confirmPassword: z.string()
    .min(1, 'Confirme sua senha'),
  referralCode: z.string()
    .min(1, 'Código de convite é obrigatório')
    .max(50, 'Código de convite muito longo'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const referralCode = new URLSearchParams(window.location.search).get('ref');
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    return tabParam === 'register' || referralCode ? 'register' : 'login';
  });

  // Prevenir login automático quando houver código de convite
  useEffect(() => {
    if (referralCode) {
      localStorage.removeItem('sp_global_auth_user');
    }
  }, [referralCode]);

  useEffect(() => {
    if (referralCode && activeTab === 'register') {
      registerForm.setValue('referralCode', referralCode);
    }
  }, [activeTab, referralCode]);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'authenticated' | 'not-authenticated'>('checking');

  // Redirect if already logged in
  useEffect(() => {
    console.log("Auth page useEffect running, user:", user ? "authenticated" : "not authenticated");
    if (user) {
      console.log("User already logged in, redirecting to home page");
      // Using small timeout to ensure proper state propagation
      setTimeout(() => {
        setLocation('/');
      }, 100);
    } else {
      console.log("User not authenticated, showing login form");
      setSessionStatus('not-authenticated');
    }
  }, [user, setLocation]);

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
      rememberMe: false,
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      referralCode: '',
    },
  });

  // Handle login submission
  const onLoginSubmit = (data: LoginFormValues) => {
    // Remove spaces from phone number before submitting
    const formattedPhoneNumber = data.phoneNumber.replace(/\s+/g, '');

    console.log(`Attempting login with phone number: ${formattedPhoneNumber}`);
    setSessionStatus('checking');

    loginMutation.mutate({
      phoneNumber: formattedPhoneNumber,
      password: data.password,
      rememberMe: data.rememberMe,
    }, {
      onSuccess: () => {
        console.log("Login successful, setting status to authenticated");
        setSessionStatus('authenticated');
      },
      onError: () => {
        console.log("Login failed, setting status to not-authenticated");
        setSessionStatus('not-authenticated');
      }
    });
  };

  // Handle register submission - Versão melhorada com mais feedback
  const onRegisterSubmit = (data: RegisterFormValues) => {
    // Remove spaces from phone number before submitting
    const formattedPhoneNumber = data.phoneNumber.replace(/\s+/g, '');
    
    // Normalizar o código de convite (trim e uppercase)
    const formattedReferralCode = data.referralCode.trim();

    console.log(`Tentando registro com número: ${formattedPhoneNumber}, código: ${formattedReferralCode}`);
    setSessionStatus('checking');

    registerMutation.mutate({
      phoneNumber: formattedPhoneNumber,
      password: data.password,
      referralCode: formattedReferralCode,
    }, {
      onSuccess: (userData) => {
        console.log("Registro bem-sucedido:", userData);
        setSessionStatus('authenticated');
        
        // Exibir mensagem de sucesso
        toast({
          title: "Registro realizado com sucesso!",
          description: "Seja bem-vindo ao DTI Invest.",
          variant: "default",
        });
      },
      onError: (error: any) => {
        console.log("Falha no registro:", error);
        setSessionStatus('not-authenticated');
        
        // Mensagem de erro mais amigável
        let errorMessage = "Não foi possível completar o registro.";
        
        // Tentar extrair mensagem de erro da API
        if (error.message) {
          if (error.message.includes("Código de convite inválido")) {
            errorMessage = "O código de convite informado não é válido. Tente usar 'ADMIN01' ou peça um código a quem te convidou.";
          } else if (error.message.includes("Número de telefone já está em uso")) {
            errorMessage = "Este número de telefone já está registrado. Tente fazer login ou use outro número.";
          } else if (error.message.includes("500")) {
            errorMessage = "Erro no servidor. Por favor, tente novamente mais tarde ou use o código 'ADMIN01'.";
          } else {
            // Usa a mensagem da API
            errorMessage = error.message;
          }
        }
        
        toast({
          title: "Erro no registro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  };

  // Format phone number as user types
  const formatPhoneInput = (e: React.ChangeEvent<HTMLInputElement>, formSetter: any) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    const formatted = formatPhoneNumber(value);
    formSetter(formatted);
  };

  return (
    <div className="min-h-screen bg-dark-primary text-white">
      <div className="container mx-auto px-4 py-8 max-w-md">
        {/* Logo central acima dos formulários */}
        <div className="flex justify-center mb-8">
          <div className="rounded-full bg-white w-20 h-20 flex items-center justify-center">
            <span className="text-dark-secondary text-xl font-bold">DTI</span>
          </div>
        </div>
        
        {/* Session Status - invisível mas mantido para funcionalidade */}
        <div className="hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className={`w-3 h-3 rounded-full ${
                  sessionStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
                  sessionStatus === 'authenticated' ? 'bg-green-500' :
                  'bg-gray-500'
                }`}
              ></div>
              <p className="text-sm text-gray-300">
                {sessionStatus === 'checking' ? 'Verificando autenticação...' :
                 sessionStatus === 'authenticated' ? 'Autenticado' :
                 'Não autenticado'}
              </p>
            </div>
          </div>
        </div>

        {/* Auth Tabs */}
        <div className="bg-dark-secondary rounded-lg overflow-hidden mb-6 cyber-element">
          <div className="flex">
            <button 
              className={`flex-1 py-3 text-center ${
                activeTab === 'login' ? 'bg-dark-tertiary border-b-2 border-primary font-medium' : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('login')}
            >
              Login
            </button>
            <button 
              className={`flex-1 py-3 text-center ${
                activeTab === 'register' ? 'bg-dark-tertiary border-b-2 border-primary font-medium' : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('register')}
            >
              Registro
            </button>
          </div>

          {/* Login Form */}
          <div className={`p-6 ${activeTab !== 'login' ? 'hidden' : ''}`}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div>
                <label htmlFor="login-phone" className="block text-sm text-gray-400 mb-1">
                  Número de Telefone
                </label>
                <Input
                  id="login-phone"
                  className="w-full rounded-md p-2.5 auth-input"
                  placeholder="Ex: 999 999 999"
                  {...loginForm.register('phoneNumber')}
                  onChange={(e) => formatPhoneInput(e, (val: string) => 
                    loginForm.setValue('phoneNumber', val, { shouldValidate: true })
                  )}
                />
                {loginForm.formState.errors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.phoneNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm text-gray-400 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    className="w-full rounded-md p-2.5 auth-input"
                    placeholder="Sua senha"
                    {...loginForm.register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 bg-dark-tertiary rounded border-gray-600 focus:ring-primary focus:ring-2"
                    {...loginForm.register('rememberMe')}
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-gray-400">
                    Lembrar-me
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-md font-medium transition-colors"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="animate-spin h-5 w-5" />
                      <span>Autenticando...</span>
                    </div>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>

              {loginMutation.isError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3 mt-2 text-sm text-red-200 flex items-start">
                  <p>{loginMutation.error.message}</p>
                </div>
              )}
            </form>
          </div>

          {/* Register Form */}
          <div className={`p-6 ${activeTab !== 'register' ? 'hidden' : ''}`}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <div>
                <label htmlFor="register-phone" className="block text-sm text-gray-400 mb-1">
                  Número de Telefone
                </label>
                <Input
                  id="register-phone"
                  className="w-full rounded-md p-2.5 auth-input"
                  placeholder="Ex: 999 999 999"
                  {...registerForm.register('phoneNumber')}
                  onChange={(e) => formatPhoneInput(e, (val: string) => 
                    registerForm.setValue('phoneNumber', val, { shouldValidate: true })
                  )}
                />
                {registerForm.formState.errors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.phoneNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm text-gray-400 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    className="w-full rounded-md p-2.5 auth-input"
                    placeholder="Crie uma senha"
                    {...registerForm.register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm text-gray-400 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full rounded-md p-2.5 auth-input"
                    placeholder="Confirme sua senha"
                    {...registerForm.register('confirmPassword')}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="referral-code" className="block text-sm text-gray-400 mb-1">
                  Código de Convite *
                </label>
                <Input
                  id="referral-code"
                  className="w-full rounded-md p-2.5 auth-input"
                  placeholder="Código de convite"
                  defaultValue={new URLSearchParams(window.location.search).get('ref') || ''}
                  {...registerForm.register('referralCode', { required: 'Código de convite é obrigatório' })}
                />
                {registerForm.formState.errors.referralCode && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.referralCode.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-md font-medium transition-colors"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="animate-spin h-5 w-5" />
                      <span>Registrando...</span>
                    </div>
                  ) : (
                    'Registrar'
                  )}
                </Button>
              </div>

              {registerMutation.isError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3 mt-2 text-sm text-red-200 flex items-start">
                  <p>
                    {registerMutation.error.message.includes("Código de convite inválido")
                      ? "O código de convite informado não é válido. Tente usar 'ADMIN01' ou peça um código a quem te convidou."
                      : registerMutation.error.message.includes("Número de telefone já está em uso") 
                      ? "Este número de telefone já está registrado. Tente fazer login ou use outro número."
                      : registerMutation.error.message
                    }
                  </p>
                </div>
              )}
              
              {/* Dica para usuários novos */}
              <div className="mt-4 border border-blue-500/30 rounded-md p-3 bg-blue-900/20">
                <p className="text-sm text-blue-200">
                  <span className="font-medium">Dica:</span> Se você não tiver um código de convite, 
                  pode usar o código <strong className="text-white">ADMIN01</strong> para se registrar.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Debug Panel - Hidden */}
        <div className="hidden">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-400">Debug: Autenticação</h3>
            <button
              className="text-xs bg-dark-tertiary hover:bg-dark-tertiary/80 text-gray-400 py-1 px-2 rounded"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? 'Ocultar detalhes' : 'Mostrar detalhes'}
            </button>
          </div>

          {showDebug && (
            <>
              {/* Token Manager */}
              <div className="mb-4 border border-dark-border rounded-md overflow-hidden">
                <div className="bg-dark-tertiary py-2 px-3 border-b border-dark-border">
                  <h4 className="text-xs font-medium">Token Manager</h4>
                </div>
                <div className="p-3 text-xs font-mono bg-dark-primary/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Status:</span>
                    <span className={`${user ? 'text-green-500' : 'text-gray-500'}`}>
                      {user ? 'Válido' : 'Ausente'}
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Armazenado em:</span>
                    <span className="text-gray-300">localStorage</span>
                  </div>
                </div>
              </div>

              {/* Clear Storage Button */}
              <div className="mt-4 flex justify-end">
                <button
                  className="text-xs bg-red-900/50 hover:bg-red-900/80 text-red-300 py-1.5 px-3 rounded"
                  onClick={() => {
                    localStorage.removeItem(AUTH_USER_KEY);
                    window.location.reload();
                  }}
                >
                  Limpar dados armazenados
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage key for auth user (same as in use-auth.tsx)
const AUTH_USER_KEY = 'sp_global_auth_user';