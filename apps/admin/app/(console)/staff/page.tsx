'use client';

import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { Button } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { Empty, Loading, PageHeader, Panel, Pill, RoleChip, UserCell } from '@/components/ui';
import { useCan } from '@/lib/admin';
import { errorText, timeAgo } from '@/lib/format';

export default function StaffPage() {
  const staff = useQuery(api.admin.roles.listStaff, {});
  const removeStaff = useMutation(api.admin.roles.removeStaff);
  const can = useCan();
  const canEdit = can('ASSIGN_ROLES') || can('MANAGE_ROLES');
  return (
    <>
      <PageHeader
        title="Staff"
        description="Everyone with a staff role, highest role first. Assign roles on the Roles page."
      />
      <Panel>
        {!staff ? (
          <Loading />
        ) : staff.length === 0 ? (
          <Empty>No staff yet.</Empty>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Roles</th>
                  <th>Last active</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <UserCell user={member.user} link={can('VIEW_USERS')} />
                    </td>
                    <td>
                      <span className="admin-actions">
                        {member.owner ? <Pill tone="accent">owner</Pill> : null}
                        {member.roles.map((role) => (
                          <RoleChip key={role.id} role={role} />
                        ))}
                      </span>
                    </td>
                    <td>{timeAgo(member.lastActiveAt)}</td>
                    {canEdit ? (
                      <td>
                        {member.editable && !member.owner && member.user ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={async () => {
                              if (!member.user) return;
                              if (!window.confirm(`Remove ${member.user.displayName} from staff?`))
                                return;
                              try {
                                await removeStaff({ userId: member.user.id });
                                toast.success('Removed from staff');
                              } catch (cause) {
                                toast.error(errorText(cause));
                              }
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
