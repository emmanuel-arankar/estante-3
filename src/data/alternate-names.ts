import alternateNameTypes from './alternate-name-type.json';
import scriptTypes from './script.json';

export function getAlternateNameTypeName(id: string): string {
    const type = alternateNameTypes.types.find(t => t.id === id);
    return type ? type.name : id;
}

export function getScriptName(id: string): string {
    const script = scriptTypes.scripts.find(s => s.id === id);
    return script ? script.name : id;
}
