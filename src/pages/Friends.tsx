import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { List, Grid, Users, UserPlus, Clock } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from '@/components/ui/toggle-group';
import { 
  Tabs, 
  TabsList,
  TabsTrigger 
} from '@/components/ui/tabs';
import { useDenormalizedFriends } from '@/hooks/useDenormalizedFriends';
import { SMOOTH_TRANSITION, tabContentVariants } from '@/lib/animations';

export const Friends = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();
  const location = useLocation();
  const { stats } = useDenormalizedFriends();
  
  const outletKey = location.pathname;

  const getCurrentTab = () => {
    const pathSegments = location.pathname.split('/');
    return pathSegments[2] || 'friends';
  };

  const handleTabChange = (tab: string) => {
    const path = tab === 'friends' ? '' : tab;
    navigate(path, { replace: true });
  };

  return (
    <>
      <PageMetadata
        title="Amigos"
        description="Gerencie seus amigos, aceite novas conexões e encontre outros leitores apaixonados na comunidade Estante de Bolso."
        ogTitle="Amigos na Estante de Bolso"
        ogDescription="Conecte-se com outros leitores."
      />
      
      <main className="min-h-[calc(100vh-80px)] bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Amigos</h1>
                <p className="text-gray-600">
                  Gerencie suas conexões
                </p>
              </div>
              
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(value) => {
                  if (value) setViewMode(value as 'grid' | 'list');
                }}
                className="hidden md:flex bg-gray-100 rounded-md p-1"
              >
                <ToggleGroupItem value="grid" aria-label="Visualização em grade" className="data-[state=on]:bg-white data-[state=on]:shadow-sm data-[state=on]:text-emerald-600 px-3">
                  <Grid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Visualização em lista" className="data-[state=on]:bg-white data-[state=on]:shadow-sm data-[state=on]:text-emerald-600 px-3">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Tabs defaultValue={getCurrentTab()} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="friends" className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Amigos ({stats.totalFriends})</span>
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex items-center space-x-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Solicitações ({stats.pendingRequests})</span>
                </TabsTrigger>
                <TabsTrigger value="sent" className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Enviadas ({stats.sentRequests})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="mt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={outletKey}
                  variants={tabContentVariants} // # atualizado
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={SMOOTH_TRANSITION} // # atualizado
                >
                  <Outlet context={{ viewMode }} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};