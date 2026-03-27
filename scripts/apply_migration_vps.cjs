const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('🚀 Client :: ready');
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260324_create_bet_slip_tables.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    conn.end();
    return;
  }

  const schema = fs.readFileSync(migrationPath, 'utf8');
  // Escape single quotes for shell command
  const escapeSql = (sql) => sql.replace(/'/g, "'\\''");

  console.log('📤 Applying migration: 20260324_create_bet_slip_tables.sql');
  
  conn.exec(`cd /tmp && sudo -u postgres psql -d betmind -c '${escapeSql(schema)}'`, (err, stream) => {
    if (err) {
      console.error('❌ Exec error:', err);
      conn.end();
      return;
    }
    stream.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Migration applied successfully!');
      } else {
        console.error('❌ Migration failed with code', code);
      }
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err);
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
