const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all tsx and ts files
const files = execSync('find apps packages -type f -name "*.tsx" -o -name "*.ts"', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean);

let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // This regex matches "dark:" followed by any tailwind class characters
  // It handles spacing gracefully
  const newContent = content.replace(/\bdark:[a-zA-Z0-9\-\/\[\]#\.]+\b/g, (match) => {
    return '';
  }).replace(/ +/g, ' '); // Clean up extra spaces temporarily, but wait this might mess up formatting
  
  // A safer regex replacement:
  // Replace "dark:something" and a potential trailing or leading space.
  let saferContent = content.replace(/(?:\s*)dark:[a-zA-Z0-9\-\/\[\]#\.]+(?:\s*)/g, ' ');
  
  if (content !== saferContent) {
    fs.writeFileSync(file, saferContent, 'utf-8');
    changedFiles++;
  }
}

console.log(`Removed dark mode variants in ${changedFiles} files.`);
