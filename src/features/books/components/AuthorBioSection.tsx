import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { EditionContributor } from '@estante/common-types';
import { getPersonAPI, getGroupAPI } from '@/services/api/booksApi';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Link } from 'react-router-dom';
import { PATHS } from '@/router/paths';
import { ReadMore } from './ReadMore';

interface AuthorBioSectionProps {
  contributors: EditionContributor[];
}

export const AuthorBioSection: React.FC<AuthorBioSectionProps> = ({ contributors }) => {
  // Pegar o autor principal (primeiro com role 'author' ou 'co-author')
  const mainAuthor = contributors?.find(c => c.role === 'author' || c.role === 'co-author');

  if (!mainAuthor) return null;

  const isGroup = !!mainAuthor.groupId;
  const personId = mainAuthor.personId;
  const groupId = mainAuthor.groupId;

  // React Query v5 structure
  const personQuery = useQuery({
    queryKey: ['persons', personId],
    queryFn: () => getPersonAPI(personId!),
    enabled: !isGroup && !!personId,
    staleTime: 1000 * 60 * 60,
  });

  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => getGroupAPI(groupId!),
    enabled: isGroup && !!groupId,
    staleTime: 1000 * 60 * 60,
  });

  const authorData = isGroup ? groupQuery.data : personQuery.data;

  if (!authorData) return null;
  if (!authorData.bio && !authorData.photoUrl) return null;

  const id = isGroup ? groupId : personId;
  const url = id
    ? (isGroup ? PATHS.GROUP({ groupId: id }) : PATHS.AUTHOR({ personId: id }))
    : '#';

  return (
    <div className="mt-10 pt-10 border-t-2 border-gray-100">
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-left">
        Sobre {isGroup ? 'o grupo' : 'o autor'}
      </h3>

      <div className="flex gap-4 items-start">
        <Link to={url} className="flex-shrink-0">
          <OptimizedAvatar
            src={authorData.photoUrl || ""}
            alt={authorData.name}
            fallback={authorData.name.charAt(0).toUpperCase()}
            size="xl"
            className="rounded-full shadow-sm ring-1 ring-gray-100"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0">
            <Link to={url} className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors">
              {authorData.name}
            </Link>

            <button className="px-5 py-1.5 border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-xs font-bold rounded-full transition-all duration-300 hidden sm:block">
              Seguir
            </button>
          </div>

          <div className="text-[14px] font-medium text-gray-500 mb-0 flex items-center gap-2">
            <span>{authorData.worksCount || 0} {(authorData.worksCount || 0) === 1 ? 'livro publicado' : 'livros publicados'}</span>
            <span className="text-gray-300">•</span>
            <span>{authorData.followersCount || 0} seguidores</span>
          </div>

          <button className="w-full sm:hidden px-4 py-2 border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-xs font-bold rounded-full transition-all duration-300 mt-2 mb-3">
            Seguir
          </button>

          {authorData.bio ? (
            <div className="text-sm text-gray-700 leading-relaxed mt-4">
              <ReadMore html={authorData.bio} lines={4} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
