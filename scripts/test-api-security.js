
const projectId = 'estante-virtual-805ef';
const region = 'us-central1';
const baseUrl = `http://127.0.0.1:5001/${projectId}/${region}/api`;

console.log(`\n🔒 Iniciando Teste de Segurança da API`);
console.log(`📡 URL Alvo: ${baseUrl}\n`);

async function testEndpoint(name, path, options = {}) {
    const url = `${baseUrl}${path}`;
    console.log(`[${name}] Testando: ${path}`);
    try {
        const res = await fetch(url, options);
        console.log(`   Status: ${res.status} ${res.statusText}`);

        if (res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            // Truncate long responses
            const preview = JSON.stringify(data).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : '');
            console.log(`   Resposta: ${preview}`);
        } else {
            console.log(`   Resposta: (Non-JSON) ${await res.text()}`);
        }

        return res.status;
    } catch (err) {
        console.error(`   ❌ Erro de conexão: ${err.message}`);
        console.log(`   Dica: Verifique se o emulador do Firebase está rodando (npm run serve).`);
        return 0;
    }
}

async function runTests() {
    // 1. Teste da rota pública (Health)
    console.log(`\n--- Teste 1: Rota Pública (Health) ---`);
    await testEndpoint('HEALTH', '/health');
    console.log(`✅ Esperado: 200 OK (Qualquer um pode acessar para verificar se o servidor está on)`);

    // 2. Teste de rota protegida SEM credenciais (Find Friends)
    console.log(`\n--- Teste 2: Rota Protegida sem Login (Find Friends) ---`);
    const status = await testEndpoint('SECURED_ROUTE', '/findFriends?searchTerm=teste');

    if (status === 401) {
        console.log(`✅ SUCESSO: A API bloqueou o acesso não autorizado! (Esperado 401)`);
    } else if (status === 200) {
        console.log(`⚠️ PERIGO: A API permitiu acesso sem login! (Inesperado)`);
    } else {
        console.log(`ℹ️ Outro status recebido.`);
    }

    console.log(`\n\n--- RESUMO PARA O DESENVOLVEDOR ---`);
    console.log(`1. Se você consegue fazer requisições via script/Postman, é porque Ferramentas de desenvolvimento ignoram CORS.`);
    console.log(`2. O que impede o acesso real é o status 401 (Unauthorized) que vimos no Teste 2.`);
    console.log(`3. CORS só serve para impedir que OUTROS SITES (ex: site-malicioso.com) chamem sua API pelo navegador da vítima.`);
    console.log(`4. Sua API está segura se as rotas sensíveis retornarem 401 quando sem cookie.`);
}

runTests();
