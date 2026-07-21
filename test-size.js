import fs from 'fs';
const text = fs.readFileSync('./js/storage.js', 'utf8');
const match = text.match(/const DEFAULT_COURSES = (\[[\s\S]*?\]);\s*export class StorageManager/);
if (match) {
  const jsonString = match[1];
  try {
    const fn = new Function('return ' + jsonString);
    const obj = fn();
    const str = JSON.stringify(obj);
    console.log('JSON Length:', str.length);
  } catch(e) {
    console.log('Parse error', e);
  }
} else {
  console.log('Not found');
}
