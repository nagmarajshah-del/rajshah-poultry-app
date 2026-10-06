export type BusinessProfile = {
  ownerName: string;
  primaryPhone: string;
  secondaryPhone: string;
  address: string;
};

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  ownerName: 'RAJSHAH POULTRY FARM / Owner',
  primaryPhone: '',
  secondaryPhone: '',
  address: '',
};

export function nationalPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function formatIndianPhone(value: string): string {
  const digits = nationalPhoneDigits(value);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : '';
}

export function normalizeBusinessProfile(value: unknown): BusinessProfile {
  const stored = value && typeof value === 'object' ? value as Partial<BusinessProfile> : {};
  return {
    ownerName: typeof stored.ownerName === 'string' && stored.ownerName.trim()
      ? stored.ownerName.trim()
      : DEFAULT_BUSINESS_PROFILE.ownerName,
    primaryPhone: typeof stored.primaryPhone === 'string' ? formatIndianPhone(stored.primaryPhone) : '',
    secondaryPhone: typeof stored.secondaryPhone === 'string' ? formatIndianPhone(stored.secondaryPhone) : '',
    address: typeof stored.address === 'string' ? stored.address.trim() : '',
  };
}
