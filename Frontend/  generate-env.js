const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const content = 'window._env = {\n  SUPABASE_URL: "' + url + '",\n  SUPABASE_ANON_KEY: "' + anonKey + '"\n};\n';

fs.writeFileSync(path.join(__dirname, 'env.js'), content);
console.log('env.js generated successfully.');