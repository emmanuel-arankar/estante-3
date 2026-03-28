import { db } from '../src/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function countEditions() {
    const workId = 'work_battle_royale';
    const outputPath = path.resolve('/tmp/editions_count.txt');
    
    try {
        const snapshot = await db.collection('editions')
            .where('workId', '==', workId)
            .get();

        let output = `WorkID: ${workId}\n`;
        output += `Total Edições: ${snapshot.size}\n`;
        output += '--- Detalhes ---\n';
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            output += `ID: ${doc.id} | Title: ${data.title} | ISBN13: ${data.isbn13} | CreatedAt: ${data.createdAt?.toDate?.() || data.createdAt}\n`;
        });
        
        fs.writeFileSync(outputPath, output);
        console.log(`✅ Resultado escrito em ${outputPath}`);
    } catch (error: any) {
        fs.writeFileSync(outputPath, `❌ Erro: ${error.message}`);
        process.exit(1);
    }
    process.exit(0);
}

countEditions();
