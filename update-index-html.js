const fs = require('fs');
const path = require('path');

// Get the argument (devo or prod) from the command line
const mode = process.argv[2];

if (!mode || (mode !== 'devo' && mode !== 'prod')) {
    console.error('Error: Please specify "devo" or "prod" as an argument.');
    process.exit(1);
}

const filePath = path.join(__dirname, 'public', 'index.html');

try {
    let htmlContent = fs.readFileSync(filePath, 'utf8');

    if (mode === 'devo') {
        // Replace the prod script with the devo script
        htmlContent = htmlContent.replace(
            /<script src="https:\/\/shiqi-614.github.io\/ergogen\/ergogen\.js"><\/script>/,
            '<script src="%PUBLIC_URL%/dependencies/ergogen.js"></script>'
        );
    } else if (mode === 'prod') {
        // Replace the devo script with the prod script
        htmlContent = htmlContent.replace(
            /<script src="%PUBLIC_URL%\/dependencies\/ergogen\.js"><\/script>/,
            '<script src="https://shiqi-614.github.io/ergogen/ergogen.js"></script>'
        );
    }

    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`public/index.html updated successfully for mode: ${mode}`);
} catch (error) {
    console.error('Error updating public/index.html:', error);
}
