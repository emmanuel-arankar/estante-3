# 📚 Estante de Bolso

![Tests](https://github.com/emmanuel-arankar/estante-3/workflows/Tests/badge.svg)

Uma rede social brasileira para amantes da leitura, onde você pode organizar sua biblioteca pessoal, descobrir novos livros e se conectar com outros leitores.

## 🚀 Funcionalidades

### MVP (Versão Inicial)
- ✅ Autenticação com Firebase (Email/Password + Google)
- ✅ Feed social com infinite scroll
- ✅ Sistema de posts (status, resenhas, citações, discussões)
- ✅ Interface responsiva e moderna
- ✅ Componentes reutilizáveis com shadcn/ui

### Próximas Funcionalidades
- 📚 Catálogo de livros e estante virtual
- 💬 Chat em tempo real
- 🔔 Sistema de notificações
- ⭐ Avaliações e resenhas
- 📱 PWA (Progressive Web App)
- 🔍 Busca avançada
- 👥 Sistema de seguir/seguidores

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Roteamento**: React Router DOM
- **Estado**: Zustand
- **Formulários**: React Hook Form + Zod
- **Estilização**: Tailwind CSS + shadcn/ui
- **Animações**: Framer Motion
- **Autenticação**: Firebase Auth
- **Banco de dados**: Firebase Firestore
- **Armazenamento**: Firebase Storage
- **Ícones**: Lucide React
- **Datas**: date-fns

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Firebase

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/estante-bolso.git
cd estante-bolso
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o Firebase:
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
   - Ative Authentication (Email/Password + Google)
   - Ative Firestore Database
   - Ative Storage
   - Copie as configurações do Firebase

4. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

5. Preencha o arquivo `.env` com suas credenciais do Firebase:
```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
VITE_FIREBASE_DATABASE_URL=sua_database_url
```

6. Execute o projeto:
```bash
npm run dev
```

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── layout/         # Layout e navegação
│   ├── auth/           # Componentes de autenticação
│   ├── feed/           # Feed social
│   └── home/           # Página inicial
├── hooks/              # Custom hooks
├── models/             # Interfaces e tipos
├── pages/              # Páginas da aplicação
├── router/             # Configuração de rotas
├── services/           # Serviços (Firebase, APIs)
├── stores/             # Zustand stores
└── utils/              # Utilitários
```

## 🎨 Design System

O projeto utiliza um design system moderno e consistente:

- **Cores**: Paleta azul/roxo com tons neutros
- **Tipografia**: Inter como fonte principal
- **Espaçamento**: Sistema baseado em 8px
- **Componentes**: shadcn/ui para consistência
- **Animações**: Framer Motion para micro-interações

## 🔐 Autenticação

O sistema de autenticação suporta:
- Email e senha
- Login com Google
- Recuperação de senha
- Criação de perfil automática

## 📱 Responsividade

O aplicativo é totalmente responsivo e otimizado para:
- Mobile (320px+)
- Tablet (768px+)
- Desktop (1024px+)

## 🧪 Testes

Para executar os testes:
```bash
npm run test
```

## 🚀 Deploy

Para fazer o build de produção:
```bash
npm run build
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Contribuição

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](CONTRIBUTING.md) para mais informações.

## 📧 Contato

Para dúvidas ou sugestões, entre em contato:
- Email: contato@estantebolso.com.br
- Twitter: @estantebolso

---

Feito com ❤️ para a comunidade brasileira de leitores