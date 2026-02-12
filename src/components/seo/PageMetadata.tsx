import { Helmet } from 'react-helmet-async';

interface PageMetadataProps {
    title: string;
    description?: string;
}

export const PageMetadata = ({ title, description }: PageMetadataProps) => {
    return (
        <Helmet>
            <title>{title} | Estante de Bolso</title>
            {description && <meta name="description" content={description} />}
        </Helmet>
    );
};
