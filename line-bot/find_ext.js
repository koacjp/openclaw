const fs = require('fs');
const path = require('path');

function findLineExtension() {
    const localAppData = process.env.LOCALAPPDATA;
    const chromePaths = [
        path.join(localAppData, 'Google/Chrome/User Data/Default/Extensions/ophjlpbeihpmininfpebackomocamaoe'),
        // プロファイル名が Default 以外の場合も考慮（Profile 1, Profile 2など）
        ...Array.from({length: 10}, (_, i) => path.join(localAppData, `Google/Chrome/User Data/Profile ${i+1}/Extensions/ophjlpbeihpmininfpebackomocamaoe`))
    ];

    for (const extPath of chromePaths) {
        if (fs.existsSync(extPath)) {
            const versions = fs.readdirSync(extPath);
            if (versions.length > 0) {
                return path.join(extPath, versions[versions.length - 1]);
            }
        }
    }
    return null;
}

const foundPath = findLineExtension();
if (foundPath) {
    console.log(`FOUND_PATH: ${foundPath}`);
} else {
    console.log('NOT_FOUND');
}
