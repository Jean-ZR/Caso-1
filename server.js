const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Manejo de subida de archivos con formidable
app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({ multiples: true, uploadDir: './uploads', keepExtensions: true });

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const uploadedFiles = Array.isArray(files['files[]']) ? files['files[]'] : [files['files[]']];

        uploadedFiles.forEach(file => {
            const oldPath = file.filepath;
            const newPath = path.join('./uploads', file.originalFilename);  // Guardar con el nombre original

            // Mover el archivo a la carpeta de destino con el nombre original
            fs.rename(oldPath, newPath, (err) => {
                if (err) {
                    console.error('Error al renombrar el archivo:', err);
                }
            });
        });

        res.status(200).send('Archivos subidos exitosamente');
    });
});

// Lista de archivos
app.get('/list_files', (req, res) => {
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error al listar los archivos');
        }
        res.json({ files });
    });
});


// Descargar archivos seleccionados como ZIP
app.post('/download_zip', express.json(), (req, res) => {
    const { files } = req.body;
    const zip = archiver('zip', { zlib: { level: 9 } });

    res.attachment('selected_files.zip');
    zip.pipe(res);

    files.forEach(file => {
        const filePath = path.join('./uploads', file);
        zip.file(filePath, { name: file });
    });

    zip.finalize();
});

// Descargar archivos  como ZIP
app.post('/download_zip', express.json(), (req, res) => {
  const zip = archiver('zip', { zlib: { level: 9 } });

  // Configurar el nombre del archivo ZIP
  res.attachment('all_files.zip');
  zip.pipe(res);  // Conectar el flujo de ZIP a la respuesta

  // Leer todos los archivos del directorio "uploads"
  fs.readdir('./uploads', (err, files) => {
      if (err) {
          return res.status(500).send('Error al leer los archivos.');
      }

      // Verificar si `files` es un array
      if (!Array.isArray(files) || files.length === 0) {
          return res.status(400).send('No hay archivos para incluir en el ZIP.');
      }

      console.log('Archivos encontrados:', files);

      // Añadir todos los archivos al ZIP
      files.forEach(file => {
          const filePath = path.join('./uploads', file);
          zip.file(filePath, { name: file });
      });

      // Finalizar el archivo ZIP
      zip.finalize().catch((err) => {
          console.error('Error al crear el archivo ZIP:', err);
          res.status(500).send('Error al crear el archivo ZIP.');
      });
  });

  // Manejo de errores de finalización del ZIP
  zip.on('error', (err) => {
      console.error('Error en el archivo ZIP:', err);
      res.status(500).send('Error en el archivo ZIP.');
  });
});



// Descargar todos los archivos como ZIP de forma progresiva
app.post('/download_zip', express.json(), (req, res) => {
    const zip = archiver('zip', { zlib: { level: 9 } });

    // Configurar el nombre del archivo ZIP
    res.attachment('all_files.zip');

    // Conectar el flujo del archivo ZIP a la respuesta
    zip.pipe(res);

    // Leer todos los archivos en la carpeta 'uploads'
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error al leer los archivos.');
        }

        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).send('No hay archivos para descargar.');
        }

        console.log('Archivos encontrados:', files);

        // Añadir cada archivo al ZIP a medida que se crea
        files.forEach(file => {
            const filePath = path.join('./uploads', file);
            zip.file(filePath, { name: file });
        });

        // Finalizar el archivo ZIP
        zip.finalize();

        // Manejar errores si ocurren durante el proceso
        zip.on('error', (err) => {
            console.error('Error durante la creación del ZIP:', err);
            res.status(500).send('Error al crear el archivo ZIP.');
        });
    });
});

// Eliminar todos los archivos
app.post('/delete_all_files', (req, res) => {
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error al eliminar los archivos.');
        }
        files.forEach(file => {
            fs.unlinkSync(path.join('./uploads', file));
        });
        res.send('Todos los archivos eliminados');
    });
});

// Eliminar archivo individual
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

// WebSocket para sincronizar pestañas
wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado');

    ws.on('message', (message) => {
        console.log('Mensaje recibido del cliente:', message);
        // Retransmitir el mensaje a todas las pestañas conectadas
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);  // Enviar el mensaje a todas las pestañas conectadas
            }
        });
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});

// Escuchar en el puerto definido
server.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
