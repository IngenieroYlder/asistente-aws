const pdfLib = require('pdf-parse');
console.log('Keys:', Object.keys(pdfLib));

if (typeof pdfLib.PDFParse === 'function') {
    console.log('pdfLib.PDFParse is a function');
} else {
    console.log('pdfLib.PDFParse is ' + typeof pdfLib.PDFParse);
}

// Try to verify if it works like the main function
try {
    const dummyBuffer = Buffer.from('test'); 
    // Usually pdf-parse takes a buffer
    // But if PDFParse is a class, we might need new.
    console.log('PDFParse prototype:', pdfLib.PDFParse.prototype);
} catch(e) { console.log(e); }
