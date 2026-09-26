import { describe, expect, it, vi } from 'vitest';
import { mapPickedContact } from '../../apps/mobile/lib/contacts';

vi.mock('expo-contacts/legacy', () => ({ presentContactPickerAsync: vi.fn() }));

describe('selected device contacts', () => {
  it('keeps only the selected contact name and normalized phone', () => {
    expect(
      mapPickedContact({
        name: '  Sam Rivera  ',
        phoneNumbers: [
          { label: 'mobile', number: '+1 (415) 555-0100' },
          { label: 'home', number: '+1 415 555 0101' },
        ],
      }),
    ).toEqual({ name: 'Sam Rivera', phone: '+14155550100' });
  });

  it('ignores a selected contact without a phone number', () => {
    expect(mapPickedContact({ name: 'Sam Rivera', phoneNumbers: [] })).toBeNull();
  });
});
