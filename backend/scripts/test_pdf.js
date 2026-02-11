const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Is function?', typeof pdf === 'function');
console.log('Exports keys:', Object.keys(pdf));

if (typeof pdf !== 'function') {
    if (pdf.default && typeof pdf.default === 'function') {
        console.log('Found pdf.default function!');
    }
}
