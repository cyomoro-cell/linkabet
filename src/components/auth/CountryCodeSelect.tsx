import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'GH', dial: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'KE', dial: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'TZ', dial: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: 'UG', dial: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: 'RW', dial: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: 'ET', dial: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', name: 'DR Congo' },
  { code: 'MZ', dial: '+258', flag: '🇲🇿', name: 'Mozambique' },
  { code: 'ZM', dial: '+260', flag: '🇿🇲', name: 'Zambia' },
  { code: 'MW', dial: '+265', flag: '🇲🇼', name: 'Malawi' },
  { code: 'BW', dial: '+267', flag: '🇧🇼', name: 'Botswana' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'PK', dial: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'PH', dial: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: 'MX', dial: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'China' },
  { code: 'RU', dial: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Turkey' },
];

interface CountryCodeSelectProps {
  value: string;
  onValueChange: (val: string) => void;
}

export default function CountryCodeSelect({ value, onValueChange }: CountryCodeSelectProps) {
  const sorted = useMemo(
    () => [...COUNTRY_CODES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const selected = sorted.find((c) => c.dial === value) || sorted.find((c) => c.code === 'US')!;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[100px] shrink-0 rounded-r-none border-r-0 bg-secondary">
        <SelectValue>
          <span className="flex items-center gap-1 text-sm">
            <span>{selected.flag}</span>
            <span className="text-muted-foreground">{selected.dial}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        {sorted.map((c) => (
          <SelectItem key={c.code} value={c.dial}>
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span>{c.name}</span>
              <span className="text-muted-foreground">{c.dial}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
