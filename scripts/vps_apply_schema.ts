import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const schema = fs.readFileSync('supabase/vps_schema.sql', 'utf8');

  // Escape single quotes for shell command
  const escapeSql = (sql: string) => sql.replace(/'/g, "'\\''");

  const commands = [
    'sudo -u postgres psql -c "DROP DATABASE IF EXISTS betmind;"',
    'sudo -u postgres psql -c "CREATE DATABASE betmind;"',
    `sudo -u postgres psql -d betmind -c '${escapeSql(schema)}'`,
    'sudo -u postgres psql -d betmind -c "\\dt"'
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
      stream.on('close', (code: number) => {
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
