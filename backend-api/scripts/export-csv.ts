import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Coleções para exportar
const COLLECTIONS_TO_EXPORT = ['users', 'books', 'friendships', 'notifications', 'searchTerms'];

const oldCredPath = path.resolve(__dirname, '..', 'oldServiceAccountKey.json');
const exportDir = path.resolve(__dirname, '..', '..', 'exports');

if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
}

// Função para carregar JSON e tratar a chave privada PEM
const loadConfig = (filePath: string) => {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (config.private_key) {
        config.private_key = config.private_key.replace(/\\n/g, '\n');
    }
    return config;
};

// Inicializar App Antigo
const oldApp = admin.initializeApp({
    credential: admin.credential.cert(loadConfig(oldCredPath)),
    projectId: 'estante-75463'
}, 'export-csv-project');

const db = oldApp.firestore();

// Pega fields de todos os docs pra criar o header CSV dinamicamente
async function getFields(collectionName: string) {
    const snapshot = await db.collection(collectionName).limit(300).get();
    const fields = new Set<string>();
    fields.add('id'); // ID sempre primeiro
    snapshot.docs.forEach(doc => {
        Object.keys(doc.data()).forEach(key => fields.add(key));
    });
    return Array.from(fields);
}

// Achatar JSON
function flatten(data: any): any {
    const result: any = {};
    for (const key in data) {
        const val = data[key];
        if (val && typeof val === 'object') {
            if (val._seconds !== undefined && val._nanoseconds !== undefined) {
                result[key] = new Date(val._seconds * 1000).toISOString();
            } else if (val.toDate && typeof val.toDate === 'function') {
                result[key] = val.toDate().toISOString();
            } else {
                result[key] = JSON.stringify(val);
            }
        } else {
            result[key] = val;
        }
    }
    return result;
}

function escapeCsv(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function exportCollection(collectionName: string) {
    console.log(`\n📦 Lendo coleção ${collectionName}...`);
    try {
        const querySnapshot = await db.collection(collectionName).get();
        if (querySnapshot.empty) {
            console.log(`Coleção ${collectionName} vazia no projeto antigo.`);
            return;
        }

        const fields = await getFields(collectionName);

        const lines: string[] = [];
        // Header
        lines.push(fields.map(escapeCsv).join(','));

        querySnapshot.docs.forEach(doc => {
            const flatData = flatten(doc.data());
            const rowStr = fields.map(f => {
                if (f === 'id') return escapeCsv(doc.id);
                return escapeCsv(flatData[f]);
            }).join(',');
            lines.push(rowStr);
        });

        const filePath = path.join(exportDir, `${collectionName}.csv`);
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log(`✅ ${lines.length - 1} registros salvos em: ${filePath}`);
    } catch (e) {
        console.error(`❌ Erro collection ${collectionName}:`, e);
    }
}

async function startExport() {
    console.log(`Iniciando exportação CSV...`);
    for (const col of COLLECTIONS_TO_EXPORT) {
        await exportCollection(col);
    }
    console.log('\n✅ Exportação finalizada! Verifique a pasta "exports" na raiz.');
}

startExport().then(() => process.exit(0)).catch(e => { console.error('Erro global:', e); process.exit(1); });
