import { currentPath, loadDirectory } from './index.js';

document.addEventListener('DOMContentLoaded', function () {
    // Upload Modal functionality
    const uploadBtn = document.getElementById('upload-btn');
    const uploadModal = document.getElementById('upload-modal');
    const uploadClose = document.querySelector('.upload-close');
    const uploadForm = document.getElementById('upload-form');
    const uploadMessage = document.getElementById('upload-message');
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const uploadQueue = document.getElementById('upload-queue');

    uploadBtn.addEventListener('click', function () {
        uploadModal.style.display = 'block';
        uploadMessage.textContent = '';
        uploadMessage.className = 'upload-message';
        uploadQueue.innerHTML = '';
        fileInput.value = '';
        folderInput.value = '';
    });

    uploadClose.addEventListener('click', function () {
        uploadModal.style.display = 'none';
    });

    uploadModal.addEventListener('click', function (e) {
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // When files are selected via the file input, display them in the queue
    fileInput.addEventListener('change', function () {
        displaySelectedFiles(this.files);
    });

    // When files are selected via the folder input, display them in the queue
    folderInput.addEventListener('change', function () {
        displaySelectedFiles(this.files);
    });

    function displaySelectedFiles(files) {
        uploadQueue.innerHTML = '';

        if (!files || files.length === 0) return;

        const header = document.createElement('div');
        header.className = 'upload-queue-header';
        header.textContent = `Selected ${files.length} file(s)`;
        uploadQueue.appendChild(header);

        // Limit display to first 10 files to avoid cluttering the UI
        const displayLimit = Math.min(files.length, 10);

        for (let i = 0; i < displayLimit; i++) {
            const file = files[i];
            const fileItem = document.createElement('div');
            fileItem.className = 'upload-file-item';

            // Use escaped filename for the data attribute
            fileItem.dataset.name = file.name;

            const fileInfo = document.createElement('div');
            fileInfo.className = 'upload-file-info';

            const fileName = document.createElement('div');
            fileName.className = 'upload-file-name';
            fileName.title = file.name;
            fileName.textContent = file.name.length > 40 ?
                file.name.substring(0, 37) + '...' :
                file.name;
            // Set dir="auto" to handle RTL text automatically
            fileName.setAttribute('dir', 'auto');

            const fileSize = document.createElement('div');
            fileSize.className = 'upload-file-size';
            fileSize.textContent = formatFileSize(file.size);

            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);

            const progressContainer = document.createElement('div');
            progressContainer.className = 'upload-file-progress-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'upload-file-progress-bar';

            const progressText = document.createElement('div');
            progressText.className = 'upload-file-progress-text';
            progressText.textContent = 'Ready';

            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);

            fileItem.appendChild(fileInfo);
            fileItem.appendChild(progressContainer);

            uploadQueue.appendChild(fileItem);
        }

        if (files.length > displayLimit) {
            const moreFiles = document.createElement('div');
            moreFiles.className = 'upload-more-files';
            moreFiles.textContent = `...and ${files.length - displayLimit} more file(s)`;
            uploadQueue.appendChild(moreFiles);
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Combine files from both inputs
        let filesToUpload = [];
        if (fileInput.files && fileInput.files.length > 0) {
            filesToUpload = Array.from(fileInput.files);
        }

        if (folderInput.files && folderInput.files.length > 0) {
            filesToUpload = filesToUpload.concat(Array.from(folderInput.files));
        }

        if (filesToUpload.length === 0) {
            showUploadMessage('Please select files or a folder to upload', 'error');
            return;
        }

        uploadFiles(filesToUpload);
    });

    function uploadFiles(files) {
        // Reset all progress indicators
        document.querySelectorAll('.upload-file-progress-bar').forEach(bar => {
            bar.style.width = '0%';
        });

        document.querySelectorAll('.upload-file-progress-text').forEach(text => {
            text.textContent = 'Waiting...';
        });

        let uploadedCount = 0;
        let failedCount = 0;

        // Process each file with its own XHR
        for (let i = 0; i < files.length; i++) {
            uploadSingleFile(files[i], (success) => {
                if (success) uploadedCount++; else failedCount++;

                // When all files have been processed
                if (uploadedCount + failedCount === files.length) {
                    if (failedCount === 0) {
                        showUploadMessage(`Successfully uploaded ${uploadedCount} file(s)`, 'success');
                    } else {
                        showUploadMessage(`Uploaded ${uploadedCount} file(s), ${failedCount} failed`, 'error');
                    }

                    // Reload the current directory after all uploads complete
                    setTimeout(() => {
                        loadDirectory(currentPath, false);
                    }, 1500);
                }
            });
        }
    }

    function uploadSingleFile(file, callback) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('current_dir', currentPath);

        // Get the custom folder name
        const customFolder = document.getElementById('custom-folder').value.trim();
        formData.append('custom_folder', customFolder || 'uploads');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        // Find the progress elements for this file
        const fileItem = document.querySelector(`.upload-file-item[data-name="${file.name.replace(/"/g, '\\"')}"]`);
        let progressBar, progressText;

        if (fileItem) {
            progressBar = fileItem.querySelector('.upload-file-progress-bar');
            progressText = fileItem.querySelector('.upload-file-progress-text');
            progressText.textContent = 'Starting...';
        }

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable && progressBar && progressText) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                if (progressBar && progressText) {
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Complete';
                    progressBar.style.backgroundColor = '#4CAF50';  // Green
                }
                callback(true);
            } else {
                if (progressBar && progressText) {
                    progressText.textContent = 'Failed';
                    progressBar.style.backgroundColor = '#f44336';  // Red
                }
                callback(false);
            }
        };

        xhr.onerror = function () {
            if (progressBar && progressText) {
                progressText.textContent = 'Error';
                progressBar.style.backgroundColor = '#f44336';  // Red
            }
            callback(false);
        };

        xhr.send(formData);
    }

    function showUploadMessage(message, type) {
        uploadMessage.textContent = message;
        uploadMessage.className = 'upload-message ' + type;
    }
});