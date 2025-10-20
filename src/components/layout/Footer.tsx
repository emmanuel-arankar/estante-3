import { Link } from 'react-router-dom';
import { BookOpen, Facebook, Twitter, Instagram, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white w-full">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-blue-400" />
              <span className="text-xl font-bold">Estante de Bolso</span>
            </div>
            <p className="text-gray-400">
              A rede social brasileira para amantes da leitura. Compartilhe, descubra e conecte-se através dos livros.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Facebook className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Twitter className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Instagram className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Github className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Links Principais */}
          <div>
            <h3 className="font-semibold mb-4">Explorar</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link to="/books" className="hover:text-white">Livros</Link></li>
              <li><Link to="/authors" className="hover:text-white">Autores</Link></li>
              <li><Link to="/genres" className="hover:text-white">Gêneros</Link></li>
              <li><Link to="/reviews" className="hover:text-white">Resenhas</Link></li>
            </ul>
          </div>

          {/* Comunidade */}
          <div>
            <h3 className="font-semibold mb-4">Comunidade</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link to="/groups" className="hover:text-white">Grupos</Link></li>
              <li><Link to="/challenges" className="hover:text-white">Desafios</Link></li>
              <li><Link to="/events" className="hover:text-white">Eventos</Link></li>
              <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold mb-4">Newsletter</h3>
            <p className="text-gray-400 mb-4">
              Receba recomendações de livros e novidades da plataforma.
            </p>
            <div className="flex space-x-2">
              <Input
                type="email"
                placeholder="Seu e-mail"
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button className="bg-blue-600 hover:bg-blue-700">
                Inscrever
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; 2024 Estante de Bolso. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};