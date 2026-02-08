/**
 * Script para buscar dados de estados e cidades do IBGE
 * Gera arquivo JSON com estrutura otimizada para uso no frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ESTADOS_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados';

async function fetchEstados() {
  console.log('Buscando estados do IBGE...');
  const response = await fetch(ESTADOS_URL);
  const estados = await response.json();

  // Ordenar por nome
  return estados.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function fetchCidadesPorEstado(uf) {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const response = await fetch(url);
  const cidades = await response.json();

  // Ordenar por nome e retornar apenas nome
  return cidades
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(cidade => cidade.nome);
}

async function main() {
  try {
    // Buscar estados
    const estados = await fetchEstados();
    console.log(`✓ ${estados.length} estados encontrados`);

    // Buscar cidades de cada estado
    const locationData = {
      states: []
    };

    let totalCidades = 0;

    for (const estado of estados) {
      console.log(`Buscando cidades de ${estado.nome} (${estado.sigla})...`);
      const cidades = await fetchCidadesPorEstado(estado.sigla);

      locationData.states.push({
        name: estado.nome,
        code: estado.sigla,
        cities: cidades
      });

      totalCidades += cidades.length;
      console.log(`  ✓ ${cidades.length} cidades`);

      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✓ Total: ${estados.length} estados, ${totalCidades} cidades`);

    // Salvar arquivo
    const outputDir = path.join(__dirname, '..', 'src', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'brazil-locations.json');
    fs.writeFileSync(outputPath, JSON.stringify(locationData, null, 2));

    // Estatísticas do arquivo
    const stats = fs.statSync(outputPath);
    const sizeInKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✓ Arquivo salvo em: ${outputPath}`);
    console.log(`✓ Tamanho: ${sizeInKB} KB`);

  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

main();
