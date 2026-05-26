import { CSSProperties, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Users, Star, TrendingUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Isolated SearchBar component to prevent full Hero re-renders on every keystroke.
 * This improves performance by keeping expensive animations and stats static while typing.
 */
const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <form onSubmit={handleSearch}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="O que você está procurando? Digite título, autor, ISBN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 pr-4 py-4 w-full bg-white/90 text-gray-900 border-0 rounded-full text-lg shadow-lg focus:bg-white focus:ring-2 focus:ring-yellow-400"
        />
      </div>
    </form>
  );
};

export const Hero = () => {
  // Memoize random properties for background elements to prevent visual jitter
  // and redundant calculations on re-renders.
  const backgroundElements = useMemo(() =>
    [...Array(20)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 2,
    })), []);

  return (
    <section className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white overflow-hidden min-h-[calc(100vh-5rem)] flex items-center">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-black/10">
        {backgroundElements.map((el) => (
          <motion.div
            key={el.id}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            style={{
              left: el.left,
              top: el.top,
            } as CSSProperties}
            animate={{
              y: [0, -100, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: el.duration,
              repeat: Infinity,
              delay: el.delay,
            }} 
          />
        ))}
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12 text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Descubra, compartilhe e 
              <br />
              <span className="text-yellow-300">colecione seus livros favoritos</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-emerald-100">
              Sua biblioteca pessoal que cabe na palma da mão
            </p>
          </motion.div>

          {/* Search Bar - Isolated state to prevent Hero re-renders on keystrokes */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-16 w-full max-w-3xl mx-auto"
          >
            <SearchBar />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <BookOpen className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold">+50M</div>
              <div className="text-sm text-emerald-100">Livros cadastrados</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Users className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold">+10M</div>
              <div className="text-sm text-emerald-100">Usuários</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold">+25M</div>
              <div className="text-sm text-emerald-100">Resenhas</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <TrendingUp className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold">95%</div>
              <div className="text-sm text-emerald-100">Satisfação</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
