import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const commands = [
    'sudo -u postgres psql -d betmind -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = \'auth\';"',
    'sudo -u postgres psql -d betmind -c "\\d teams"', // Check structure of an existing table
    'sudo -u postgres psql -d betmind -c "SELECT count(*) FROM teams;"' // Check if data exists
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
      if (err) {
        console.error('Exec error: ' + err);
        conn.end();
        return;
      }
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
}).on('error', (err) => {
  console.error('Connection error: ' + err);
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
