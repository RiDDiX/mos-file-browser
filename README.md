# MOS FileBrowser Plugin

A comprehensive file browser plugin for MOS (MountainOS) that allows you to browse, edit, and manage files directly from the MOS web interface.

## Features

- **Browse Files**: Navigate through disks, shares, and pools
- **Edit Files**: Edit text and configuration files with syntax highlighting
- **File Operations**: Copy, move, rename, and delete files and directories
- **Size Calculation**: Calculate and display directory sizes
- **Integration**: Quick access from Disks, Shares, and Pools pages

## Installation

### Via MOS Hub
1. Open MOS Hub in your MOS interface
2. Search for "FileBrowser"
3. Click Install

### Manual Installation
```bash
dpkg -i mos-file-browser-VERSION-ARCH.deb
```

## Usage

### From Plugin Page
Navigate to Plugins → FileBrowser to access the full file browser interface.

### From Disks/Shares/Pools
Click the folder icon next to any disk, share, or pool to open it directly in the FileBrowser.

## Supported File Types for Editing

- Text files (.txt)
- Configuration files (.conf, .cfg, .ini)
- JSON files (.json)
- YAML files (.yaml, .yml)
- XML files (.xml)
- Shell scripts (.sh, .bash)
- Python scripts (.py)
- And more...

## API Functions

The plugin provides the following functions via the MOS API:

| Function | Description |
|----------|-------------|
| `listdir` | List directory contents |
| `readfile` | Read file content |
| `writefile` | Write/save file content |
| `copyitem` | Copy file or directory |
| `moveitem` | Move file or directory |
| `deleteitem` | Delete file or directory |
| `createdir` | Create new directory |
| `calcsize` | Calculate directory size |
| `renameitem` | Rename file or directory |
| `fileinfo` | Get detailed file information |
| `searchfiles` | Search for files by pattern |

## License

MIT License

## Author

RiDDiX
