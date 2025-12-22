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

const CURRENCY_STORAGE_KEY = 'LedgerTracker-currency';
const FORMAT_STORAGE_KEY = 'LedgerTracker-number-format'; // New storage key

export function useCurrency() {
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(() => {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) {
      const currency = currencies.find((c) => c.code === stored);
      if (currency) return currency;
    }
    return currencies[0];
  });

  // New state for number format: defaults to 'international' (0-9 digits)
  const [numberFormat, setNumberFormat] = useState<'international' | 'local'>(() => {
    return (localStorage.getItem(FORMAT_STORAGE_KEY) as 'international' | 'local') || 'international';
  });

  const setCurrency = useCallback((code: string) => {
    const currency = currencies.find((c) => c.code === code);
    if (currency) {
      localStorage.setItem(CURRENCY_STORAGE_KEY, code);
      setCurrentCurrency(currency);
    }
  }, []);

  // Function to toggle number format
  const changeNumberFormat = useCallback((format: 'international' | 'local') => {
    localStorage.setItem(FORMAT_STORAGE_KEY, format);
    setNumberFormat(format);
  }, []);

  const formatCurrency = useCallback((value: number) => {
    // International uses 'en-US' locale for 0-9 digits, Local uses the currency's specific locale
    const locale = numberFormat === 'international' ? 'en-US' : currentCurrency.locale;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currentCurrency.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, [currentCurrency, numberFormat]);

  return {
    currency: currentCurrency,
    currencies,
    setCurrency,
    numberFormat,
    setNumberFormat: changeNumberFormat,
    formatCurrency,
    symbol: currentCurrency.symbol,
  };
}