import { db } from '../src/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function getSuggestionDetails() {
    const id = 'YPYGHcMYjpqBNlFnTveB';
    const outputPath = path.resolve('/tmp/suggestion_detail.txt');
    
    try {
        const doc = await db.collection('contentSuggestions').doc(id).get();
        if (!doc.exists) {
            fs.writeFileSync(outputPath, 'Sugestão não encontrada.');
            return;
        }

        const data = doc.data()!;
        const output = JSON.stringify(data, null, 2);
        
        fs.writeFileSync(outputPath, output);
        console.log(`✅ Resultado escrito em ${outputPath}`);
    } catch (error: any) {
        fs.writeFileSync(outputPath, `❌ Erro: ${error.message}`);
        process.exit(1);
    }
    process.exit(0);
}

getSuggestionDetails();
