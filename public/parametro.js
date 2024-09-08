document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileInput');
    const browseFilesButton = document.getElementById('browseFiles');
    const fileList = document.getElementById('fileList');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const zipDownloadBtn = document.querySelector('[name="zipDownload"]');
    const defaultText = dropArea.innerHTML;

    let uploadStartTime = 0;

    // Conexión WebSocket
    let ws = new WebSocket('wss://caso-1-fremhxhbgsfjhcbc.brazilsouth-01.azurewebsites.net');

    ws.onopen = () => {
        console.log('Conexión WebSocket establecida');
    };

    ws.onmessage = (event) => {
        if (event.data === 'refreshFileList') {
            console.log('Mensaje recibido: actualizar lista de archivos');
            loadFileList();  // Refrescar la lista de archivos en todas las pestañas
        }
    };

    function notifyChange() {
        ws.send('refreshFileList');
    }

    browseFilesButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        uploadFiles(files);
    });

    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('highlight');
        dropArea.innerHTML = 'Suelta aquí tus archivos';
    });

    dropArea.addEventListener('dragleave', (e) => {
        dropArea.classList.remove('highlight');
        dropArea.innerHTML = defaultText;
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('highlight');
        dropArea.innerHTML = defaultText;
        const files = e.dataTransfer.files;
        uploadFiles(files);
    });

    function uploadFiles(files) {
        [...files].forEach((file) => {
            const formData = new FormData();
            formData.append('files[]', file);
            uploadStartTime = Date.now();

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload');

            const progressElement = document.createElement('div');
            progressElement.classList.add('progress-bar');
            progressElement.innerHTML = `<span>${file.name}</span> <progress value="0" max="100"></progress><span class="time-remaining"></span>`;
            fileList.appendChild(progressElement);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressElement.querySelector('progress').value = percentComplete.toFixed(2);

                    const elapsedTime = (Date.now() - uploadStartTime) / 1000;
                    const timeRemaining = ((e.total - e.loaded) / e.loaded) * elapsedTime;
                    progressElement.querySelector('.time-remaining').textContent = `Tiempo restante: ${timeRemaining.toFixed(2)} s`;
                }
            });

            xhr.onload = () => {
                if (xhr.status === 200) {
                    loadFileList();
                    notifyChange();  // Notificar a todas las pestañas
                } else {
                    console.error('Error al subir el archivo:', xhr.statusText);
                }
            };

            xhr.send(formData);
        });
    }

    function loadFileList() {
        fetch('/list_files')
            .then(response => response.json())
            .then(data => {
                fileList.innerHTML = '';
                if (data.files.length === 0) {
                    fileList.innerHTML = '<p>No hay archivos subidos aún.</p>';
                    return;
                }

                data.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.classList.add('file-item');

                    let thumbnail = '';
                    if (file.match(/\.(jpg|jpeg|png|gif)$/)) {
                        thumbnail = `<img src="/uploads/${file}" class="thumbnail" alt="${file}">`;
                    } else if (file.match(/\.(mp4|webm)$/)) {
                        thumbnail = `<video src="/uploads/${file}" class="thumbnail" width="100" height="60" controls></video>`;
                    }

                    fileItem.innerHTML = `
                        ${thumbnail}
                        <input type="checkbox" name="file" value="${file}">
                        <span>${file}</span>
                        <button class="delete-btn" data-file="${file}">Eliminar</button>
                    `;
                    fileList.appendChild(fileItem);

                    fileItem.querySelector('.delete-btn').addEventListener('click', () => {
                        deleteFile(file);
                    });
                });
            })
            .catch(error => {
                console.error('Error al cargar la lista de archivos:', error);
            });
    }

    deleteAllBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas eliminar todos los archivos? Esta acción no se puede deshacer.')) {
            fetch('/delete_all_files', { method: 'POST' })
                .then(response => response.text())
                .then(result => {
                    console.log(result);
                    loadFileList();
                    notifyChange();  // Notificar a todas las pestañas
                })
                .catch(error => console.error('Error al eliminar los archivos:', error));
        }
    });

    function deleteFile(fileName) {
        fetch('/delete_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: fileName })
        })
        .then(response => response.text())
        .then(result => {
            console.log(result);
            loadFileList();
            notifyChange();  // Notificar a todas las pestañas
        })
        .catch(error => console.error('Error al eliminar archivo:', error));
    }

    downloadSelectedBtn.addEventListener('click', () => {
        const selectedFiles = [...document.querySelectorAll('input[name="file"]:checked')].map(input => input.value);

        if (selectedFiles.length === 0) {
            alert('Debes seleccionar al menos un archivo para descargar.');
            return;
        }

        fetch('/download_zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: selectedFiles })
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'selected_files.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(error => console.error('Error al descargar archivos seleccionados:', error));
    });

    zipDownloadBtn.addEventListener('click', () => {
        const totalFiles = document.querySelectorAll('input[name="file"]').length;

        if (totalFiles === 0) {
            alert('No hay archivos para descargar.');
            return;
        }

        fetch('/download_zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: 'all' })
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'all_files.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(error => console.error('Error al descargar todos los archivos:', error));
    });

    loadFileList();
});
