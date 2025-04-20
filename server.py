from flask import Flask, render_template, send_file, send_from_directory, request, jsonify, abort, Response, session, redirect, url_for
import mimetypes
import platform
import socket
import subprocess
import hashlib
import threading
import time
import secrets
import getpass
import functools
import os
import string
import mimetypes

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)


BASE_DIR = r"D:\uv\ssss" 
THUMBNAIL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "thumbnails")
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.webm', '.flv', '.wmv', '.m4v'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
SESSION_TIMEOUT = 3600  # 1 hour

# Create thumbnail directory if it doesn't exist
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

# Authentication decorator
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        
        # Check session timeout
        if 'login_time' in session and time.time() - session['login_time'] > SESSION_TIMEOUT:
            session.clear()
            return redirect(url_for('login'))
            
        return f(*args, **kwargs)
    return decorated_function

def verify_password(password):
    # Verify against the current user's password
    current_user = getpass.getuser()
    try:
        # Hash of the provided password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        # Store hash of the password for the session
        session['password_hash'] = password_hash
        
        stored_hash_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth_hash.txt')
        
        # If hash file doesn't exist, create it with the provided password
        if not os.path.exists(stored_hash_path):
            with open(stored_hash_path, 'w') as f:
                f.write(password_hash)
            return True
        
        # Otherwise, compare with the stored hash
        with open(stored_hash_path, 'r') as f:
            stored_hash = f.read().strip()
            return password_hash == stored_hash
            
    except Exception as e:
        print(f"Authentication error: {e}")
        return False

# Check if ffmpeg is installed
def is_ffmpeg_installed():
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except FileNotFoundError:
        return False

# Generate thumbnail for video file
def generate_thumbnail(video_path, output_path):
    try:
        # First get video duration
        duration_cmd = [
            "ffprobe", 
            "-v", "error", 
            "-show_entries", "format=duration", 
            "-of", "default=noprint_wrappers=1:nokey=1", 
            video_path
        ]
        
        result = subprocess.run(duration_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if result.returncode != 0:
            print(f"Error getting video duration: {result.stderr}")
            return False
            
        try:
            duration = float(result.stdout.strip())
        except ValueError:
            print(f"Invalid duration value: {result.stdout}")
            return False
        
        # Calculate position at 10% of duration, with fallback options
        if duration > 10:
            position = "00:00:10"  # If video is longer than 10s, use 10s mark
        elif duration > 3:
            position = f"00:00:{int(duration/2)}"  # For shorter videos, use midpoint
        else:
            position = "00:00:00"  # For very short videos, use first frame
        
        # Generate the thumbnail
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, 
            "-ss", position, "-vframes", "1", 
            "-vf", "scale=320:-1", 
            output_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        
        # Verify the thumbnail was created and has content
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
        else:
            print(f"Generated thumbnail is empty or not created: {output_path}")
            
            # Fallback: try getting the first frame
            subprocess.run([
                "ffmpeg", "-y", "-i", video_path, 
                "-vframes", "1", 
                "-vf", "scale=320:-1", 
                output_path
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
            
    except subprocess.TimeoutExpired:
        print(f"Timeout while generating thumbnail for {video_path}")
        return False
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return False

# Generate thumbnail for image file
def generate_image_thumbnail(image_path, output_path):
    try:
        # Generate a thumbnail for the image
        subprocess.run([
            "ffmpeg", "-y", "-i", image_path,
            "-vf", "scale=320:-1",
            output_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        print(f"Error generating image thumbnail: {e}")
        return False

# Background thumbnail generator
def thumbnail_generator_thread():
    while True:
        try:
            for root, dirs, files in os.walk(BASE_DIR):
                for file in files:
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in ALLOWED_VIDEO_EXTENSIONS or file_ext in ALLOWED_IMAGE_EXTENSIONS:
                        file_path = os.path.join(root, file)
                        # Generate a unique thumbnail name based on the file path
                        thumb_name = hashlib.md5(file_path.encode()).hexdigest() + ".jpg"
                        thumb_path = os.path.join(THUMBNAIL_DIR, thumb_name)
                        
                        # Generate thumbnail if it doesn't exist
                        if not os.path.exists(thumb_path):
                            if file_ext in ALLOWED_VIDEO_EXTENSIONS:
                                generate_thumbnail(file_path, thumb_path)
                            else:
                                generate_image_thumbnail(file_path, thumb_path)
        except Exception as e:
            print(f"Error in thumbnail generator thread: {e}")
        
        # Sleep for 60 seconds before checking again
        time.sleep(60)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        password = request.form.get('password')
        if verify_password(password):
            session['logged_in'] = True
            session['login_time'] = time.time()
            return redirect(url_for('index'))
        else:
            error = "Invalid password"
    
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/api/download/<path:filename>')
@login_required
def download_file(filename):
    # Prevent directory traversal attacks
    target_file = os.path.normpath(os.path.join(BASE_DIR, filename))
    if not target_file.startswith(BASE_DIR):
        return jsonify({"error": "Access denied"}), 403
        
    if not os.path.exists(target_file) or os.path.isdir(target_file):
        abort(404)
    
    directory = os.path.dirname(target_file)
    file = os.path.basename(target_file)
    
    return send_from_directory(
        directory, 
        file, 
        as_attachment=True,
        download_name=file
    )
@app.route('/api/stats')
@login_required
def get_stats():
    try:
        video_count = 0
        image_count = 0
        
        # Use the current directory from the request or default to root
        path = request.args.get('path', '')
        target_dir = os.path.normpath(os.path.join(BASE_DIR, path))
        
        # Prevent directory traversal attacks
        if not target_dir.startswith(BASE_DIR):
            return jsonify({"error": "Access denied"}), 403
            
        # Count videos and images in the current directory
        for item in os.listdir(target_dir):
            item_path = os.path.join(target_dir, item)
            if not os.path.isdir(item_path):
                ext = os.path.splitext(item)[1].lower()
                if ext in ALLOWED_VIDEO_EXTENSIONS:
                    video_count += 1
                elif ext in ALLOWED_IMAGE_EXTENSIONS:
                    image_count += 1
        
        return jsonify({
            "video_count": video_count,
            "image_count": image_count,
            "total_media": video_count + image_count
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/files')
@login_required
def list_files():
    path = request.args.get('path', '')
    
    # Prevent directory traversal attacks
    target_dir = os.path.normpath(os.path.join(BASE_DIR, path))
    if not target_dir.startswith(BASE_DIR):
        return jsonify({"error": "Access denied"}), 403
    
    if is_restricted_path(target_dir):
        return jsonify({"error": "Access denied"}), 403

    try:
        items = []
        
        for item in os.listdir(target_dir):
            item_path = os.path.join(target_dir, item)
            rel_path = os.path.relpath(item_path, BASE_DIR).replace('\\', '/')
            
            is_dir = os.path.isdir(item_path)
            file_type = 'folder' if is_dir else 'file'
            
            # Get file size in MB
            size = None
            if not is_dir:
                size = round(os.path.getsize(item_path) / (1024 * 1024), 2)
            
            # Determine file type and thumbnail
            ext = os.path.splitext(item)[1].lower()
            is_video = ext in ALLOWED_VIDEO_EXTENSIONS
            is_image = ext in ALLOWED_IMAGE_EXTENSIONS
            thumbnail = None
            
            if is_video:
                # Generate thumbnail name for video
                thumb_name = hashlib.md5(item_path.encode()).hexdigest() + ".jpg"
                thumb_path = os.path.join(THUMBNAIL_DIR, thumb_name)
                
                # Check if thumbnail exists
                if os.path.exists(thumb_path):
                    thumbnail = f"/api/thumbnail/{thumb_name}"
                else:
                    # Generate thumbnail synchronously for videos to show immediately
                    if generate_thumbnail(item_path, thumb_path):
                        thumbnail = f"/api/thumbnail/{thumb_name}"
                    else:
                        thumbnail = "/static/icons/placeholder.jpg"
            elif is_image:
                # For images, use the image file directly as the thumbnail
                thumbnail = f"/api/image/{rel_path}?thumbnail=true"
            
            items.append({
                'name': item,
                'path': rel_path,
                'type': file_type,
                'is_video': is_video,
                'is_image': is_image,
                'size': size,
                'extension': ext[1:] if ext else '',
                'thumbnail': thumbnail
            })
        
        # Sort: directories first, then files
        items.sort(key=lambda x: (0 if x['type'] == 'folder' else 1, x['name'].lower()))
        
        # Get parent directory
        parent = None
        if path:
            parent_path = os.path.dirname(path)
            parent = parent_path
            
        current_path = path.split('/') if path else []
        if current_path and current_path[-1] == '':
            current_path.pop()
            
        return jsonify({
            'items': items,
            'parent': parent,
            'current_path': current_path,
            'current_dir': path
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/media/<path:filename>')
@login_required
def serve_media(filename):
    # Prevent directory traversal attacks
    target_file = os.path.normpath(os.path.join(BASE_DIR, filename))
    if not target_file.startswith(BASE_DIR):
        return jsonify({"error": "Access denied"}), 403
        
    directory = os.path.dirname(target_file)
    file = os.path.basename(target_file)
    
    if not os.path.exists(target_file):
        abort(404)
    
    # For video files, support range requests
    ext = os.path.splitext(target_file)[1].lower()
    if ext in ALLOWED_VIDEO_EXTENSIONS:
        # Support for range requests (important for video streaming)
        range_header = request.headers.get('Range', None)
        if range_header:
            file_size = os.path.getsize(target_file)
            
            # Parse the range header
            ranges = range_header.replace('bytes=', '').split('-')
            start = int(ranges[0]) if ranges[0] else 0
            end = int(ranges[1]) if ranges[1] else file_size - 1
            
            if end >= file_size:
                end = file_size - 1
            
            length = end - start + 1
            
            # Define response headers
            headers = {
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(length),
                'Content-Type': mimetypes.guess_type(target_file)[0] or 'video/mp4'
            }
            
            # Read the specified range of bytes
            with open(target_file, 'rb') as f:
                f.seek(start)
                data = f.read(length)
            
            # Return partial content status code with the bytes
            return Response(data, 206, headers)
    
    return send_from_directory(directory, file)

@app.route('/api/video/<path:filename>')
@login_required
def stream_video(filename):
    return serve_media(filename)

@app.route('/api/image/<path:filename>')
@login_required
def serve_image(filename):
    target_file = os.path.normpath(os.path.join(BASE_DIR, filename))
    if not target_file.startswith(BASE_DIR):
        return jsonify({"error": "Access denied"}), 403
        
    if not os.path.exists(target_file):
        abort(404)
        
    # Check if thumbnail is requested
    is_thumbnail = request.args.get('thumbnail', 'false').lower() == 'true'
    
    if is_thumbnail:
        # Send image as a thumbnail with resizing on-the-fly
        try:
            from PIL import Image
            from io import BytesIO
            
            # Open image and resize
            with Image.open(target_file) as img:
                # Keep aspect ratio, max width 320px
                img.thumbnail((320, 320))
                
                # Save to memory buffer
                buf = BytesIO()
                img_format = img.format if img.format else 'JPEG'
                img.save(buf, format=img_format)
                buf.seek(0)
                
                # Return resized image
                return Response(buf.getvalue(), 
                                mimetype=f'image/{img_format.lower()}')
        except ImportError:
            # If PIL is not available, send original image
            return send_file(target_file)
        except Exception as e:
            print(f"Error serving thumbnail: {e}")
            return send_file(target_file)
    else:
        # Send original image
        return send_file(target_file)

@app.route('/api/thumbnail/<filename>')
@login_required
def get_thumbnail(filename):
    return send_from_directory(THUMBNAIL_DIR, filename)

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route('/api/upload', methods=['POST'])
@login_required
def upload_file():
    try:
        # Get the current directory and custom folder name from the request
        custom_folder = request.form.get('custom_folder', 'uploads')
        
        # If custom folder is empty after sanitization, use default
        if not custom_folder:
            custom_folder = 'uploads'
        
        # Create target directory path
        target_dir = os.path.normpath(os.path.join(BASE_DIR, custom_folder))
        
        # Prevent directory traversal attacks
        if not target_dir.startswith(BASE_DIR):
            return jsonify({"error": "Access denied"}), 403
        
        # Prevent writing to restricted paths
        if is_restricted_path(target_dir):
            return jsonify({"error": "Cannot upload to system directories"}), 403
        
        # Create uploads directory if it doesn't exist
        os.makedirs(target_dir, exist_ok=True)
        
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
            
        files = request.files.getlist('file')
        
        if not files or len(files) == 0 or files[0].filename == '':
            return jsonify({"error": "No files selected"}), 400
            
        uploaded_files = []
        for file in files:
            # Preserve original filename while sanitizing
            original_filename = file.filename
            
            # Handle different file systems and character encodings
            if '/' in original_filename:  # Handle folder structure
                # Get relative path from upload
                rel_path = os.path.dirname(original_filename)
                # Create subfolder structure
                subfolder_path = os.path.normpath(os.path.join(target_dir, rel_path))
                os.makedirs(subfolder_path, exist_ok=True)
                
                # Use the original filename but secure it
                filename = os.path.basename(original_filename)
                filepath = os.path.join(subfolder_path, filename)
            else:
                # Use the original filename but secure it
                filename = original_filename
                filepath = os.path.join(target_dir, filename)
            
            # Ensure filename has content after sanitization
            if not filename:
                filename = "unnamed_file"
                filepath = os.path.join(target_dir, filename)
                
            # Save the file
            file.save(filepath)
            uploaded_files.append(filename)
            
            # If it's a media file, trigger thumbnail generation
            ext = os.path.splitext(filename)[1].lower()
            if ext in ALLOWED_VIDEO_EXTENSIONS or ext in ALLOWED_IMAGE_EXTENSIONS:
                thumb_name = hashlib.md5(filepath.encode()).hexdigest() + ".jpg"
                thumb_path = os.path.join(THUMBNAIL_DIR, thumb_name)
                
                if ext in ALLOWED_VIDEO_EXTENSIONS:
                    threading.Thread(target=generate_thumbnail, args=(filepath, thumb_path)).start()
                else:
                    threading.Thread(target=generate_image_thumbnail, args=(filepath, thumb_path)).start()
        
        return jsonify({
            "success": True,
            "message": f"{len(uploaded_files)} file(s) uploaded successfully",
            "files": uploaded_files,
            "path": os.path.join( custom_folder).replace('\\', '/')
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route('/api/directories')
@login_required
def list_directories():
    path = request.args.get('path', '')
    
    try:
        # If path is empty, list drives on Windows or root directory on other systems
        if not path:
            if platform.system() == 'Windows':
                # List available drives on Windows
                drives = []
                for letter in string.ascii_uppercase:
                    drive = f"{letter}:\\"
                    if os.path.exists(drive):
                        drives.append(drive)
                return jsonify({
                    'drives': drives,
                    'parent': None,
                    'current_path': [],
                    'directories': []
                })
            else:
                # For Unix-like systems, start at root
                path = "/"
        
        # Check if the path exists
        if not os.path.exists(path):
            return jsonify({"error": f"Path does not exist: {path}"}), 404
        
        if is_restricted_path(path):
            return jsonify({"error": "Access denied"}), 403
        # Get parent directory
        parent = os.path.dirname(path) if path and path != "/" else None
        
        # On Windows, if we're at a root drive path (e.g., "C:\"), parent should be empty string
        if platform.system() == 'Windows' and parent and len(path) <= 4 and path.endswith(':\\'):
            parent = ''
            
        # List directories at the current path
        directories = []
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    directories.append({
                        'name': item,
                        'path': item_path,
                        'type': 'directory'
                    })
            
            # Sort directories by name
            directories.sort(key=lambda x: x['name'].lower())
            
            # Format current path for breadcrumb
            if platform.system() == 'Windows':
                # Fix for Windows paths to handle drive letters properly
                if path.endswith(':\\'):
                    # For root of a drive (e.g., "C:\")
                    path_parts = [path[0:2]]  # Take just "C:"
                else:
                    # Split the path but preserve drive letter
                    if ':' in path:
                        # Split drive and rest of path
                        drive, rest = os.path.splitdrive(path)
                        # Split the rest of the path
                        rest_parts = [p for p in rest.split('\\') if p]
                        # Combine with drive letter
                        path_parts = [drive] + rest_parts
                    else:
                        path_parts = [p for p in path.split('\\') if p]
            else:
                # For Unix systems, split by forward slash
                path_parts = [p for p in path.split('/') if p]
                
            return jsonify({
                'directories': directories,
                'parent': parent,
                'current_path': path_parts
            })
        except PermissionError:
            return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def is_restricted_path(path):
    """Check if a path is restricted from user access"""
    # Convert path to lowercase for case-insensitive comparison
    path_lower = path.lower()
    
    # List of restricted system directories and paths
    restricted_paths = [
        "c:\\windows", 
        "c:\\users\\default",
        "c:\\users\\public",
        "c:\\users\\administrator",
        "c:\\users\\all users",
        "c:\\programdata", 
        "/etc",
        "/bin",
        "/sbin",
        "/var",
        "/usr",
        "/lib",
        "/boot",
        "/root",
        "/sys",
        "/proc"
    ]
    
    # Check against restricted paths
    for restricted in restricted_paths:
        if path_lower.startswith(restricted.lower()):
            return True
    
    return False

@app.route('/api/change_directory', methods=['POST'])
@login_required
def change_directory():
    try:
        data = request.get_json()
        new_path = data.get('path')
        
        if not new_path:
            return jsonify({"error": "No path provided"}), 400
            
        # Check if the path exists and is a directory
        if not os.path.exists(new_path) or not os.path.isdir(new_path):
            return jsonify({"error": "Invalid directory path"}), 400
        
        # Check if the path is restricted
        if is_restricted_path(new_path):
            return jsonify({"error": "Access to system directories is restricted"}), 403
            
        # Update the BASE_DIR global variable
        global BASE_DIR
        BASE_DIR = new_path
        
        return jsonify({
            "success": True,
            "path": new_path
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    # Create needed directories
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    # Check if ffmpeg is installed
    if not is_ffmpeg_installed():
        print("\n⚠️ WARNING: ffmpeg is not installed or not in PATH. Thumbnails will not be generated.")
        print("To install ffmpeg:")
        print("  - Windows: Download from https://ffmpeg.org/download.html and add to PATH")
        print("  - macOS: Run 'brew install ffmpeg'")
        print("  - Linux: Run 'sudo apt-get install ffmpeg' or equivalent for your distro")
    else:
        print("\n✅ ffmpeg is installed. Thumbnails will be generated.")
        # Start background thumbnail generator
        thumb_thread = threading.Thread(target=thumbnail_generator_thread, daemon=True)
        thumb_thread.start()

    # Get local IP address
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print(f"\n{'='*50}")
    print(f"Media Browser Server")
    print(f"{'='*50}")
    print(f"Base directory: {BASE_DIR}")
    print(f"Access from your phone at: http://{local_ip}:5000")
    print(f"Or on this computer at: http://localhost:5000")
    print(f"{'='*50}\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False)