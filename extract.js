const fs = require('fs');
const html = fs.readFileSync('summary.html', 'utf8');
// Find the last <script>...</script>
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);
if (!scripts) { console.log('No script'); process.exit(0); }
const lastScript = scripts[scripts.length-1];
const code = lastScript.replace(/^<script>/, '').replace(/<\/script>$/, '');
// Write to temp
fs.writeFileSync('_temp_check.js', code, 'utf8');
