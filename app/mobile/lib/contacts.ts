import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';

export type DeviceContact = {
  id: string;
  name: string;
  phone?: string;
};

export function normalizeContactPhone(phone: string): string {
  return phone.replace(/[\s().-]/g, '');
}

export async function readDeviceContacts(limit = 60): Promise<DeviceContact[]> {
  const permission = await requestPermissionsAsync();
  if (!permission.granted) return [];
  const fields = [ContactField.FULL_NAME, ContactField.PHONES] as const;
  const contacts = await Contact.getAllDetails(fields, {
    limit,
    sortOrder: ContactsSortOrder.GivenName,
  });
  return contacts
    .map((contact) => ({
      id: contact.id,
      name: contact.fullName?.trim() || 'Unnamed contact',
      phone: contact.phones?.find((item) => item.number)?.number,
    }))
    .filter((contact) => contact.phone);
}
