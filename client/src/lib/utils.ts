import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "KZ 0.00";
  }
  return `KZ ${value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
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

export function getTransactionStatusColor(status: string): string {
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
