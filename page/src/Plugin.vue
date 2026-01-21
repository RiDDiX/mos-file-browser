<template>
  <div class="file-browser">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="breadcrumb">
        <button class="btn btn-icon" @click="goUp" :disabled="currentPath === '/'">
          <span class="icon">⬆️</span>
        </button>
        <button class="btn btn-icon" @click="goHome">
          <span class="icon">🏠</span>
        </button>
        <button class="btn btn-icon" @click="refresh">
          <span class="icon">🔄</span>
        </button>
        <div class="path-display">
          <span 
            v-for="(part, idx) in pathParts" 
            :key="idx"
            class="path-part"
            @click="navigateToPathPart(idx)"
          >
            {{ part || '/' }}
            <span v-if="idx < pathParts.length - 1" class="separator">/</span>
          </span>
        </div>
      </div>
      <div class="actions">
        <button class="btn" @click="showNewFolderDialog = true">
          <span class="icon">📁</span> New Folder
        </button>
        <button class="btn" @click="showNewFileDialog = true">
          <span class="icon">📄</span> New File
        </button>
        <button class="btn" @click="calculateCurrentSize" :disabled="calculating">
          <span class="icon">📊</span> {{ calculating ? 'Calculating...' : 'Calc Size' }}
        </button>
        <label class="checkbox-label">
          <input type="checkbox" v-model="showHidden" @change="refresh" />
          Show Hidden
        </label>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="quick-nav">
      <button 
        v-for="qp in quickPaths" 
        :key="qp.path" 
        class="btn btn-small"
        @click="navigateTo(qp.path)"
        :class="{ active: currentPath === qp.path }"
      >
        <span class="icon">{{ qp.icon }}</span> {{ qp.name }}
      </button>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="loading">
      <span class="spinner"></span> Loading...
    </div>
    <div v-if="error" class="error-message">
      ❌ {{ error }}
      <button class="btn btn-small" @click="error = null">Dismiss</button>
    </div>

    <!-- File List -->
    <div class="file-list" v-if="!loading">
      <table>
        <thead>
          <tr>
            <th class="col-icon"></th>
            <th class="col-name" @click="sortBy('name')">
              Name {{ sortField === 'name' ? (sortAsc ? '▲' : '▼') : '' }}
            </th>
            <th class="col-size" @click="sortBy('size')">
              Size {{ sortField === 'size' ? (sortAsc ? '▲' : '▼') : '' }}
            </th>
            <th class="col-date" @click="sortBy('date')">
              Modified {{ sortField === 'date' ? (sortAsc ? '▲' : '▼') : '' }}
            </th>
            <th class="col-perms">Permissions</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in sortedItems" 
            :key="item.name"
            :class="{ selected: selectedItems.includes(item.name), directory: item.isDir }"
            @click="selectItem(item, $event)"
            @dblclick="openItem(item)"
          >
            <td class="col-icon">
              <span class="icon">{{ item.isDir ? '📁' : getFileIcon(item.name) }}</span>
            </td>
            <td class="col-name">{{ item.name }}</td>
            <td class="col-size">{{ item.isDir ? '-' : formatSize(item.size) }}</td>
            <td class="col-date">{{ item.modified }}</td>
            <td class="col-perms">{{ item.permissions }}</td>
            <td class="col-actions">
              <button class="btn btn-icon btn-small" @click.stop="showContextMenu(item, $event)" title="More">
                ⋮
              </button>
              <button v-if="!item.isDir && isEditable(item.name)" class="btn btn-icon btn-small" @click.stop="editFile(item)" title="Edit">
                ✏️
              </button>
              <button class="btn btn-icon btn-small" @click.stop="confirmDelete(item)" title="Delete">
                🗑️
              </button>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="6" class="empty-message">
              📂 This directory is empty
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <span>{{ items.length }} items</span>
      <span v-if="selectedItems.length > 0">| {{ selectedItems.length }} selected</span>
      <span v-if="dirSize">| Directory size: {{ dirSize }}</span>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show" 
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="copyItem(contextMenu.item)">📋 Copy</div>
      <div class="menu-item" @click="cutItem(contextMenu.item)">✂️ Cut</div>
      <div class="menu-item" @click="renameItem(contextMenu.item)">✏️ Rename</div>
      <div class="menu-item" @click="showInfoDialog(contextMenu.item)">ℹ️ Info</div>
      <div class="menu-item" @click="calculateItemSize(contextMenu.item)">📊 Calculate Size</div>
      <hr />
      <div class="menu-item danger" @click="confirmDelete(contextMenu.item)">🗑️ Delete</div>
    </div>

    <!-- Paste Button (when clipboard has items) -->
    <div v-if="clipboard.item" class="clipboard-indicator">
      📋 {{ clipboard.action === 'cut' ? 'Cut' : 'Copied' }}: {{ clipboard.item.name }}
      <button class="btn btn-small" @click="pasteItem">Paste Here</button>
      <button class="btn btn-small" @click="clipboard = {}">Cancel</button>
    </div>

    <!-- New Folder Dialog -->
    <div v-if="showNewFolderDialog" class="dialog-overlay" @click.self="showNewFolderDialog = false">
      <div class="dialog">
        <h3>Create New Folder</h3>
        <input 
          v-model="newFolderName" 
          placeholder="Folder name"
          @keyup.enter="createFolder"
          ref="newFolderInput"
        />
        <div class="dialog-actions">
          <button class="btn" @click="showNewFolderDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="createFolder">Create</button>
        </div>
      </div>
    </div>

    <!-- New File Dialog -->
    <div v-if="showNewFileDialog" class="dialog-overlay" @click.self="showNewFileDialog = false">
      <div class="dialog">
        <h3>Create New File</h3>
        <input 
          v-model="newFileName" 
          placeholder="File name"
          @keyup.enter="createFile"
        />
        <div class="dialog-actions">
          <button class="btn" @click="showNewFileDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="createFile">Create</button>
        </div>
      </div>
    </div>

    <!-- Rename Dialog -->
    <div v-if="showRenameDialog" class="dialog-overlay" @click.self="showRenameDialog = false">
      <div class="dialog">
        <h3>Rename</h3>
        <input 
          v-model="renameNewName" 
          placeholder="New name"
          @keyup.enter="doRename"
        />
        <div class="dialog-actions">
          <button class="btn" @click="showRenameDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="doRename">Rename</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click.self="showDeleteDialog = false">
      <div class="dialog">
        <h3>⚠️ Confirm Delete</h3>
        <p>Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?</p>
        <p v-if="deleteTarget?.isDir" class="warning">This is a directory. All contents will be deleted!</p>
        <div class="dialog-actions">
          <button class="btn" @click="showDeleteDialog = false">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- File Editor -->
    <div v-if="showEditor" class="dialog-overlay editor-overlay">
      <div class="dialog editor-dialog">
        <div class="editor-header">
          <h3>📝 {{ editingFile }}</h3>
          <button class="btn btn-icon" @click="closeEditor">✕</button>
        </div>
        <textarea 
          v-model="editorContent" 
          class="editor-textarea"
          spellcheck="false"
        ></textarea>
        <div class="dialog-actions">
          <span class="editor-info">{{ editorContent.length }} characters</span>
          <button class="btn" @click="closeEditor">Cancel</button>
          <button class="btn btn-primary" @click="saveFile" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- File Info Dialog -->
    <div v-if="showInfoDialogVisible" class="dialog-overlay" @click.self="showInfoDialogVisible = false">
      <div class="dialog">
        <h3>ℹ️ File Information</h3>
        <pre class="info-content">{{ fileInfo }}</pre>
        <div class="dialog-actions">
          <button class="btn" @click="showInfoDialogVisible = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Notifications -->
    <div class="notifications">
      <div 
        v-for="(notif, idx) in notifications" 
        :key="idx" 
        class="notification"
        :class="notif.type"
      >
        {{ notif.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

const PLUGIN_NAME = 'mos-file-browser';

// State
const currentPath = ref('/mnt');
const items = ref([]);
const loading = ref(false);
const error = ref(null);
const showHidden = ref(false);
const selectedItems = ref([]);
const sortField = ref('name');
const sortAsc = ref(true);
const dirSize = ref('');
const calculating = ref(false);

// Dialogs
const showNewFolderDialog = ref(false);
const showNewFileDialog = ref(false);
const showRenameDialog = ref(false);
const showDeleteDialog = ref(false);
const showEditor = ref(false);
const showInfoDialogVisible = ref(false);

// Dialog data
const newFolderName = ref('');
const newFileName = ref('');
const renameNewName = ref('');
const renameTarget = ref(null);
const deleteTarget = ref(null);
const editingFile = ref('');
const editorContent = ref('');
const saving = ref(false);
const fileInfo = ref('');

// Context menu
const contextMenu = ref({ show: false, x: 0, y: 0, item: null });

// Clipboard
const clipboard = ref({});

// Notifications
const notifications = ref([]);

// Quick paths
const quickPaths = [
  { name: 'Root', path: '/', icon: '🖥️' },
  { name: 'Mnt', path: '/mnt', icon: '💾' },
  { name: 'Boot', path: '/boot', icon: '⚙️' },
  { name: 'Plugins', path: '/boot/config/plugins', icon: '🔌' },
  { name: 'Home', path: '/root', icon: '🏠' },
];

// Editable file extensions
const editableExtensions = [
  '.txt', '.conf', '.cfg', '.ini', '.json', '.yaml', '.yml', 
  '.xml', '.sh', '.bash', '.py', '.js', '.css', '.html', '.htm',
  '.md', '.log', '.config', '.env', '.gitignore', '.dockerignore',
  '.toml', '.properties', '.service', '.timer', '.socket'
];

// Auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Path parts for breadcrumb
const pathParts = computed(() => {
  if (currentPath.value === '/') return [''];
  return currentPath.value.split('/');
});

// Sorted items
const sortedItems = computed(() => {
  const sorted = [...items.value].sort((a, b) => {
    // Directories first
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    
    let cmp = 0;
    if (sortField.value === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField.value === 'size') {
      cmp = (a.size || 0) - (b.size || 0);
    } else if (sortField.value === 'date') {
      cmp = a.modified.localeCompare(b.modified);
    }
    return sortAsc.value ? cmp : -cmp;
  });
  return sorted;
});

// API call helper
const apiCall = async (command, args = [], timeout = 30) => {
  const response = await fetch('/api/v1/mos/plugins/query', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, args, timeout }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
};

// Execute plugin function
const executeFunction = async (func, ...args) => {
  const response = await fetch('/api/v1/mos/plugins/executefunction', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plugin: PLUGIN_NAME,
      function: func,
      args: args,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
};

// Parse ls output
const parseLsOutput = (output) => {
  const lines = output.split('\n').filter(l => l.trim());
  const result = [];
  
  for (const line of lines) {
    if (line.startsWith('total ')) continue;
    
    // Parse: drwxr-xr-x 2 root root 4096 2024-01-21 12:00 dirname
    const match = line.match(/^([drwx\-lsStT]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);
    if (match) {
      const [, permissions, size, modified, name] = match;
      
      // Skip . and ..
      if (name === '.' || name === '..') continue;
      
      // Skip hidden if not showing
      if (!showHidden.value && name.startsWith('.')) continue;
      
      result.push({
        name,
        permissions,
        size: parseInt(size),
        modified,
        isDir: permissions.startsWith('d'),
        isLink: permissions.startsWith('l'),
      });
    }
  }
  
  return result;
};

// Load directory
const loadDirectory = async (path) => {
  loading.value = true;
  error.value = null;
  selectedItems.value = [];
  dirSize.value = '';
  
  try {
    const result = await apiCall('ls', ['-la', '--time-style=long-iso', path]);
    
    if (result.output) {
      items.value = parseLsOutput(result.output);
      currentPath.value = path;
    } else {
      throw new Error('No output from ls command');
    }
  } catch (e) {
    error.value = e.message;
    items.value = [];
  } finally {
    loading.value = false;
  }
};

// Navigation
const navigateTo = (path) => loadDirectory(path);
const goUp = () => {
  const parts = currentPath.value.split('/').filter(p => p);
  parts.pop();
  loadDirectory('/' + parts.join('/') || '/');
};
const goHome = () => loadDirectory('/mnt');
const refresh = () => loadDirectory(currentPath.value);

const navigateToPathPart = (idx) => {
  const parts = pathParts.value.slice(0, idx + 1);
  const path = parts.join('/') || '/';
  loadDirectory(path);
};

// Open item
const openItem = (item) => {
  if (item.isDir) {
    const newPath = currentPath.value === '/' 
      ? '/' + item.name 
      : currentPath.value + '/' + item.name;
    loadDirectory(newPath);
  } else if (isEditable(item.name)) {
    editFile(item);
  }
};

// Select item
const selectItem = (item, event) => {
  if (event.ctrlKey) {
    const idx = selectedItems.value.indexOf(item.name);
    if (idx >= 0) {
      selectedItems.value.splice(idx, 1);
    } else {
      selectedItems.value.push(item.name);
    }
  } else {
    selectedItems.value = [item.name];
  }
  closeContextMenu();
};

// Sort
const sortBy = (field) => {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortField.value = field;
    sortAsc.value = true;
  }
};

// Context menu
const showContextMenu = (item, event) => {
  event.preventDefault();
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item,
  };
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

// File operations
const createFolder = async () => {
  if (!newFolderName.value.trim()) return;
  
  try {
    const path = currentPath.value + '/' + newFolderName.value.trim();
    await apiCall('mkdir', ['-p', path]);
    notify('Folder created', 'success');
    showNewFolderDialog.value = false;
    newFolderName.value = '';
    refresh();
  } catch (e) {
    notify('Failed to create folder: ' + e.message, 'error');
  }
};

const createFile = async () => {
  if (!newFileName.value.trim()) return;
  
  try {
    const path = currentPath.value + '/' + newFileName.value.trim();
    await apiCall('touch', [path]);
    notify('File created', 'success');
    showNewFileDialog.value = false;
    newFileName.value = '';
    refresh();
  } catch (e) {
    notify('Failed to create file: ' + e.message, 'error');
  }
};

const copyItem = (item) => {
  clipboard.value = { item, path: currentPath.value, action: 'copy' };
  closeContextMenu();
  notify(`Copied: ${item.name}`, 'info');
};

const cutItem = (item) => {
  clipboard.value = { item, path: currentPath.value, action: 'cut' };
  closeContextMenu();
  notify(`Cut: ${item.name}`, 'info');
};

const pasteItem = async () => {
  if (!clipboard.value.item) return;
  
  const src = clipboard.value.path + '/' + clipboard.value.item.name;
  const dst = currentPath.value + '/' + clipboard.value.item.name;
  
  try {
    if (clipboard.value.action === 'cut') {
      await apiCall('mv', [src, dst]);
    } else {
      await apiCall('cp', ['-r', src, dst]);
    }
    notify('Pasted successfully', 'success');
    clipboard.value = {};
    refresh();
  } catch (e) {
    notify('Paste failed: ' + e.message, 'error');
  }
};

const renameItem = (item) => {
  renameTarget.value = item;
  renameNewName.value = item.name;
  showRenameDialog.value = true;
  closeContextMenu();
};

const doRename = async () => {
  if (!renameNewName.value.trim() || !renameTarget.value) return;
  
  const oldPath = currentPath.value + '/' + renameTarget.value.name;
  const newPath = currentPath.value + '/' + renameNewName.value.trim();
  
  try {
    await apiCall('mv', [oldPath, newPath]);
    notify('Renamed successfully', 'success');
    showRenameDialog.value = false;
    renameTarget.value = null;
    refresh();
  } catch (e) {
    notify('Rename failed: ' + e.message, 'error');
  }
};

const confirmDelete = (item) => {
  deleteTarget.value = item;
  showDeleteDialog.value = true;
  closeContextMenu();
};

const doDelete = async () => {
  if (!deleteTarget.value) return;
  
  const path = currentPath.value + '/' + deleteTarget.value.name;
  
  try {
    if (deleteTarget.value.isDir) {
      await apiCall('rm', ['-rf', path]);
    } else {
      await apiCall('rm', [path]);
    }
    notify('Deleted successfully', 'success');
    showDeleteDialog.value = false;
    deleteTarget.value = null;
    refresh();
  } catch (e) {
    notify('Delete failed: ' + e.message, 'error');
  }
};

// File editing
const isEditable = (filename) => {
  const lower = filename.toLowerCase();
  return editableExtensions.some(ext => lower.endsWith(ext)) || !filename.includes('.');
};

const editFile = async (item) => {
  const path = currentPath.value + '/' + item.name;
  
  try {
    loading.value = true;
    const result = await apiCall('cat', [path]);
    
    if (result.output !== undefined) {
      editorContent.value = result.output;
      editingFile.value = path;
      showEditor.value = true;
    } else {
      throw new Error('Could not read file');
    }
  } catch (e) {
    notify('Failed to open file: ' + e.message, 'error');
  } finally {
    loading.value = false;
  }
};

const saveFile = async () => {
  saving.value = true;
  
  try {
    // Use executefunction to write file content
    await executeFunction('writefile', editingFile.value, editorContent.value);
    notify('File saved', 'success');
    closeEditor();
    refresh();
  } catch (e) {
    notify('Failed to save: ' + e.message, 'error');
  } finally {
    saving.value = false;
  }
};

const closeEditor = () => {
  showEditor.value = false;
  editingFile.value = '';
  editorContent.value = '';
};

// Size calculation
const calculateCurrentSize = async () => {
  calculating.value = true;
  try {
    const result = await apiCall('du', ['-sh', currentPath.value], 60);
    if (result.output) {
      const match = result.output.match(/^(\S+)/);
      dirSize.value = match ? match[1] : result.output.trim();
    }
  } catch (e) {
    notify('Size calculation failed: ' + e.message, 'error');
  } finally {
    calculating.value = false;
  }
};

const calculateItemSize = async (item) => {
  closeContextMenu();
  const path = currentPath.value + '/' + item.name;
  
  try {
    const result = await apiCall('du', ['-sh', path], 60);
    if (result.output) {
      const match = result.output.match(/^(\S+)/);
      const size = match ? match[1] : result.output.trim();
      notify(`${item.name}: ${size}`, 'info');
    }
  } catch (e) {
    notify('Size calculation failed: ' + e.message, 'error');
  }
};

// File info
const showInfoDialog = async (item) => {
  closeContextMenu();
  const path = currentPath.value + '/' + item.name;
  
  try {
    const [statResult, fileResult] = await Promise.all([
      apiCall('stat', [path]),
      apiCall('file', [path]),
    ]);
    
    fileInfo.value = `=== stat ===\n${statResult.output || 'N/A'}\n\n=== file ===\n${fileResult.output || 'N/A'}`;
    showInfoDialogVisible.value = true;
  } catch (e) {
    notify('Failed to get info: ' + e.message, 'error');
  }
};

// Helpers
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons = {
    txt: '📄', log: '📄', md: '📄',
    json: '📋', yaml: '📋', yml: '📋', xml: '📋', toml: '📋',
    sh: '⚙️', bash: '⚙️', py: '🐍', js: '📜',
    conf: '⚙️', cfg: '⚙️', ini: '⚙️', config: '⚙️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
    mp3: '🎵', wav: '🎵', flac: '🎵',
    mp4: '🎬', mkv: '🎬', avi: '🎬',
    zip: '📦', tar: '📦', gz: '📦', rar: '📦', '7z': '📦',
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  };
  return icons[ext] || '📄';
};

const notify = (message, type = 'info') => {
  notifications.value.push({ message, type });
  setTimeout(() => {
    notifications.value.shift();
  }, 3000);
};

// Global click handler
const handleGlobalClick = () => closeContextMenu();

onMounted(() => {
  loadDirectory(currentPath.value);
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
});

// Watch for new folder dialog to focus input
watch(showNewFolderDialog, async (val) => {
  if (val) {
    await nextTick();
  }
});
</script>

<style scoped>
.file-browser {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 16px;
  background: #1e1e1e;
  color: #e0e0e0;
  min-height: 100vh;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #2d2d2d;
  border-radius: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-display {
  background: #3d3d3d;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: monospace;
}

.path-part {
  cursor: pointer;
  color: #4fc3f7;
}

.path-part:hover {
  text-decoration: underline;
}

.separator {
  color: #666;
  margin: 0 2px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  background: #4a4a4a;
  border: none;
  color: #e0e0e0;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s;
}

.btn:hover {
  background: #5a5a5a;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  padding: 8px;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-primary {
  background: #1976d2;
}

.btn-primary:hover {
  background: #1565c0;
}

.btn-danger {
  background: #d32f2f;
}

.btn-danger:hover {
  background: #c62828;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.quick-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.quick-nav .btn.active {
  background: #1976d2;
}

.loading {
  padding: 40px;
  text-align: center;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message {
  background: #5d2020;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-list {
  background: #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #3d3d3d;
}

th {
  background: #3d3d3d;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #4d4d4d;
}

tr:hover {
  background: #3a3a3a;
}

tr.selected {
  background: #1a3a5c;
}

tr.directory {
  font-weight: 500;
}

.col-icon { width: 40px; text-align: center; }
.col-name { min-width: 200px; }
.col-size { width: 100px; }
.col-date { width: 150px; }
.col-perms { width: 120px; font-family: monospace; font-size: 12px; }
.col-actions { width: 120px; }

.empty-message {
  text-align: center;
  color: #888;
  padding: 40px;
}

.status-bar {
  padding: 8px 12px;
  background: #2d2d2d;
  border-radius: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.context-menu {
  position: fixed;
  background: #3d3d3d;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  z-index: 1000;
  min-width: 180px;
  overflow: hidden;
}

.menu-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #4d4d4d;
}

.menu-item.danger {
  color: #f44336;
}

.context-menu hr {
  border: none;
  border-top: 1px solid #555;
  margin: 0;
}

.clipboard-indicator {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #3d3d3d;
  padding: 12px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  z-index: 100;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #2d2d2d;
  padding: 24px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 90%;
}

.dialog h3 {
  margin: 0 0 16px 0;
}

.dialog input {
  width: 100%;
  padding: 12px;
  background: #3d3d3d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.warning {
  color: #ff9800;
}

.editor-overlay {
  padding: 20px;
}

.editor-dialog {
  width: 90%;
  max-width: 1200px;
  height: 80vh;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.editor-header h3 {
  margin: 0;
  font-family: monospace;
  font-size: 14px;
  color: #4fc3f7;
}

.editor-textarea {
  flex: 1;
  background: #1a1a1a;
  color: #e0e0e0;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  tab-size: 2;
}

.editor-info {
  color: #888;
  font-size: 12px;
}

.info-content {
  background: #1a1a1a;
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
}

.notifications {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification {
  padding: 12px 20px;
  border-radius: 8px;
  background: #3d3d3d;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  animation: slideIn 0.3s ease;
}

.notification.success { background: #2e7d32; }
.notification.error { background: #c62828; }
.notification.info { background: #1565c0; }

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.icon {
  font-size: 16px;
}
</style>
