const test1 = 'Texto a̶s̴s̶i̵m̵.';
console.log('Original:', test1);

// Zalgo normal remove apenas diacriticos agrupados > 4
const ZALGO_REGEX = /([\u0300-\u036F]){4,}/g;
console.log('Zalgo limit:', test1.replace(ZALGO_REGEX, '$1$1$1'));

// NFC normaliza os acentos legítimos (á -> \u00E1) em um só caractere, deixando os "sujos" flutuantes
const normalized = test1.normalize('NFC');
console.log('NFC Normalizado + All Combining Removed:', normalized.replace(/[\u0300-\u036F]/g, ''));

// Teste 2: Acentos normais PT-BR
const pt = 'João Cãmões áéíóú ÁÉÍÓÚ';
console.log('Original PT:', pt);
console.log('NFC PT Normalizado + All Combining Removed:', pt.normalize('NFC').replace(/[\u0300-\u036F]/g, ''));
