import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Unlock, Search } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
    toastSuccessClickable,
    toastErrorClickable
} from '@/components/ui/toast';
import {
    listBlockedUsersAPI,
    unblockUserAPI
} from '@/services/friendshipsApi';

export const BlockedUsers = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [unblockDialog, setUnblockDialog] = useState<{ isOpen: boolean; userId: string; userName: string }>({
        isOpen: false,
        userId: '',
        userName: ''
    });

    const { data: blockedUsers = [], isLoading, error } = useQuery({
        queryKey: ['blockedUsers'],
        queryFn: listBlockedUsersAPI,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });

    const filteredUsers = blockedUsers.filter(user =>
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nickname.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUnblock = async () => {
        const { userId, userName } = unblockDialog;
        setUnblockDialog({ isOpen: false, userId: '', userName: '' });

        setProcessingId(userId);
        try {
            await unblockUserAPI(userId);
            toastSuccessClickable(`${userName} foi desbloqueado.`);
            queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
            // Também invalidar amigos/buscas pois agora ele pode aparecer
            queryClient.invalidateQueries({ queryKey: ['friends'] });
        } catch (error) {
            console.error('Erro ao desbloquear:', error);
            toastErrorClickable('Erro ao desbloquear usuário.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <>
            <PageMetadata
                title="Usuários Bloqueados"
                description="Gerencie os usuários que você bloqueou."
                noIndex={true}
            />

            <main className="max-w-2xl mx-auto px-4 py-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center space-x-4 mb-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="rounded-full"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <CardTitle className="text-2xl">Usuários Bloqueados</CardTitle>
                                <CardDescription>
                                    Usuários bloqueados não podem ver seu perfil ou enviar mensagens.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar usuário bloqueado..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 rounded-full"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <LoadingSpinner />
                            </div>
                        ) : error ? (
                            <div className="text-center py-8 text-red-500">
                                Erro ao carregar lista. Tente novamente.
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                {searchTerm ? 'Nenhum usuário encontrado.' : 'Você não bloqueou ninguém.'}
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {filteredUsers.map((user) => (
                                    <li key={user.id} className="flex items-center justify-between py-4">
                                        <div className="flex items-center space-x-3">
                                            <OptimizedAvatar
                                                src={user.photoURL || undefined}
                                                alt={user.displayName}
                                                fallback={user.displayName}
                                                size="md"
                                            />
                                            <div>
                                                <p className="font-medium text-gray-900">{user.displayName}</p>
                                                <p className="text-sm text-gray-500">@{user.nickname}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setUnblockDialog({ isOpen: true, userId: user.id, userName: user.displayName })}
                                            disabled={!!processingId}
                                            className="text-gray-600 hover:text-emerald-600 hover:border-emerald-200"
                                        >
                                            {processingId === user.id ? (
                                                <LoadingSpinner size="sm" />
                                            ) : (
                                                <>
                                                    <Unlock className="h-4 w-4 mr-2" />
                                                    Desbloquear
                                                </>
                                            )}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* Dialog de confirmação para desbloquear */}
            <AlertDialog open={unblockDialog.isOpen} onOpenChange={(isOpen) => setUnblockDialog({ ...unblockDialog, isOpen })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desbloquear usuário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja desbloquear {unblockDialog.userName}? Você poderá enviar solicitação de amizade novamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!processingId}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUnblock}
                            disabled={!!processingId}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {processingId ? 'Desbloqueando...' : 'Desbloquear'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
