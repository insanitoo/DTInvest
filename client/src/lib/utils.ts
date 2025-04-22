import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | undefined | null, forcePositive: boolean = false): string {
  if (value === undefined || value === null) {
    return "KZ 0.00";
  }
  
  // Se forcePositive for true, sempre exibe como valor positivo
  const formattedValue = Math.abs(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  return `KZ ${formattedValue}`;
}

// Função específica para formatar valores de transação - adiciona sinal de - para compras e saques
export function formatTransactionAmount(transaction: { type: string; amount: number }): string {
  if (!transaction) {
    return "KZ 0.00";
  }
  
  const isNegativeType = transaction.type === 'withdrawal' || transaction.type === 'purchase';
  const sign = isNegativeType ? '-' : '+';
  const formattedValue = Math.abs(transaction.amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  return `${sign}KZ ${formattedValue}`;
}

// Retorna a classe CSS para colorir o valor da transação
export function getTransactionAmountColor(type: string): string {
  if (type === 'withdrawal' || type === 'purchase') {
    return 'text-red-400';
  } else if (type === 'deposit' || type === 'commission') {
    return 'text-green-400';
  }
  return 'text-yellow-400';
}

export function formatPhoneNumber(phoneNumber: string): string {
  // Format as 9xx xxx xxx
  if (phoneNumber && phoneNumber.length === 9) {
    return `${phoneNumber.substring(0, 3)} ${phoneNumber.substring(3, 6)} ${phoneNumber.substring(6)}`;
  }
  return phoneNumber;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-AO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function calculateNetWithdrawal(amount: number): number {
  // Calculate the amount after 20% fee
  return amount * 0.8;
}

export function isWithinAngolaBusinessHours(): boolean {
  const now = new Date();
  const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
  const hours = angolaTime.getHours();
  return hours >= 10 && hours < 15;
}

export function isWeekday(): boolean {
  const now = new Date();
  const angolaTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Luanda" }));
  const day = angolaTime.getDay();
  return day >= 1 && day <= 5; // 0 is Sunday, 6 is Saturday
}

export function getTransactionStatusColor(status: string, type?: string): string {
  // Para transações de compra, sempre usar vermelho
  if (type === 'purchase') {
    return 'text-red-500';
  }
  
  // Para comissões, sempre usar verde
  if (type === 'commission') {
    return 'text-green-500';
  }
  
  // Para os demais casos, usar a lógica normal baseada no status
  switch (status) {
    case 'completed':
      return 'text-green-500';
    case 'pending':
      return 'text-yellow-500';
    case 'processing':
      return 'text-blue-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getTransactionStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return 'check-circle';
    case 'pending':
      return 'clock';
    case 'processing':
      return 'refresh-cw';
    case 'failed':
      return 'x-circle';
    default:
      return 'help-circle';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
