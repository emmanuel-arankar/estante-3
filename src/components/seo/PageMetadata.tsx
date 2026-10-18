import React from 'react';
import { Helmet } from 'react-helmet-async';

interface PageMetadataProps {
    title: string;
    description?: string;
}

/**
 * Performance Optimization:
 * PageMetadata is wrapped in React.memo to prevent unnecessary re-evaluations
 * and DOM updates of head/meta tags when parent page components re-render
 * without changing title or description props.
 */
export const PageMetadata = React.memo(({ title, description }: PageMetadataProps) => {
    return (
        <Helmet>
            <title>{title} | Estante de Bolso</title>
            {description && <meta name="description" content={description} />}
        </Helmet>
    );
});

PageMetadata.displayName = 'PageMetadata';
