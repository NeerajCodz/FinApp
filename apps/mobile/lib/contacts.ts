import { presentContactPickerAsync, type ExistingContact } from 'expo-contacts/legacy';

export type DeviceContact = {
  name: string;
  phone: string;
};

export function normalizeContactPhone(phone: string): string {
  return phone.replace(/[\s().-]/g, '');
}

export function mapPickedContact(
  contact: Pick<ExistingContact, 'name' | 'phoneNumbers'>,
): DeviceContact | null {
  const phone = contact.phoneNumbers?.find((item) => item.number)?.number;
  if (!phone) return null;

  return {
    name: contact.name.trim() || 'Unnamed contact',
    phone: normalizeContactPhone(phone),
  };
}

export async function pickDeviceContact(): Promise<DeviceContact | null> {
  try {
    const contact = await presentContactPickerAsync();
    return contact ? mapPickedContact(contact) : null;
  } catch {
    // Some platforms or native runtimes do not provide the system picker.
    return null;
  }
}
