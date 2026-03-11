import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata datas no padrão brasileiro
 * Pode receber YYYY, YYYY-MM ou YYYY-MM-DD
 */
export function formatPublicationDate(dateString: string | undefined): string {
  if (!dateString) return '';

  try {
    // Apenas ano: YYYY
    if (/^\d{4}$/.test(dateString.trim())) {
      return dateString.trim();
    }

    // Ano e mês: YYYY-MM
    if (/^\d{4}-\d{2}$/.test(dateString.trim())) {
      const parts = dateString.trim().split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 15);
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    }

    // Data completa ou ISO: YYYY-MM-DD
    let parsedDate: Date;
    if (dateString.includes('T')) {
      parsedDate = parseISO(dateString);
    } else {
      // Ajuste para evitar fuso horário puxando 1 dia para trás
      parsedDate = parseISO(dateString.split(' ')[0] + 'T12:00:00Z');
    }

    return format(parsedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch (e) {
    return dateString;
  }
}

/**
 * Função para retornar true se a data fornecida está no futuro.
 */
export function isFutureDate(dateString: string | undefined): boolean {
  if (!dateString) return false;

  try {
    let dateToCompare: Date;
    const parts = dateString.trim().split('-');

    if (parts.length === 1) {
      dateToCompare = new Date(parseInt(parts[0]), 11, 31); // Fim do ano
    } else if (parts.length === 2) {
      dateToCompare = new Date(parseInt(parts[0]), parseInt(parts[1]), 0); // Fim do mês
    } else if (dateString.includes('T')) {
      dateToCompare = parseISO(dateString);
    } else {
      dateToCompare = parseISO(dateString.split(' ')[0] + 'T12:00:00Z');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dateToCompare > today;
  } catch (e) {
    return false;
  }
}
