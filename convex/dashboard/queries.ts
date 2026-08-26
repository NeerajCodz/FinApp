import { composeDashboard, type DashboardInput } from './domain';

export function getDashboard(input: DashboardInput) {
  return composeDashboard(input);
}
