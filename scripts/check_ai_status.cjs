const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected');
  conn.exec('sudo -u postgres psql -d betmind -c "\\dt" && journalctl -u betmind-ai -n 20 --no-pager', (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '191.252.100.73',
  port: 22,
  username: 'root',
  password: 'Brunn@80'
});
