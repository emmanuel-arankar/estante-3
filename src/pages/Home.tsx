import { PageMetadata } from '@/common/PageMetadata';
import { Hero } from '@/components/home/Hero';

export const Home = () => {
  const siteSchema = {
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
  
  return (
    <>
      <PageMetadata
        title="Sua rede social de leitura"
        description="Conecte-se com leitores, organize suas estantes, descubra novos livros e compartilhe suas paixões literárias. Junte-se à comunidade Estante de Bolso!"
        ogTitle="Estante de Bolso"
        ogDescription="Sua rede social de leitura"
        schema={siteSchema}
      />

      <main>
        <Hero />
      </main>
    </>
  );
};