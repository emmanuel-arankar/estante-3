import { useState } from 'react';
import { useNavigate, useLoaderData, Form, useNavigation } from 'react-router-dom';
import { ArrowLeft, Save, User, Link as LinkIcon, Check, X, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LocationSelector } from '@/components/ui/location-selector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PATHS } from '@/router/paths';
import { User as UserModel } from '@estante/common-types';
import { apiClient } from '@/services/api/apiClient';

const convertFirestoreDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date === 'object' && date.seconds) {
    return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
  }
  if (date instanceof Date) return date;
  const d = new Date(date);
  return !isNaN(d.getTime()) ? d : null;
}

export const EditProfile = () => {
  const profile = useLoaderData() as UserModel;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [nickname, setNickname] = useState(profile.nickname || '');
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(profile.nickname ? 'available' : 'idle');
  const [nicknameCheckTimeout, setNicknameCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const [bioContent, setBioContent] = useState(profile.bio || '');

  const date = convertFirestoreDate(profile.birthDate);
  const [birthDate, setBirthDate] = useState<Date | undefined>(date || undefined);
  const [dateInputValue, setDateInputValue] = useState(date ? format(date, "dd' / 'MM' / 'yyyy", { locale: ptBR }) : '');

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let value = rawValue.replace(/\D/g, '');

    // Se o usuário apagou tudo, resetamos os estados
    if (value.length === 0) {
      setDateInputValue('');
      setBirthDate(undefined);
      return;
    }

    if (value.length > 8) value = value.substring(0, 8);

    let formatted = '';
    if (value.length > 0) {
      formatted = value.substring(0, 2);
      if (value.length > 2) {
        formatted += ' / ' + value.substring(2, 4);
        if (value.length > 4) {
          formatted += ' / ' + value.substring(4, 8);
        }
      }
    }
    setDateInputValue(formatted);

    if (value.length === 8) {
      const day = parseInt(value.substring(0, 2));
      const month = parseInt(value.substring(2, 4)) - 1;
      const year = parseInt(value.substring(4, 8));
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && year >= 1900 && year <= new Date().getFullYear()) {
        setBirthDate(d);
      }
    }
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    setBirthDate(newDate);
    if (newDate) {
      setDateInputValue(format(newDate, "dd' / 'MM' / 'yyyy", { locale: ptBR }));
    } else {
      setDateInputValue('');
    }
  };

  // Parsear localização existente
  const locationData = profile.location;
  const defaultState = typeof locationData === 'object' ? locationData.state : undefined;
  const defaultCity = typeof locationData === 'object' ? locationData.city : undefined;

  const checkNicknameAvailability = async (newNickname: string): Promise<boolean> => {
    if (!newNickname || newNickname.length < 3) {
      setNicknameStatus('invalid');
      return false;
    }
    try {
      const data = await apiClient<{ available: boolean }>(`/users/check-nickname?nickname=${encodeURIComponent(newNickname)}`);
      if (!data.available) {
        // Não disponível, mas pode ser o próprio nickname do usuário
        return newNickname === profile.nickname;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^a-z0-9-_]/g, '').toLowerCase();
    setNickname(cleaned);

    if (nicknameCheckTimeout) clearTimeout(nicknameCheckTimeout);

    if (cleaned === profile.nickname) {
      setNicknameStatus('available');
      return;
    }
    if (!cleaned || cleaned.length < 3) {
      setNicknameStatus('invalid');
      return;
    }
    setNicknameStatus('checking');
    const timeout = setTimeout(async () => {
      const isAvailable = await checkNicknameAvailability(cleaned);
      setNicknameStatus(isAvailable ? 'available' : 'taken');
    }, 500);
    setNicknameCheckTimeout(timeout);
  };

  const getNicknameStatusIcon = () => {
    switch (nicknameStatus) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'taken':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getNicknameStatusMessage = () => {
    switch (nicknameStatus) {
      case 'invalid':
        return 'O apelido deve ter pelo menos 3 caracteres.';
      case 'taken':
        return 'Este apelido já está em uso.';
      default:
        return 'Somente letras minúsculas, números, - e _ são permitidos.';
    }
  };

  const getNicknameStatusColor = () => {
    switch (nicknameStatus) {
      case 'invalid':
      case 'taken':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  }



  return (
    <>
      <PageMetadata
        title="Editar Perfil"
        description="Atualize suas informações, foto e biografia na Estante de Bolso."
        ogTitle="Edite seu Perfil na Estante de Bolso"
        ogDescription="Mantenha seus dados atualizados para se conectar com outros leitores."
        noIndex={true}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle as="h1" className="text-2xl">
                Editar Perfil
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Form method="post" action={PATHS.PROFILE_EDIT} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium text-gray-700">Nome de Exibição</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="displayName" name="displayName" type="text" defaultValue={profile.displayName} className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm font-medium text-gray-700">Apelido (nome de usuário)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">@</span>
                  <Input id="nickname" name="nickname" type="text" value={nickname} onChange={handleNicknameChange} className="pl-7 pr-10" required />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {getNicknameStatusIcon()}
                  </div>
                </div>
                <p className={`text-xs ${getNicknameStatusColor()}`}>{getNicknameStatusMessage()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Bio</label>
                <input type="hidden" name="bio" value={bioContent} />
                <RichTextEditor value={bioContent} onChange={setBioContent} maxLength={500} variant="minimal" />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">Data de Nascimento</label>
                  <div className="relative w-full sm:w-[calc(50%-0.5rem)]">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute left-0 top-0 bottom-0 px-3 z-20 flex items-center justify-center transition-colors group"
                          title="Abrir calendário"
                        >
                          <CalendarIcon className="h-4 w-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={birthDate}
                          onSelect={handleDateSelect}
                          defaultMonth={birthDate}
                          initialFocus
                          locale={ptBR}
                          captionLayout="dropdown-buttons"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      placeholder="DD / MM / AAAA"
                      value={dateInputValue}
                      onChange={handleDateInputChange}
                      className={cn(
                        "pl-10 font-normal relative z-10",
                        !birthDate && "text-muted-foreground"
                      )}
                    />
                  </div>
                  {birthDate && (
                    <>
                      <input type="hidden" name="birthYear" value={birthDate.getFullYear().toString()} />
                      <input type="hidden" name="birthMonth" value={(birthDate.getMonth() + 1).toString()} />
                      <input type="hidden" name="birthDay" value={birthDate.getDate().toString()} />
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <LocationSelector
                    defaultState={defaultState}
                    defaultCity={defaultCity}
                    stateFieldName="locationState"
                    stateCodeFieldName="locationStateCode"
                    cityFieldName="locationCity"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="website" className="text-sm font-medium text-gray-700">Website</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="website" name="website" type="url" defaultValue={profile.website} className="pl-10" />
                </div>
              </div>

              <div className="flex space-x-4 pt-6">
                <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1 rounded-full">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || nicknameStatus !== 'available'} className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-full">
                  {isSubmitting ? <LoadingSpinner size="sm" /> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </main>
    </>
  );
};
