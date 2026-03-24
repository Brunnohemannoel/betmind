import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const schema = fs.readFileSync('supabase/vps_schema.sql', 'utf8');
  // Split into individual statements
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);

  const execBatch = (cmds: string[]) => {
    if (cmds.length === 0) {
      console.log('All statements processed.');
      conn.end();
      return;
    }
    const cmd = cmds.shift()!;
    // Escape single quotes
    const escaped = cmd.replace(/'/g, "'\\''");
    const fullCmd = `sudo -u postgres psql -d betmind -c '${escaped};'`;
    
    console.log('\n--- Executing: ' + cmd.substring(0, 100));
    conn.exec(fullCmd, (err, stream) => {
      if (err) throw err;
      stream.on('close', (code: number) => {
         if (code !== 0) console.error('FAILED with code ' + code);
         execBatch(cmds);
      }).on('data', (data: Buffer) => {
        process.stdout.write(data);
      }).stderr.on('data', (data: Buffer) => {
        process.stderr.write(data);
      });
    });
  };

  execBatch(statements);
}).on('error', (err) => {
  console.error('Connection error: ' + err);
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
