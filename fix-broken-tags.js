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

  // Replace <user={{...}} ... > with <>
  // Since user object might span multiple lines and there are other properties like navigation and onLogout,
  // we target <user= until the matching >.
  // Note: we can match <user= followed by anything up to the first > that closes the tag.
  // In JSX, tags can contain nested braces like user={{...}} so a simple [^>]* won't work if there's a > inside.
  // But wait, there is no > inside the user object. { name: 'طالب', role: 'طالب' } has no >.
  // So [\s\S]*?> works, but we should make sure it stops at the end of the opening tag.
  // The opening tag ends with a >.
  // Let's use a regex that matches <user= and goes until the closing > of that tag.
  // Since we know the tag ends after onLogout={...} or similar:
  // e.g. <user={...} navigation={...} onNavigate={...} onLogout={...} >
  const userTagRegex = /<user=\{[\s\S]*?>/;
  content = content.replace(userTagRegex, '<>');

  // Also, check if there are any lingering navigation = useStudentNavigation() that weren't deleted
  // or unused imports that might cause lint errors
  content = content.replace(/const navigation = useStudentNavigation\(\);\n/g, '');
  content = content.replace(/import \{ useStudentNavigation \} from '.*';\n/g, '');

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed tag in', file);
}
