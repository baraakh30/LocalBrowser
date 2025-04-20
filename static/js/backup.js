document.addEventListener('DOMContentLoaded', function () {
    const fileGrid = document.getElementById('file-grid');
    const loading = document.getElementById('loading');
    const breadcrumb = document.getElementById('breadcrumb');
    const mediaViewer = document.getElementById('media-viewer');
    const video = document.getElementById('video');
    const image = document.getElementById('image');
    const mediaTitle = document.getElementById('media-title');
    const closeMedia = document.getElementById('close-media');
    const errorDisplay = document.getElementById('error');
    const videoCountEl = document.getElementById('video-count');
    const imageCountEl = document.getElementById('image-count');

    let currentPath = '';
    let isHomeDirectory = true;
    let isViewingMedia = false;

    // Load initial directory
    const initialPath = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
    loadDirectory(initialPath, false);

    // Handle keyboard navigation
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mediaViewer.classList.contains('active')) {
            closeMediaViewer();
            e.preventDefault();
        }
        if ((e.key === 'Backspace' || e.keyCode === 8)) {
            e.preventDefault();
            if (isViewingMedia) {
                window.history.back();
            } else if (!isHomeDirectory) {
                navigateToParent();
            } else {
                window.history.back();
            }
        }
    });

    // Close media viewer with close button
    closeMedia.addEventListener('click', function () {
        window.history.back();
    });

    // Close media viewer by clicking outside
    mediaViewer.addEventListener('click', function (e) {
        if (e.target === mediaViewer) {
            window.history.back();
        }
    });

    // Handle breadcrumb click
    breadcrumb.addEventListener('click', function (e) {
        e.preventDefault();
        const link = e.target.closest('a');
        if (link) {
            const path = link.getAttribute('data-path');
            loadDirectory(path);
        }
    });

    // Handle back/forward navigation
    window.addEventListener('popstate', function (event) {
        if (isViewingMedia) {
            closeMediaViewer();
            return;
        }

        if (event.state) {
            if (event.state.path !== undefined) {
                loadDirectory(event.state.path, false);
            }
        } else {
            loadDirectory('', false);
        }
    });
    function loadDirectory(path, pushHistory = true) {
        loading.style.display = 'block';
        fileGrid.innerHTML = '';
        currentPath = path;
        isHomeDirectory = path === '';

        if (pushHistory) {
            history.pushState({ path }, '', `#${encodeURIComponent(path)}`);
        }

        fetch(`/api/files?path=${encodeURIComponent(path)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showError(data.error);
                    return;
                }

                updateBreadcrumb(data.current_path);

                if (data.parent !== null) {
                    addFileCard({
                        name: '..',
                        path: data.parent,
                        type: 'folder',
                        is_video: false,
                        is_image: false
                    });
                }

                data.items.forEach(item => {
                    addFileCard(item);
                });

                loading.style.display = 'none';

                fetch(`/api/stats?path=${encodeURIComponent(path)}`)
                    .then(response => response.json())
                    .then(stats => {
                        videoCountEl.textContent = stats.video_count;
                        imageCountEl.textContent = stats.image_count;
                    })
                    .catch(error => {
                        console.error("Error loading media stats:", error);
                    });
            })
            .catch(error => {
                showError('Error loading directory: ' + error.message);
                loading.style.display = 'none';
            });
    }

    function updateBreadcrumb(pathParts) {
        while (breadcrumb.children.length > 1) {
            breadcrumb.removeChild(breadcrumb.lastChild);
        }

        let currentPathBuild = '';
        pathParts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.className = 'separator';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);

            currentPathBuild += (index > 0 ? '/' : '') + part;

            const link = document.createElement('a');
            link.href = '#';
            link.setAttribute('data-path', currentPathBuild);
            link.textContent = part;
            breadcrumb.appendChild(link);
        });
    }

    function navigateToParent() {
        if (currentPath) {
            const parentPath = breadcrumb.children[breadcrumb.children.length - 3];
            if (parentPath && parentPath.getAttribute) {
                const path = parentPath.getAttribute('data-path');
                if (path !== null) {
                    loadDirectory(path);
                } else {
                    loadDirectory('');
                }
            } else {
                loadDirectory('');
            }
        }
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        setTimeout(() => {
            errorDisplay.style.display = 'none';
        }, 5000);
    }

    function closeMediaViewer() {
        mediaViewer.classList.remove('active');
        isViewingMedia = false;
        video.pause();
        video.src = '';
        video.style.display = 'none';
        image.src = '';
        image.style.display = 'none';

        // Remove the media flag from history state
        const currentState = history.state || {};
        delete currentState.media;
        history.replaceState(currentState, document.title);
    }

    function openMedia(type, path, name) {
        mediaTitle.textContent = name;

        // Set download link
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.href = `/api/download/${encodeURIComponent(path)}`;
        downloadBtn.setAttribute('download', name);

        if (type === 'video') {
            video.style.display = 'block';
            image.style.display = 'none';
            video.src = `/api/video/${encodeURIComponent(path)}`;
        } else {
            video.style.display = 'none';
            image.style.display = 'block';
            image.src = `/api/image/${encodeURIComponent(path)}`;
        }

        mediaViewer.classList.add('active');
        isViewingMedia = true;

        history.pushState({ media: true }, '', `#media/${encodeURIComponent(path)}`);
    }

    function addFileCard(item) {
        const card = document.createElement('div');
        card.className = 'file-card';

        const thumbnail = document.createElement('div');
        thumbnail.className = 'file-thumbnail';

        if (item.is_video || item.is_image) {
            const img = document.createElement('img');
            img.src = item.thumbnail || (item.is_video ? `/static/icons/video.svg` : `/static/icons/image.svg`);
            img.alt = item.name;
            thumbnail.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'play-overlay';

            const icon = document.createElement('i');
            icon.className = item.is_video ?
                'fas fa-play-circle play-icon' :
                'fas fa-search-plus play-icon';
            overlay.appendChild(icon);
            thumbnail.appendChild(overlay);
        } else {
            const img = document.createElement('img');
            img.src = item.type === 'folder' ? '/static/icons/folder.svg' : '/static/icons/file.svg';
            img.className = 'file-icon';
            thumbnail.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'file-info';

        const name = document.createElement('div');
        name.className = 'file-name';
        name.title = item.name;
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'file-meta';

        const type = document.createElement('span');
        if (item.type === 'folder') {
            type.textContent = 'Folder';
        } else if (item.is_video) {
            type.textContent = `Video (${item.extension})`;
        } else if (item.is_image) {
            type.textContent = `Image (${item.extension})`;
        } else {
            type.textContent = `File (${item.extension})`;
        }

        const size = document.createElement('span');
        if (item.size !== null || item.size !== undefined || item.size !== 0) {
            size.textContent = `${item.size} MB`;
        }

        meta.appendChild(type);
        if (item.type !== 'folder') {
            meta.appendChild(size);
        }
        info.appendChild(name);
        info.appendChild(meta);
        if (item.type !== 'folder') {
            const actions = document.createElement('div');
            actions.className = 'file-actions';

            const downloadLink = document.createElement('a');
            downloadLink.href = `/api/download/${encodeURIComponent(item.path)}`;
            downloadLink.className = 'file-action-btn download-action';
            downloadLink.setAttribute('download', item.name);
            downloadLink.setAttribute('title', 'Download');
            downloadLink.innerHTML = '<i class="fas fa-download"></i>';

            // Prevent click event from bubbling to the card
            downloadLink.addEventListener('click', function (e) {
                e.stopPropagation();
            });

            actions.appendChild(downloadLink);
            info.appendChild(actions);
        }

        card.appendChild(thumbnail);
        card.appendChild(info);

        card.addEventListener('click', function () {
            if (item.is_video) {
                openMedia('video', item.path, item.name);
            } else if (item.is_image) {
                openMedia('image', item.path, item.name);
            } else if (item.type === 'folder') {
                loadDirectory(item.path);
            }
        });

        fileGrid.appendChild(card);
    }


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

    window.addEventListener('click', function (e) {
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

    // Directory Selector functionality
    const dirSelectorModal = document.getElementById('dir-selector-modal');
    const changeDirBtn = document.getElementById('change-dir-btn');
    const dirSelectorClose = dirSelectorModal.querySelector('.close');
    const dirListing = document.getElementById('dir-listing');
    const dirLoading = document.getElementById('dir-loading');
    const selectDirectoryBtn = document.getElementById('select-directory-btn');
    const cancelDirectoryBtn = document.getElementById('cancel-directory-btn');
    const dirSelectorBreadcrumb = document.getElementById('dir-selector-breadcrumb');

    let currentDirPath = "";

    // Open directory selector modal
    changeDirBtn.addEventListener('click', function () {
        dirSelectorModal.style.display = 'block';
        // Start with root directory or drives
        loadDirectoryContents('');
    });

    // Close directory selector modal
    dirSelectorClose.addEventListener('click', function () {
        dirSelectorModal.style.display = 'none';
    });

    cancelDirectoryBtn.addEventListener('click', function () {
        dirSelectorModal.style.display = 'none';
    });

    // When clicking outside the modal, close it
    window.addEventListener('click', function (e) {
        if (e.target === dirSelectorModal) {
            dirSelectorModal.style.display = 'none';
        }
    });

    // Handle breadcrumb navigation in directory selector
    dirSelectorBreadcrumb.addEventListener('click', function (e) {
        e.preventDefault();
        const link = e.target.closest('a');
        if (link) {
            // Get the exact path from data-path attribute
            const path = link.getAttribute('data-path');
            if (path !== undefined) {
                // Use the exact path instead of concatenating
                loadDirectoryContents(path);
            }
        }
    });

    // Handle selecting a directory
    selectDirectoryBtn.addEventListener('click', function () {
        if (currentDirPath) {
            // Send request to change the base directory
            fetch('/api/change_directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: currentDirPath })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Close the modal
                        dirSelectorModal.style.display = 'none';

                        // Update the UI to reflect the new directory
                        showMessage(`Directory changed to: ${data.path}`, 'success');

                        // Reload the current directory
                        loadDirectory('', false);
                    } else {
                        showMessage(`Error: ${data.error}`, 'error');
                    }
                })
                .catch(error => {
                    showMessage(`Error: ${error.message}`, 'error');
                });
        } else {
            showMessage('Please select a directory first', 'error');
        }
    });

    // Load directories for directory selector
    function loadDirectoryContents(path) {
        currentDirPath = path;
        dirLoading.style.display = 'block';
        dirListing.innerHTML = '';

        fetch(`/api/directories?path=${encodeURIComponent(path)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showMessage(data.error, 'error');
                    return;
                }
                console.log("curerent Path:", data.current_path, "Parent  :", data.parent,);
                updateDirBreadcrumb(data.current_path);

                dirListing.innerHTML = '';

                // Add parent directory option if not at root
                if (data.parent !== null) {
                    const parentDir = createDirItem({
                        name: '..',
                        path: data.parent,
                        type: 'parent'
                    });
                    dirListing.appendChild(parentDir);
                }

                // Add drive options if at root
                if (path === '' && data.drives && data.drives.length > 0) {
                    data.drives.forEach(drive => {
                        const driveItem = createDirItem({
                            name: drive,
                            path: drive,
                            type: 'drive'
                        });
                        dirListing.appendChild(driveItem);
                    });
                } else {
                    // Add directory options
                    data.directories.forEach(dir => {
                        const dirItem = createDirItem(dir);
                        dirListing.appendChild(dirItem);
                    });
                }

                dirLoading.style.display = 'none';
            })
            .catch(error => {
                showMessage(`Error loading directories: ${error.message}`, 'error');
                dirLoading.style.display = 'none';
            });
    }

    function createDirItem(dir) {
        const item = document.createElement('div');
        item.className = 'dir-item';

        const icon = document.createElement('i');
        if (dir.type === 'drive') {
            icon.className = 'fas fa-hdd';
        } else if (dir.type === 'parent') {
            icon.className = 'fas fa-level-up-alt';
        } else {
            icon.className = 'fas fa-folder';
        }

        const name = document.createElement('span');
        name.textContent = dir.name;
        name.style.color = '#000';
        item.appendChild(icon);
        item.appendChild(name);

        item.addEventListener('click', () => {
            loadDirectoryContents(dir.path);
        });

        return item;
    }
    // Fix the updateDirBreadcrumb function
    function updateDirBreadcrumb(pathParts) {
        // Clear all breadcrumb items except Home
        while (dirSelectorBreadcrumb.children.length > 0) {
            dirSelectorBreadcrumb.removeChild(dirSelectorBreadcrumb.lastChild);
        }

        // Add home link
        const homeLink = document.createElement('a');
        homeLink.href = "#";
        homeLink.setAttribute('data-path', '');
        homeLink.innerHTML = '<i class="fas fa-home"></i> Home';
        dirSelectorBreadcrumb.appendChild(homeLink);

        // Don't process if no path parts
        if (!pathParts || pathParts.length === 0) {
            return;
        }

        let currentPathBuild = '';

        // For Windows paths, handle drive letter specially
        if (pathParts[0] && pathParts[0].includes(':')) {
            // This is a Windows drive letter (e.g., "C:")
            currentPathBuild = pathParts[0] + '\\'; // Add backslash for proper Windows path

            const separator = document.createElement('span');
            separator.className = 'separator';
            separator.textContent = '/';
            dirSelectorBreadcrumb.appendChild(separator);

            const link = document.createElement('a');
            link.href = "#";
            link.setAttribute('data-path', currentPathBuild);
            link.textContent = pathParts[0];
            dirSelectorBreadcrumb.appendChild(link);

            // Start from index 1 since we already processed the drive
            pathParts = pathParts.slice(1);
        }

        // Process remaining path parts
        pathParts.forEach((part, index) => {
            if (!part) return; // Skip empty parts

            const separator = document.createElement('span');
            separator.className = 'separator';
            separator.textContent = '/';
            dirSelectorBreadcrumb.appendChild(separator);

            // Build the path incrementally
            if (currentPathBuild.endsWith('\\') || currentPathBuild.endsWith('/')) {
                currentPathBuild += part;
            } else if (currentPathBuild) {
                currentPathBuild += '\\' + part;
            } else {
                currentPathBuild = part;
            }

            const link = document.createElement('a');
            link.href = "#";
            link.setAttribute('data-path', currentPathBuild);
            link.textContent = part;
            dirSelectorBreadcrumb.appendChild(link);
        });
    }

    // Function to show messages to the user
    function showMessage(message, type) {
        const errorDisplay = document.getElementById('error');
        errorDisplay.textContent = message;
        errorDisplay.className = 'error ' + type;
        errorDisplay.style.display = 'block';

        setTimeout(() => {
            errorDisplay.style.display = 'none';
        }, 5000);
    }
});
