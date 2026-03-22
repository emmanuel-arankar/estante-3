import React from 'react';
import { Link } from 'react-router-dom';
import { EditionContributor } from '@estante/common-types';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PATHS } from '@/router/paths';

interface ContributorsListProps {
  contributors: EditionContributor[];
  className?: string;
}

const formatRole = (role: string) => {
  const roles: Record<string, string> = {
    'author': 'Autor',
    'co-author': 'Co-autor',
    'translator': 'Tradutor',
    'illustrator': 'Ilustrador',
    'cover-artist': 'Capa',
    'editor': 'Editor',
    'proofreader': 'Revisor de Provas',
    'preface': 'Prefácio',
    'postface': 'Posfácio',
    'epilogue': 'Epílogo',
    'narrator': 'Narrador',
    'revisor': 'Revisor'
  };
  return roles[role] || role;
};

export const ContributorsList: React.FC<ContributorsListProps> = ({ contributors, className }) => {
  if (!contributors || contributors.length === 0) return null;

  // Separar autores principais dos outros
  const mainAuthors = contributors.filter(c => c.role === 'author' || c.role === 'co-author');
  const translators = contributors.filter(c => c.role === 'translator');
  const others = contributors.filter(c => c.role !== 'author' && c.role !== 'co-author' && c.role !== 'translator');

  const sections = [
    { title: 'Autores', data: mainAuthors },
    { title: 'Tradução', data: translators },
    { title: 'Outras Contribuições', data: others }
  ].filter(s => s.data.length > 0);

  return (
    <div className={className}>
      {sections.map((section, idx) => (
        <div key={idx} className="mb-6 last:mb-0">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            {section.title}
          </h3>
          <div className="flex flex-col gap-3">
            {section.data.map((contributor, i) => {
              const id = contributor.personId || contributor.groupId;
              const isGroup = !!contributor.groupId;
              const url = id
                ? (isGroup ? PATHS.GROUP({ groupId: id }) : PATHS.AUTHOR({ personId: id }))
                : '#';

              return (
                <Link
                  key={i}
                  to={url}
                  className="flex items-center gap-3 group"
                >
                  <OptimizedAvatar
                    src={contributor.photoUrl || ""}
                    alt={contributor.name}
                    fallback={contributor.name.charAt(0).toUpperCase()}
                    size="md"
                    className="ring-2 ring-transparent group-hover:ring-indigo-100 transition-all"
                  />
                  <div>
                    <p className={`text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors`}>
                      {contributor.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRole(contributor.role)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
