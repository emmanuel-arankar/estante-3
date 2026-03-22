import { ShieldAlert } from 'lucide-react';
import { curatorLoader } from '@/features/curatorship/curatorship.loaders';
import { CuratorDashboard } from '@/pages/CuratorDashboard';

export const loader = curatorLoader;

export function Component() {
  return <CuratorDashboard />;
}

Component.displayName = 'CuratorDashboardRoute';

export const handle = {
  id: 'curatorship-dashboard',
  title: () => 'Painel de Curadoria | Estante de Bolso',
  breadcrumb: () => ({
    label: 'Curadoria',
    icon: <ShieldAlert className="h-4 w-4" />,
  }),
};
