import { db } from '../src/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function checkLastEditions() {
    const outputPath = path.resolve('/tmp/editions_check.txt');
    let output = '';
    
    try {
        output += '--- Buscando as últimas 5 edições ---\n';
        const snapshot = await db.collection('editions')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            output += 'Nenhuma edição encontrada.\n';
        } else {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                output += `ID: ${doc.id}\n`;
                output += `Title: ${data.title}\n`;
                output += `WorkID: ${data.workId}\n`;
                output += `ISBN13: ${data.isbn13}\n`;
                output += `CreatedAt: ${data.createdAt?.toDate?.() || data.createdAt}\n`;
                output += '-------------------------\n';
            });
        }
        
        fs.writeFileSync(outputPath, output);
        console.log(`✅ Resultado escrito em ${outputPath}`);
    } catch (error: any) {
        fs.writeFileSync(outputPath, `❌ Erro: ${error.message}`);
        process.exit(1);
    }
    process.exit(0);
}

checkLastEditions();
