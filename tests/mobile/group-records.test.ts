import { describe, expect, it } from 'vitest';
import { mergeGroupRecords } from '../../apps/mobile/lib/groupRecords';

describe('mobile group records', () => {
  it('includes cloud memberships before the local group cache hydrates', () => {
    const groups = mergeGroupRecords(
      [],
      [
        { _id: 'cloud-group-one', name: 'Weekend trip' },
        { _id: 'cloud-group-two', name: 'Housemates' },
        { _id: 'cloud-group-three', name: 'Study group' },
      ],
    );

    expect(groups.map((group) => group.name)).toEqual([
      'Weekend trip',
      'Housemates',
      'Study group',
    ]);
    expect(groups.map((group) => group.cloudId)).toEqual([
      'cloud-group-one',
      'cloud-group-two',
      'cloud-group-three',
    ]);
  });

  it('merges matching cache records and excludes archived local groups', () => {
    const groups = mergeGroupRecords(
      [
        { id: 'local-group-one', cloudId: 'cloud-group-one', name: 'Cached name' },
        { id: 'local-archived', name: 'Archived group', archivedAt: 10 },
      ],
      [{ _id: 'cloud-group-one', name: 'Current name' }],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'local-group-one',
      cloudId: 'cloud-group-one',
      name: 'Current name',
    });
  });
});
