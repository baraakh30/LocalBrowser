## Overview

LocalBrowser is a Python-based web server that allows you to browse, view, and upload files on your computer through a web interface. It's designed to provide easy access to your media files (images and videos) with thumbnail generation and streaming capabilities.

## Features

- **File browsing**: Navigate through your file system with a user-friendly interface
- **Media viewing**: View images and videos directly in the browser
- **Media streaming**: Stream video files with proper range request support
- **File uploads**: Upload individual files or entire folders
- **Thumbnails**: Automatic generation of thumbnails for images and videos
- **Directory selection**: Change the root directory on the fly
- **Responsive design**: Works on both desktop and mobile devices
- **Password protection**: Secure access with password authentication

## Requirements

- Python 3.9+
- Flask
- FFmpeg (for thumbnail generation)
- Optional: Pillow (for image thumbnail processing)

## Installation

1. Clone the repository or download the source code:

```bash
git clone https://github.com/baraakh30/LocalBrowser.git localbrowser
cd localbrowser
```

2. Install the required Python packages using the requirements.txt file:

```bash
pip install -r requirements.txt
```

3. Install FFmpeg:
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt-get install ffmpeg`
   
## Configuration

1. Edit server.py and modify the `BASE_DIR` variable to set your default directory:

```python
BASE_DIR = r"D:\your\path\here"  # Change this to your desired directory
```

2. For first-time setup, the password will be created when you first log in. This password hash is stored in auth_hash.txt.

## Usage

1. Run the server:

```bash
python server.py
```

2. Access the web interface:
   - On the same computer: http://localhost:5000
   - From other devices on the same network: http://your-local-ip-address:5000

3. Log in with your password.

4. Navigate through your files using the interface.

## Key Features Explained

### Directory Navigation
- Click on folders to navigate into them
- Use the breadcrumb navigation at the top to jump to parent directories
- Click the "Change Directory" button to select any directory on your system

### Media Viewing
- Click on an image or video to open it in the media viewer
- Videos support streaming playback
- Download media files directly from the viewer

### File Upload
- Click "Upload" button to open the upload modal
- Select individual files or entire folders
- Specify a custom folder name for uploads
- Monitor upload progress for each file

### Security
- All access is password protected
- Session timeout after 1 hour of inactivity
- Protection against directory traversal attacks
- Restricted access to system directories

## Troubleshooting

**Thumbnails not generating**
- Ensure FFmpeg is properly installed and available in your PATH
- Check permissions for the `static/thumbnails` directory

**Access denied errors**
- Make sure the specified path is accessible to the user running the server
- Some system directories are intentionally restricted for security

**Upload issues**
- Check that the destination directory is writable
- Ensure file names don't contain invalid characters

## License

This project is licensed under the MIT License - see the LICENSE file for details.