import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('sudo -u postgres psql -d betmind -c "SELECT * FROM pg_extension; SELECT proname FROM pg_proc WHERE proname LIKE \'%uuid%\';"', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
