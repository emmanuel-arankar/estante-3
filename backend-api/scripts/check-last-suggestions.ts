import { db } from '../src/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function checkLastSuggestions() {
    const outputPath = path.resolve('/tmp/suggestions_check.txt');
    let output = '';
    
    try {
        output += '--- Buscando as últimas 5 sugestões ---\n';
        const snapshot = await db.collection('contentSuggestions')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            output += 'Nenhuma sugestão encontrada.\n';
        } else {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                output += `ID: ${doc.id}\n`;
                output += `Type: ${data.type}\n`;
                output += `Status: ${data.status}\n`;
                output += `SuggestedBy: ${data.suggestedBy}\n`;
                output += `TargetEntityId: ${data.targetEntityId}\n`;
                output += `DataKeys: ${Object.keys(data.data || {}).join(', ')}\n`;
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

checkLastSuggestions();
