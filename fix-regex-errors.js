const fs = require('fs');
const path = require('path');

const files = [
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/assessments/[id]/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/checkout/[productId]/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/courses/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/courses/[id]/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/courses/[id]/lesson/[lessonId]/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/products/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/profile/page.tsx',
  'C:/Users/alima/OneDrive/Documents/Bahrawy/apps/academy-web/app/student/support/page.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace '<> router.push(href)} ... >' with '<>'
  content = content.replace(/<>\s*router\.push\([\s\S]*?>/g, '<>');
  content = content.replace(/<>\s*onLogout=[\s\S]*?>/g, '<>');

  // Just in case some have different spacing:
  // Match <> followed by anything that doesn't contain a '<' (to prevent matching into next tags) up to the next '>'
  content = content.replace(/<>\s*[^<]*?>/g, '<>');

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed regex error in', file);
}
