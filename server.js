const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Habilitar CORS para la aplicación en Azure
app.use(cors({
    origin: 'https://caso-1-fremhxhbgsfjhcbc.brazilsouth-01.azurewebsites.net'
}));

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({
        multiples: true,
        uploadDir: './uploads',
        keepExtensions: true,
        maxFileSize: 50 * 1024 * 1024
    });

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const uploadedFiles = Array.isArray(files['files[]']) ? files['files[]'] : [files['files[]']];

        const isValidFilename = (filename) => {
            const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4'];
            return allowedExtensions.includes(path.extname(filename).toLowerCase());
        };

        uploadedFiles.forEach(file => {
            const oldPath = file.filepath;
            const newPath = path.join('./uploads', file.originalFilename);

            if (isValidFilename(file.originalFilename)) {
                fs.rename(oldPath, newPath, (err) => {
                    if (err) {
                        console.error('Error al renombrar el archivo:', err);
                    }
                });
            } else {
                console.error('Extensión no permitida:', file.originalFilename);
            }
        });

        res.status(200).send('Archivos subidos exitosamente');
    });
});

app.get('/list_files', (req, res) => {
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error al listar los archivos');
        }
        res.json({ files });
    });
});

app.post('/download_zip', express.json(), (req, res) => {
    const { files } = req.body;
    const zip = archiver('zip', { zlib: { level: 9 } });

    res.attachment('files.zip');

    zip.pipe(res);

    if (files === 'all') {
        fs.readdir('./uploads', (err, allFiles) => {
            if (err) {
                return res.status(500).send('Error al leer los archivos.');
            }

            if (!Array.isArray(allFiles) || allFiles.length === 0) {
                return res.status(400).send('No hay archivos para descargar.');
            }

            allFiles.forEach(file => {
                const filePath = path.join('./uploads', file);
                zip.file(filePath, { name: file });
            });

            zip.finalize().catch(err => {
                console.error('Error durante la creación del ZIP:', err);
                res.status(500).send('Error al crear el archivo ZIP.');
            });
        });
    } else {
        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).send('No se seleccionaron archivos para descargar.');
        }

        files.forEach(file => {
            const filePath = path.join('./uploads', file);
            zip.file(filePath, { name: file });
        });

        zip.finalize().catch(err => {
            console.error('Error durante la creación del ZIP:', err);
            res.status(500).send('Error al crear el archivo ZIP.');
        });
    }
});

app.post('/delete_all_files', (req, res) => {
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error al eliminar los archivos.');
        }
        let errors = [];
        files.forEach(file => {
            fs.unlink(path.join('./uploads', file), (err) => {
                if (err) errors.push(err.message);
            });
        });
        if (errors.length > 0) {
            return res.status(500).json({ error: errors });
        }
        res.send('Todos los archivos eliminados');
    });
});

app.post('/delete_file', express.json(), (req, res) => {
    const fileName = req.body.file;
    const filePath = path.join('./uploads', fileName);

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).send('Error al eliminar el archivo');
        }
        res.send('Archivo eliminado');
    });
});

wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado');

    ws.on('message', (message) => {
        console.log('Mensaje recibido del cliente:', message);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });

    ws.on('error', (err) => {
        console.error('Error en WebSocket:', err);
    });
});

server.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
