import { useState, useEffect, useCallback } from 'react';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const currencies: Currency[] = [
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
];

const CURRENCY_STORAGE_KEY = 'takatrack-currency';

export function useCurrency() {
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(() => {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) {
      const currency = currencies.find((c) => c.code === stored);
      if (currency) return currency;
    }
    // Default to BDT (Bangladesh)
    return currencies[0];
  });

  const setCurrency = useCallback((code: string) => {
    const currency = currencies.find((c) => c.code === code);
    if (currency) {
      localStorage.setItem(CURRENCY_STORAGE_KEY, code);
      setCurrentCurrency(currency);
    }
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat(currentCurrency.locale, {
      style: 'currency',
      currency: currentCurrency.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, [currentCurrency]);

  return {
    currency: currentCurrency,
    currencies,
    setCurrency,
    formatCurrency,
    symbol: currentCurrency.symbol,
  };
}
