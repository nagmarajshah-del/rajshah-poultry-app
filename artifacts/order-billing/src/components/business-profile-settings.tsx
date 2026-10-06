import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, MapPin, Phone, Settings2, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { formatIndianPhone, nationalPhoneDigits, type BusinessProfile } from '@/lib/business-profile';

const phoneSchema = z.string().refine((value) => value.length === 0 || value.length === 10, 'Enter a 10-digit Indian phone number.');
const profileSchema = z.object({
  ownerName: z.string().trim().min(1, 'Enter the owner name.').max(100, 'Keep the name under 100 characters.'),
  primaryPhone: phoneSchema,
  secondaryPhone: phoneSchema,
  address: z.string().trim().max(240, 'Keep the address under 240 characters.'),
});
type ProfileFormValues = z.infer<typeof profileSchema>;
type BusinessProfileSettingsProps = {
  profile: BusinessProfile;
  onSave: (profile: BusinessProfile) => boolean;
};

const formPhone = (value: string) => nationalPhoneDigits(value);

export default function BusinessProfileSettings({ profile, onSave }: BusinessProfileSettingsProps) {
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      ownerName: profile.ownerName,
      primaryPhone: formPhone(profile.primaryPhone),
      secondaryPhone: formPhone(profile.secondaryPhone),
      address: profile.address,
    },
  });
  const preview = form.watch();

  function submit(values: ProfileFormValues) {
    const saved = onSave({
      ownerName: values.ownerName.trim(),
      primaryPhone: formatIndianPhone(values.primaryPhone),
      secondaryPhone: formatIndianPhone(values.secondaryPhone),
      address: values.address.trim(),
    });
    setStatus(saved
      ? { kind: 'success', text: 'Business profile saved on this device. New bills will use these details.' }
      : { kind: 'error', text: 'Could not save to this device. Check browser storage and try again.' });
  }

  const primaryPhone = formatIndianPhone(preview.primaryPhone || '');
  const secondaryPhone = formatIndianPhone(preview.secondaryPhone || '');

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">Farm settings</span><h1>Business profile</h1><p>Update the owner and contact details printed on new bills and invoices.</p></div>
      <span className="date-tag"><Settings2 size={15} /> Saved on this device</span>
    </div>

    <div className="profile-settings-grid">
      <Form {...form}><form className="panel form-card profile-glass-card" onSubmit={form.handleSubmit(submit)} noValidate data-testid="form-business-profile">
        <div className="profile-card-heading"><span className="profile-icon"><UserRound size={18} /></span><div><span className="eyebrow">Owner details</span><h2>Business information</h2></div></div>
        <FormField control={form.control} name="ownerName" render={({ field }) => <FormItem className="form-field">
          <FormLabel>Owner Name *</FormLabel>
          <FormControl><input {...field} autoComplete="name" maxLength={100} placeholder="RAJSHAH POULTRY FARM / Owner" data-testid="input-business-owner-name" /></FormControl>
          <FormMessage />
        </FormItem>} />
        <div className="form-grid">
          <FormField control={form.control} name="primaryPhone" render={({ field }) => <FormItem className="form-field">
            <FormLabel>Primary Phone Number</FormLabel>
            <div className="profile-phone-control"><span aria-hidden="true">+91</span><FormControl><input ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value} onChange={(event) => field.onChange(nationalPhoneDigits(event.target.value))} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16} placeholder="98765 43210" data-testid="input-business-primary-phone" /></FormControl></div>
            <FormMessage />
          </FormItem>} />
          <FormField control={form.control} name="secondaryPhone" render={({ field }) => <FormItem className="form-field">
            <FormLabel>Secondary Phone / WhatsApp</FormLabel>
            <div className="profile-phone-control"><span aria-hidden="true">+91</span><FormControl><input ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value} onChange={(event) => field.onChange(nationalPhoneDigits(event.target.value))} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16} placeholder="Alternate contact" data-testid="input-business-secondary-phone" /></FormControl></div>
            <FormMessage />
          </FormItem>} />
        </div>
        <FormField control={form.control} name="address" render={({ field }) => <FormItem className="form-field">
          <FormLabel>Farm / Business Address</FormLabel>
          <FormControl><textarea {...field} maxLength={240} rows={3} placeholder="Street, area, city, state, PIN code" data-testid="input-business-address" /></FormControl>
          <FormMessage />
        </FormItem>} />
        {status && <p className={status.kind === 'success' ? 'notice profile-status' : 'error-state profile-status'} role={status.kind === 'success' ? 'status' : 'alert'} data-testid={`status-business-profile-${status.kind}`}>{status.text}</p>}
        <div className="form-actions"><button className="primary-button" type="submit" data-testid="button-save-business-profile"><Check size={16} /> Save business profile</button></div>
      </form></Form>

      <aside className="panel profile-preview-card profile-glass-card" aria-live="polite" data-testid="panel-business-profile-preview">
        <div className="profile-preview-top"><span className="profile-icon"><MapPin size={18} /></span><span className="eyebrow">Invoice preview</span></div>
        <div className="profile-preview-mark"><Phone size={16} /><span>RAJSHAH POULTRY FARM</span></div>
        <h2 data-testid="preview-business-owner">{preview.ownerName || profile.ownerName}</h2>
        <div className="profile-preview-details">
          <p><b>Primary</b><span data-testid="preview-business-primary-phone">{primaryPhone || 'Not added yet'}</span></p>
          <p><b>Alternate / WhatsApp</b><span data-testid="preview-business-secondary-phone">{secondaryPhone || 'Not added yet'}</span></p>
          <p><b>Address</b><span data-testid="preview-business-address">{preview.address?.trim() || 'Not added yet'}</span></p>
        </div>
        <small>These details appear on new receipts and WhatsApp invoices.</small>
      </aside>
    </div>
  </>;
}
