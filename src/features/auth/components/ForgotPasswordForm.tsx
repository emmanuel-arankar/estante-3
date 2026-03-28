import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { recoverPasswordAPI } from '@/features/auth/services/authApi';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
    toastSuccessClickable,
    toastErrorClickable
} from '@/components/ui/toast';
import { PATHS } from '@/router/paths';

const forgotPasswordSchema = z.object({
    email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordForm = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const form = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: '',
        },
    });

    const handleSubmit = async (data: ForgotPasswordFormData) => {
        setIsLoading(true);
        try {
            await recoverPasswordAPI(data.email);
            setEmailSent(true);
            toastSuccessClickable('Email de recuperação enviado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao enviar email:', error);
            const errorMessage = error.message || 'Erro ao enviar email. Tente novamente';
            toastErrorClickable(errorMessage);
            form.setError('email', { message: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    if (emailSent) {
        return (
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardContent className="p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="bg-emerald-100 p-4 rounded-full">
                            <CheckCircle className="h-12 w-12 text-emerald-600" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">
                            Email Enviado!
                        </h1>
                        <p className="text-gray-600 font-sans leading-relaxed">
                            Enviamos um link de recuperação para o seu email.
                            Verifique sua caixa de entrada e spam.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            asChild
                            className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-full font-sans shadow-md"
                        >
                            <Link to={PATHS.LOGIN}>
                                Voltar ao Login
                            </Link>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setEmailSent(false);
                                form.reset();
                            }}
                            className="w-full rounded-full font-sans"
                        >
                            Enviar Novamente
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="space-y-1">
                <div className="flex items-center space-x-2 mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                    >
                        <Link to={PATHS.LOGIN}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <CardTitle as="h1" className="text-2xl font-sans tracking-tight">
                        Recuperar Senha
                    </CardTitle>
                </div>
                <CardDescription className="text-center text-gray-600 font-sans leading-relaxed">
                    Digite seu email para receber o link de recuperação de acesso à sua conta.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                type="email"
                                placeholder="Seu email cadastrado"
                                className="pl-10 font-sans"
                                {...form.register('email')}
                            />
                        </div>
                        {form.formState.errors.email && (
                            <p className="text-xs text-red-600 ml-1 font-sans">
                                {form.formState.errors.email.message}
                            </p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-full font-sans shadow-md"
                        disabled={isLoading}
                    >
                        {isLoading ? <LoadingSpinner size="sm" /> : 'Enviar Link de Recuperação'}
                    </Button>
                </form>

                <div className="text-center text-sm pt-2">
                    <span className="text-gray-600 font-sans">Lembrou da senha? </span>
                    <Link to={PATHS.LOGIN} className="text-emerald-600 hover:text-emerald-700 font-medium font-sans hover:underline">
                        Fazer Login
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
};