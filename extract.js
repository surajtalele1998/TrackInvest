const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if(styleMatch) {
    fs.writeFileSync('style.css', styleMatch[1].trim());
    html = html.replace(styleMatch[0], '<link rel="stylesheet" href="./style.css">');
}

const scriptMatch = html.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/);
if(scriptMatch) {
    fs.writeFileSync('app.js', scriptMatch[1].trim());
    html = html.replace(scriptMatch[0], '<script src="./app.js"></script>');
}

fs.writeFileSync('index.html', html);
console.log('Extraction complete');
