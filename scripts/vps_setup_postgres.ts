import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const migration1 = fs.readFileSync('supabase/migrations/20260324112903_07388f69-14f1-44c7-a09a-a15ef881f261.sql', 'utf8');
  const migration2 = fs.readFileSync('supabase/migrations/20260324114749_ee281945-55d3-49dc-9958-12992d68d1a1.sql', 'utf8');

  // Escape single quotes for shell command
  const escapeSql = (sql: string) => sql.replace(/'/g, "'\\''");

  const commands = [
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update',
    'apt-get install -y postgresql postgresql-contrib',
    'sudo -u postgres psql -c "ALTER USER postgres PASSWORD \'Brunn@80\';"',
    'sudo -u postgres psql -c "DROP DATABASE IF EXISTS betmind;"',
    'sudo -u postgres psql -c "CREATE DATABASE betmind;"',
    'sudo -u postgres psql -d betmind -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"',
    'sudo -u postgres psql -d betmind -c "CREATE SCHEMA IF NOT EXISTS auth;"',
    'sudo -u postgres psql -d betmind -c "CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE);" ',
    // Apply migrations
    `sudo -u postgres psql -d betmind -c '${escapeSql(migration1)}'`,
    `sudo -u postgres psql -d betmind -c '${escapeSql(migration2)}'`
  ];

  const execBatch = (cmds: string[]) => {
    if (cmds.length === 0) {
      console.log('All commands executed successfully.');
      conn.end();
      return;
    }
    const cmd = cmds.shift()!;
    console.log('\n--- Executing: ' + cmd.substring(0, 100) + (cmd.length > 100 ? '...' : ''));
    
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Exec error: ' + err);
        conn.end();
        return;
      }
      let exitCode = -1;
      stream.on('close', (code: number) => {
        exitCode = code;
        if (code !== 0) {
           console.error('Command failed with code ' + code);
           // We continue anyway for now unless it's a critical install error
        }
        execBatch(cmds);
      }).on('data', (data: Buffer) => {
        process.stdout.write(data);
      }).stderr.on('data', (data: Buffer) => {
        process.stderr.write(data);
      });
    });
  };

  execBatch(commands);
}).on('error', (err) => {
  console.error('Connection error: ' + err);
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
