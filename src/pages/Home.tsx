import { memo } from 'react';
import { PageMetadata } from '@/common/PageMetadata';
import { Hero } from '@/components/home/Hero';

const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'url': 'https://URL_DO_SEU_SITE/',
  'name': 'Estante de Bolso',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': 'https://URL_DO_SEU_SITE/search?q={search_term_string}',
    'query-input': 'required name=search_term_string'
  }
};

/**
 * Home page component representing the landing page.
 * Wrapped in React.memo and uses hoisted SITE_SCHEMA constant to avoid
 * re-allocating schema objects and unnecessary re-renders during layout updates.
 */
export const Home = memo(() => {
  return (
    <>
      <PageMetadata
        title="Sua rede social de leitura"
        description="Conecte-se com leitores, organize suas estantes, descubra novos livros e compartilhe suas paixões literárias. Junte-se à comunidade Estante de Bolso!"
        ogTitle="Estante de Bolso"
        ogDescription="Sua rede social de leitura"
        schema={SITE_SCHEMA}
      />

      <main>
        <Hero />
      </main>
    </>
  );
});

Home.displayName = 'Home';
