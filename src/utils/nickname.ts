import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';
import slugify from 'slugify';

// Função para gerar nickname baseado no nome do usuário
export const generateNickname = (displayName: string): string => {
  // Remove acentos e caracteres especiais, converte para lowercase
  const cleanName = slugify(displayName, {
    lower: true,
    strict: true,
    locale: 'pt'
  });

  // Se o nome limpo for muito curto, gera um nickname aleatório
  if (cleanName.length < 3) {
    return uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: '-',
      length: 2,
      style: 'lowerCase'
    });
  }

  // Pega a primeira parte do nome (primeiro nome)
  const firstName = cleanName.split('-')[0];
  
  // Gera um sufixo único baseado em cores ou animais
  const suffix = uniqueNamesGenerator({
    dictionaries: [colors, animals],
    separator: '',
    length: 1,
    style: 'lowerCase'
  });

  // Combina o primeiro nome com o sufixo
  return `${firstName}-${suffix}`;
};

// Função para verificar se nickname já existe
export const isNicknameAvailable = async (nickname: string): Promise<boolean> => {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('../services/firebase');
  
  const q = query(
    collection(db, 'users'),
    where('nickname', '==', nickname)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

// Função para gerar nickname único (tenta até encontrar um disponível)
export const generateUniqueNickname = async (displayName: string): Promise<string> => {
  let nickname = generateNickname(displayName);
  let counter = 1;
  
  // Tenta até 10 vezes encontrar um nickname único
  while (!(await isNicknameAvailable(nickname)) && counter <= 10) {
    const suffix = uniqueNamesGenerator({
      dictionaries: [colors, animals],
      separator: '',
      length: 1,
      style: 'lowerCase'
    });
    
    const firstName = slugify(displayName.split(' ')[0], {
      lower: true,
      strict: true,
      locale: 'pt'
    });
    
    nickname = `${firstName}-${suffix}-${counter}`;
    counter++;
  }
  
  return nickname;
};