import React from 'react';
import { useMatches, Link, UIMatch } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon, Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { itemVariants, SMOOTH_TRANSITION } from '@/lib/animations'; 
import { PATHS } from '@/router/paths';

interface BreadcrumbHandle {
  breadcrumb: (data?: any) => { label: string; icon?: React.ReactNode };
}

type MatchWithBreadcrumb = UIMatch & {
  handle: BreadcrumbHandle;
};

export const Breadcrumbs = () => {
  const matches = useMatches();
  const crumbs = matches
    .filter((match): match is MatchWithBreadcrumb =>
      Boolean(match.handle && typeof (match.handle as any).breadcrumb === 'function')
    )
    .map((match) => {
      const breadcrumbData = match.handle.breadcrumb(match.data);
      return {
        label: breadcrumbData.label,
        icon: breadcrumbData.icon,
        pathname: match.pathname,
      };
    });

  if (crumbs.length < 1) {
    return null;
  }

  return (
    <Breadcrumb className="hidden md:flex mt-4 mb-2">
      <BreadcrumbList>
        <AnimatePresence initial={false}>
          {/* Item Home (sem alteração) */}
          <motion.li
            key="home-breadcrumb"
            className="inline-flex items-center gap-1.5"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={SMOOTH_TRANSITION}
          >
            <BreadcrumbLink asChild>
              <Link to={PATHS.HOME} aria-label="Página Inicial" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
                <Home className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </motion.li>

          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <motion.li
                key={crumb.pathname}
                className="inline-flex items-center gap-1.5"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ ...SMOOTH_TRANSITION, delay: (index + 1) * 0.08 }}
              >
                {/* # atualizado: Substituímos o componente Separator pelo seu ícone para evitar o aninhamento de <li> */}
                <ChevronRightIcon className="h-3.5 w-3.5" />

                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-2 font-medium text-foreground px-2 py-1">
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.pathname} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">
                      {crumb.icon}
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </BreadcrumbList>
    </Breadcrumb>
  );
};
