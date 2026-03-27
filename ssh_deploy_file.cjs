const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localFile = process.argv[2];
const remotePath = process.argv[3];

if (!localFile || !remotePath) {
    console.error("Usage: node ssh_deploy_file.cjs <localFile> <remotePath>");
    process.exit(1);
}

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remotePath);

        writeStream.on('close', () => {
            console.log("File transferred successfully");
            conn.end();
        });

        writeStream.on('error', (err) => {
            console.error("Transfer error:", err);
            conn.end();
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '191.252.100.73',
    port: 22,
    username: 'root',
    password: 'Brunn@80'
});
