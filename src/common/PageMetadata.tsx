import { Helmet as Head } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface PageMetadataProps {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  image?: string;
  noIndex?: boolean;
  schema?: object;
}

const SITE_URL = 'https://estante-virtual-805ef.web.app/';
const SITE_NAME = 'Estante de Bolso';
const DEFAULT_OG_IMAGE = `${SITE_URL}og-image.png`;
const TWITTER_HANDLE = '@EstanteDeBolso';

export const PageMetadata = ({ title, description, ogTitle, ogDescription, image, noIndex, schema }: PageMetadataProps) => {
  const location = useLocation();
  const canonicalUrl = `${SITE_URL}${location.pathname}`;

  const pageTitle = `${ogTitle || title} | ${SITE_NAME}`;
  const pageDescription = ogDescription || description;
  const pageImage = image || DEFAULT_OG_IMAGE;

  return (
    <Head>
      <title>{`${title} | ${SITE_NAME}`}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, follow" />}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:type" content="website" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />

      {/* Schema.org */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Head>
  );
};