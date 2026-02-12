// Country code → currency mapping and formatting utilities

export interface CurrencyInfo {
  code: string;   // ISO 4217 currency code
  symbol: string; // Display symbol
  name: string;   // Full name
}

// Map dial codes to currencies
const DIAL_TO_CURRENCY: Record<string, CurrencyInfo> = {
  '+1':   { code: 'USD', symbol: '$', name: 'US Dollar' },
  '+44':  { code: 'GBP', symbol: '£', name: 'British Pound' },
  '+234': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  '+233': { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  '+254': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  '+27':  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  '+255': { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  '+256': { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  '+250': { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  '+251': { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  '+237': { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  '+225': { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  '+221': { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  '+243': { code: 'CDF', symbol: 'FC', name: 'Congolese Franc' },
  '+258': { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical' },
  '+260': { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
  '+265': { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha' },
  '+267': { code: 'BWP', symbol: 'P', name: 'Botswana Pula' },
  '+91':  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  '+92':  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  '+880': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  '+63':  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  '+55':  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  '+52':  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  '+49':  { code: 'EUR', symbol: '€', name: 'Euro' },
  '+33':  { code: 'EUR', symbol: '€', name: 'Euro' },
  '+34':  { code: 'EUR', symbol: '€', name: 'Euro' },
  '+39':  { code: 'EUR', symbol: '€', name: 'Euro' },
  '+351': { code: 'EUR', symbol: '€', name: 'Euro' },
  '+971': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  '+966': { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  '+20':  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  '+212': { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  '+61':  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  '+81':  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  '+86':  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  '+7':   { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  '+90':  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
};

// Currency code → symbol map for quick lookup from wallet.currency
const CODE_TO_SYMBOL: Record<string, string> = {};
for (const info of Object.values(DIAL_TO_CURRENCY)) {
  CODE_TO_SYMBOL[info.code] = info.symbol;
}

/** Get currency info from a phone dial code like "+250" */
export function getCurrencyFromDialCode(dialCode: string): CurrencyInfo {
  return DIAL_TO_CURRENCY[dialCode] || { code: 'USD', symbol: '$', name: 'US Dollar' };
}

/** Get currency code from a full phone number like "+250712345678" */
export function getCurrencyCodeFromPhone(phone: string): string {
  if (!phone) return 'USD';
  // Try longest prefix first (4 digits, then 3, then 2, then 1)
  for (let len = 4; len >= 1; len--) {
    const prefix = phone.substring(0, len + 1); // +XXX
    if (DIAL_TO_CURRENCY[prefix]) {
      return DIAL_TO_CURRENCY[prefix].code;
    }
  }
  return 'USD';
}

/** Get the display symbol for a currency code */
export function getCurrencySymbol(currencyCode: string): string {
  return CODE_TO_SYMBOL[currencyCode] || currencyCode;
}

/** Format an amount with the correct currency symbol */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const symbol = getCurrencySymbol(currencyCode);
  // For currencies without decimal subdivisions
  const noDecimals = ['JPY', 'UGX', 'RWF', 'XAF', 'XOF', 'CDF'];
  const decimals = noDecimals.includes(currencyCode) ? 0 : 2;
  return `${symbol}${Math.abs(amount).toFixed(decimals)}`;
}
