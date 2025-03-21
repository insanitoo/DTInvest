import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Smartphone, Lock, Ticket } from 'lucide-react';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { LoginData, RegistrationData } from '@shared/schema';

const loginSchema = z.object({
  phoneNumber: z.string()
    .min(9, "Número de telefone deve ter pelo menos 9 dígitos")
    .max(9, "Número de telefone deve ter no máximo 9 dígitos")
    .regex(/^9[0-9]{8}$/, "Número de telefone deve começar com 9 seguido de 8 dígitos"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const registerSchema = z.object({
  referralCode: z.string().min(1, "Código de convite é obrigatório"),
  phoneNumber: z.string()
    .min(9, "Número de telefone deve ter pelo menos 9 dígitos")
    .max(9, "Número de telefone deve ter no máximo 9 dígitos")
    .regex(/^9[0-9]{8}$/, "Número de telefone deve começar com 9 seguido de 8 dígitos"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export default function AuthPage() {
  const [showRegister, setShowRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setTimeout(() => {
        setLocation('/', { replace: true });
      }, 100);
    }
  }, [user, setLocation]);

  // Login form
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
    },
  });

  // Register form
  const registerForm = useForm<RegistrationData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      referralCode: '',
      phoneNumber: '',
      password: '',
    },
  });

  const onLoginSubmit = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegistrationData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-md bg-dark-secondary rounded-xl p-6 cybernetic-border">
        {/* Login Form */}
        {!showRegister && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">S&P Global</h2>
              <div className="rounded-full bg-white w-12 h-12 flex items-center justify-center">
                <span className="text-dark-secondary text-lg font-bold">S&P</span>
              </div>
            </div>

            <p className="text-gray-300 mb-6">Faça login e ganhe sua renda</p>

            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telemóvel</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="9xxxxxxxx" 
                            className="bg-dark-tertiary text-white border-gray-700 pl-12" 
                          />
                        </FormControl>
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <Smartphone className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Apresentamos o seu celular</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Palavra-passe</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            type={showPassword ? "text" : "password"} 
                            placeholder="******" 
                            className="bg-dark-tertiary text-white border-gray-700 pl-12" 
                          />
                        </FormControl>
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <button 
                          type="button" 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  variant="primary" 
                  className="w-full py-6"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Processando...' : 'Iniciar sessão'}
                </Button>
              </form>
            </Form>

            <div className="text-center mt-6">
              <p className="text-gray-400">
                Não tem conta? <Button variant="link" className="text-brand-yellow p-0" onClick={() => setShowRegister(true)}>Criar conta</Button>
              </p>
            </div>
          </>
        )}

        {/* Register Form */}
        {showRegister && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Criar Conta</h2>
              <div className="rounded-full bg-white w-12 h-12 flex items-center justify-center">
                <span className="text-dark-secondary text-lg font-bold">S&P</span>
              </div>
            </div>

            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Convite (Obrigatório)</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Digite o código" 
                            className="bg-dark-tertiary text-white border-gray-700 pl-12" 
                          />
                        </FormControl>
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <Ticket className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telemóvel</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="9xxxxxxxx" 
                            className="bg-dark-tertiary text-white border-gray-700 pl-12" 
                          />
                        </FormControl>
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <Smartphone className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Palavra-passe</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            type={showPassword ? "text" : "password"} 
                            placeholder="******" 
                            className="bg-dark-tertiary text-white border-gray-700 pl-12" 
                          />
                        </FormControl>
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <button 
                          type="button" 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  variant="primary" 
                  className="w-full py-6"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? 'Processando...' : 'Criar conta'}
                </Button>
              </form>
            </Form>

            <div className="text-center mt-6">
              <p className="text-gray-400">
                Já tem conta? <Button variant="link" className="text-brand-yellow p-0" onClick={() => setShowRegister(false)}>Entrar</Button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
