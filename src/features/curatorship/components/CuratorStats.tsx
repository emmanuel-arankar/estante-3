import { useQueries } from '@tanstack/react-query';
import { listSuggestionsAdminAPI } from '@/features/books/services/suggestionsApi';
import { Clock, CheckCircle, XCircle, TrendingUp, BarChart2 } from 'lucide-react';

function StatCard({
    icon: Icon,
    label,
    value,
    subLabel,
    color,
    loading,
}: {
    icon: React.ElementType;
    label: string;
    value: number | string;
    subLabel?: string;
    color: 'amber' | 'emerald' | 'red' | 'blue' | 'gray';
    loading: boolean;
}) {
    const colorMap = {
        amber: {
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            badge: 'bg-amber-100 text-amber-700',
            value: 'text-amber-700',
        },
        emerald: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            badge: 'bg-emerald-100 text-emerald-700',
            value: 'text-emerald-700',
        },
        red: {
            bg: 'bg-red-50',
            text: 'text-red-500',
            badge: 'bg-red-100 text-red-600',
            value: 'text-red-600',
        },
        blue: {
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            badge: 'bg-blue-100 text-blue-700',
            value: 'text-blue-700',
        },
        gray: {
            bg: 'bg-gray-50',
            text: 'text-gray-500',
            badge: 'bg-gray-100 text-gray-600',
            value: 'text-gray-700',
        },
    };
    const c = colorMap[color];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                {subLabel && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                        {subLabel}
                    </span>
                )}
            </div>
            <div>
                {loading ? (
                    <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                    <p className={`text-3xl font-bold leading-none ${c.value}`}>{value}</p>
                )}
                <p className="text-xs text-gray-500 font-medium mt-1.5">{label}</p>
            </div>
        </div>
    );
}

export function CuratorStats() {
    const results = useQueries({
        queries: [
            {
                queryKey: ['stats-pending'],
                queryFn: () => listSuggestionsAdminAPI({ status: 'pending', limit: 1 }),
                staleTime: 60_000,
            },
            {
                queryKey: ['stats-approved'],
                queryFn: () => listSuggestionsAdminAPI({ status: 'approved', limit: 1 }),
                staleTime: 60_000,
            },
            {
                queryKey: ['stats-rejected'],
                queryFn: () => listSuggestionsAdminAPI({ status: 'rejected', limit: 1 }),
                staleTime: 60_000,
            },
            {
                queryKey: ['stats-all'],
                queryFn: () => listSuggestionsAdminAPI({ status: 'all', limit: 1 }),
                staleTime: 60_000,
            },
        ],
    });

    const [pendingQ, approvedQ, rejectedQ, allQ] = results;

    const pending = pendingQ.data?.pagination?.total ?? 0;
    const approved = approvedQ.data?.pagination?.total ?? 0;
    const rejected = rejectedQ.data?.pagination?.total ?? 0;
    const total = allQ.data?.pagination?.total ?? 0;

    const resolved = approved + rejected;
    const approvalRate = resolved > 0 ? Math.round((approved / resolved) * 100) : 0;

    const isLoading = results.some(r => r.isLoading);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
                icon={Clock}
                label="Aguardando revisão"
                value={pending}
                subLabel={pending > 0 ? 'Pendente' : undefined}
                color="amber"
                loading={isLoading}
            />
            <StatCard
                icon={CheckCircle}
                label="Sugestões aprovadas"
                value={approved}
                color="emerald"
                loading={isLoading}
            />
            <StatCard
                icon={XCircle}
                label="Sugestões rejeitadas"
                value={rejected}
                color="red"
                loading={isLoading}
            />
            <StatCard
                icon={pending > 0 ? BarChart2 : TrendingUp}
                label="Taxa de aprovação"
                value={`${approvalRate}%`}
                subLabel={`${total} total`}
                color="blue"
                loading={isLoading}
            />
        </div>
    );
}
