import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

export function GiphySelector({ onSelect }: { onSelect: (url: string) => void }) {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchGifs = async (searchQuery: string) => {
        setLoading(true);
        try {
            const url = searchQuery.trim()
                ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=12&rating=g`
                : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12&rating=g`;
            const res = await fetch(url);
            const data = await res.json();
            setGifs(data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch on mount (Trending)
    useEffect(() => {
        fetchGifs('');
    }, []);

    // Debounced Search on Change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                fetchGifs(query);
            } else {
                fetchGifs(''); // Load trending if cleared
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="w-80 p-3 bg-white shadow-xl rounded-xl border border-gray-100">
            <div className="mb-3">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Pesquisar GIFs em GIPHY"
                    className="w-full text-sm p-2 bg-gray-100 border-transparent rounded-lg focus:ring-0 focus:border-transparent focus:bg-gray-200 focus:outline-none transition-colors"
                    autoFocus
                />
            </div>
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin w-5 h-5 text-gray-500" /></div>
            ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {gifs.map(g => (
                        <div key={g.id} className="relative aspect-video group rounded-md overflow-hidden bg-gray-100">
                            <img
                                src={g.images.fixed_width.url}
                                alt={g.title}
                                className="cursor-pointer object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                                onClick={(e) => { e.preventDefault(); onSelect(g.images.downsized_medium?.url || g.images.original.url); }}
                            />
                        </div>
                    ))}
                    {!loading && gifs.length === 0 && (
                        <div className="col-span-2 text-center text-sm text-gray-500 py-4">
                            Nenhum GIF encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
