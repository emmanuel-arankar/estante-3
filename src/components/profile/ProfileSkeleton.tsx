import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const ProfileSkeleton = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start space-y-6 md:space-y-0 md:space-x-8">
            {/* Avatar Skeleton */}
            <Skeleton className="h-32 w-32 rounded-full" />

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                {/* User Info Skeleton */}
                <div className="space-y-2">
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="h-5 w-32" />
                </div>
                {/* Action Button Skeleton */}
                <Skeleton className="h-9 w-36 rounded-full mt-4 md:mt-0" />
              </div>
              
              {/* Bio Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              
              {/* Meta Skeleton */}
              <div className="space-y-3 mt-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-52" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Skeleton */}
      <div>
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="books">Livros</TabsTrigger>
            <TabsTrigger value="reviews">Resenhas</TabsTrigger>
            <TabsTrigger value="friends">Amigos</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content Skeleton */}
      <div className="mt-6 text-center py-8">
        <Skeleton className="h-8 w-48 mx-auto" />
      </div>
    </div>
  );
};