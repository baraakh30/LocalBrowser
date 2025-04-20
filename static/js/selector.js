import { loadDirectory } from "./index.js";
document.addEventListener('DOMContentLoaded', function () {
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
                    loadDirectoryContents(''); // Reset to root if error occurs
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
        const errorDisplay = document.getElementById('error2');
        errorDisplay.textContent = message;
        errorDisplay.className = 'error ' + type;
        errorDisplay.style.display = 'block';

        setTimeout(() => {
            errorDisplay.style.display = 'none';
        }, 5000);
    }
});