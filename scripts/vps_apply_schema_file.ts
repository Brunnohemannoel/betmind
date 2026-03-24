import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const schema = fs.readFileSync('supabase/vps_schema.sql', 'utf8');

  // Step 1: Upload file to /tmp/vps_schema.sql
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/tmp/vps_schema.sql');
    writeStream.on('close', () => {
      console.log('Schema uploaded.');
      
      // Step 2: Execute SQL file
      const commands = [
        'sudo -u postgres psql -c "DROP DATABASE IF EXISTS betmind;"',
        'sudo -u postgres psql -c "CREATE DATABASE betmind;"',
        'cd /tmp && sudo -u postgres psql -d betmind -f /tmp/vps_schema.sql',
        'sudo -u postgres psql -d betmind -c "\\dt public.*"'
      ];

      const execBatch = (cmds: string[]) => {
        if (cmds.length === 0) {
          console.log('All commands executed.');
          conn.end();
          return;
        }
        const cmd = cmds.shift()!;
        console.log('\n--- Executing: ' + cmd);
        conn.exec(cmd, (err, stream) => {
          if (err) throw err;
          stream.on('close', () => {
             execBatch(cmds);
          }).on('data', (data) => {
            process.stdout.write(data);
          }).stderr.on('data', (data) => {
            process.stderr.write(data);
          });
        });
      };

      execBatch(commands);
    });
    writeStream.end(schema);
  });
}).on('error', (err) => {
  console.error('Connection error: ' + err);
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
