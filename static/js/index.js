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

export let currentPath = '';
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
export function loadDirectory(path, pushHistory = true) {
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
