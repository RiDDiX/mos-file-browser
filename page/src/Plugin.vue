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
        <button class="btn" @click="triggerUpload">
          <span class="icon">⬆️</span> Upload
        </button>
        <button class="btn" @click="showSearchDialog = true">
          <span class="icon">🔍</span> Search
        </button>
        <button class="btn" @click="calculateAllSizes" :disabled="calculatingAll">
          <span class="icon">📊</span> {{ calculatingAll ? 'Calculating...' : 'Calc All Sizes' }}
        </button>
        <button class="btn" @click="showDiskUsage">
          <span class="icon">💿</span> Disk Usage
        </button>
        <label class="checkbox-label">
          <input type="checkbox" v-model="showHidden" @change="refresh" />
          Show Hidden
        </label>
      </div>
      <input 
        type="file" 
        ref="fileInput" 
        style="display: none" 
        multiple 
        @change="handleFileUpload"
      />
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
            <th class="col-calcsize">Calc Size</th>
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
            <td class="col-calcsize">
              <span v-if="item.calculatedSize" class="calc-size-value">{{ item.calculatedSize }}</span>
              <button 
                v-else 
                class="btn btn-icon btn-small" 
                @click.stop="calculateSingleItemSize(item)" 
                :disabled="item.calculating"
                title="Calculate Size"
              >
                {{ item.calculating ? '⏳' : '📊' }}
              </button>
            </td>
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
            <td colspan="7" class="empty-message">
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
      <div class="menu-item" @click="showChmodDialog(contextMenu.item)">🔐 Chmod</div>
      <div class="menu-item" @click="showChownDialog(contextMenu.item)">👤 Chown</div>
      <div class="menu-item" v-if="!contextMenu.item?.isDir" @click="downloadFile(contextMenu.item)">⬇️ Download</div>
      <div class="menu-item" v-if="contextMenu.item?.isDir" @click="compressDirectory(contextMenu.item)">📦 Compress</div>
      <div class="menu-item" v-if="isArchive(contextMenu.item?.name)" @click="extractArchive(contextMenu.item)">📂 Extract</div>
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

    <!-- Chmod Dialog -->
    <div v-if="chmodDialogVisible" class="dialog-overlay" @click.self="chmodDialogVisible = false">
      <div class="dialog">
        <h3>🔐 Change Permissions</h3>
        <p class="dialog-subtitle">{{ chmodTarget?.name }}</p>
        <div class="chmod-grid">
          <div class="chmod-section">
            <h4>Owner</h4>
            <label><input type="checkbox" v-model="chmodValues.ownerRead" /> Read</label>
            <label><input type="checkbox" v-model="chmodValues.ownerWrite" /> Write</label>
            <label><input type="checkbox" v-model="chmodValues.ownerExecute" /> Execute</label>
          </div>
          <div class="chmod-section">
            <h4>Group</h4>
            <label><input type="checkbox" v-model="chmodValues.groupRead" /> Read</label>
            <label><input type="checkbox" v-model="chmodValues.groupWrite" /> Write</label>
            <label><input type="checkbox" v-model="chmodValues.groupExecute" /> Execute</label>
          </div>
          <div class="chmod-section">
            <h4>Others</h4>
            <label><input type="checkbox" v-model="chmodValues.othersRead" /> Read</label>
            <label><input type="checkbox" v-model="chmodValues.othersWrite" /> Write</label>
            <label><input type="checkbox" v-model="chmodValues.othersExecute" /> Execute</label>
          </div>
        </div>
        <div class="chmod-octal">
          <label>Octal: <input type="text" v-model="chmodOctal" maxlength="4" class="octal-input" /></label>
          <label class="checkbox-label"><input type="checkbox" v-model="chmodRecursive" /> Recursive</label>
        </div>
        <div class="dialog-actions">
          <button class="btn" @click="chmodDialogVisible = false">Cancel</button>
          <button class="btn btn-primary" @click="doChmod">Apply</button>
        </div>
      </div>
    </div>

    <!-- Chown Dialog -->
    <div v-if="chownDialogVisible" class="dialog-overlay" @click.self="chownDialogVisible = false">
      <div class="dialog">
        <h3>👤 Change Owner</h3>
        <p class="dialog-subtitle">{{ chownTarget?.name }}</p>
        <input v-model="chownOwner" placeholder="Owner (e.g., root)" class="dialog-input" />
        <input v-model="chownGroup" placeholder="Group (e.g., root)" class="dialog-input" />
        <label class="checkbox-label">
          <input type="checkbox" v-model="chownRecursive" /> Recursive
        </label>
        <div class="dialog-actions">
          <button class="btn" @click="chownDialogVisible = false">Cancel</button>
          <button class="btn btn-primary" @click="doChown">Apply</button>
        </div>
      </div>
    </div>

    <!-- Search Dialog -->
    <div v-if="showSearchDialog" class="dialog-overlay" @click.self="showSearchDialog = false">
      <div class="dialog dialog-wide">
        <h3>🔍 Search Files</h3>
        <div class="search-inputs">
          <input 
            v-model="searchPattern" 
            placeholder="Search pattern (e.g., *.log, config*)"
            class="dialog-input"
            @keyup.enter="doSearch"
          />
          <select v-model="searchType" class="dialog-select">
            <option value="name">By Name</option>
            <option value="content">By Content (grep)</option>
          </select>
        </div>
        <label class="checkbox-label">
          <input type="checkbox" v-model="searchRecursive" /> Search subdirectories
        </label>
        <div class="search-results" v-if="searchResults.length > 0">
          <h4>Results ({{ searchResults.length }})</h4>
          <div 
            v-for="result in searchResults" 
            :key="result" 
            class="search-result-item"
            @click="navigateToSearchResult(result)"
          >
            {{ result }}
          </div>
        </div>
        <div v-if="searching" class="loading">
          <span class="spinner"></span> Searching...
        </div>
        <div class="dialog-actions">
          <button class="btn" @click="showSearchDialog = false">Close</button>
          <button class="btn btn-primary" @click="doSearch" :disabled="searching">Search</button>
        </div>
      </div>
    </div>

    <!-- Disk Usage Dialog -->
    <div v-if="diskUsageDialogVisible" class="dialog-overlay" @click.self="diskUsageDialogVisible = false">
      <div class="dialog dialog-wide">
        <h3>💿 Disk Usage</h3>
        <pre class="info-content">{{ diskUsageInfo }}</pre>
        <div class="dialog-actions">
          <button class="btn" @click="diskUsageDialogVisible = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Upload Progress Dialog -->
    <div v-if="uploading" class="dialog-overlay">
      <div class="dialog">
        <h3>⬆️ Uploading Files</h3>
        <div class="upload-progress">
          <div class="upload-file-info">
            <span class="upload-filename">{{ uploadFileName }}</span>
            <span class="upload-count">({{ uploadCurrent }} / {{ uploadTotal }})</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ uploadProgress }}%</div>
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
const chmodDialogVisible = ref(false);
const chownDialogVisible = ref(false);
const showSearchDialog = ref(false);
const diskUsageDialogVisible = ref(false);

// File input ref
const fileInput = ref(null);

// Upload progress state
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadFileName = ref('');
const uploadQueue = ref([]);
const uploadCurrent = ref(0);
const uploadTotal = ref(0);

// Calculating all sizes
const calculatingAll = ref(false);

// Chmod state
const chmodTarget = ref(null);
const chmodValues = ref({
  ownerRead: false, ownerWrite: false, ownerExecute: false,
  groupRead: false, groupWrite: false, groupExecute: false,
  othersRead: false, othersWrite: false, othersExecute: false,
});
const chmodOctal = ref('644');
const chmodRecursive = ref(false);

// Chown state
const chownTarget = ref(null);
const chownOwner = ref('');
const chownGroup = ref('');
const chownRecursive = ref(false);

// Search state
const searchPattern = ref('');
const searchType = ref('name');
const searchRecursive = ref(true);
const searchResults = ref([]);
const searching = ref(false);

// Disk usage
const diskUsageInfo = ref('');

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
  { name: 'Plugins', path: '/var/www/mos-plugins', icon: '🔌' },
  { name: 'Home', path: '/root', icon: '🏠' },
  { name: 'Etc', path: '/etc', icon: '📋' },
  { name: 'Var', path: '/var', icon: '📊' },
  { name: 'Tmp', path: '/tmp', icon: '🗑️' },
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

// API call helper (for query API - commands from /usr/bin/plugins)
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  return await response.json();
};

// ============================================================================
// Native MOS API Functions (direct API calls, more reliable)
// ============================================================================

// Read file content using native MOS API
const mosReadFile = async (filePath) => {
  const response = await fetch(`/api/v1/mos/readfile?path=${encodeURIComponent(filePath)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to read file: ${response.status}`);
  }
  
  return await response.json();
};

// Create folder using native MOS API
const mosCreateFolder = async (folderPath, options = {}) => {
  const { user = '500', group = '500', permissions = '755' } = options;
  
  const response = await fetch('/api/v1/mos/createfolder', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: folderPath, user, group, permissions }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create folder: ${response.status}`);
  }
  
  return await response.json();
};

// Create file using native MOS API
const mosCreateFile = async (filePath, content = '', options = {}) => {
  const { user = '500', group = '500', permissions = '644' } = options;
  
  const response = await fetch('/api/v1/mos/createfile', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath, content, user, group, permissions }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create file: ${response.status}`);
  }
  
  return await response.json();
};

// Edit file using native MOS API
const mosEditFile = async (filePath, content, createBackup = false) => {
  const response = await fetch('/api/v1/mos/editfile', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath, content, create_backup: createBackup }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to edit file: ${response.status}`);
  }
  
  return await response.json();
};

// Delete file/folder using native MOS API
const mosDelete = async (filePath, options = {}) => {
  const { force = true, recursive = false } = options;
  
  const response = await fetch('/api/v1/mos/delete', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath, force, recursive }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete: ${response.status}`);
  }
  
  return await response.json();
};

// Change ownership using native MOS API
const mosChown = async (filePath, user, group, recursive = false) => {
  const response = await fetch('/api/v1/mos/chown', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath, user, group, recursive }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to change ownership: ${response.status}`);
  }
  
  return await response.json();
};

// Change permissions using native MOS API
const mosChmod = async (filePath, permissions, recursive = false) => {
  const response = await fetch('/api/v1/mos/chmod', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath, permissions, recursive }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to change permissions: ${response.status}`);
  }
  
  return await response.json();
};

// Write file content using MOS API
// Uses /mos/createfile for new files, /mos/editfile for existing files
const writeFileContent = async (filePath, content, isNewFile = false) => {
  // For new files, try createfile first
  if (isNewFile) {
    const response = await fetch('/api/v1/mos/createfile', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath,
        content: content,
        user: '500',
        group: '500',
        permissions: '644',
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    // If file already exists, fall through to editfile
    const errorData = await response.json().catch(() => ({}));
    if (!errorData.error?.includes('already exists')) {
      throw new Error(errorData.error || `Failed to create file: ${response.status}`);
    }
  }
  
  // Use editfile for existing files
  const response = await fetch('/api/v1/mos/editfile', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: filePath,
      content: content,
      create_backup: false,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save file: ${response.status}`);
  }
  
  return await response.json();
};

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Upload binary file via parallel chunked base64 encoding
// Optimized for speed within API rate limits (20 req/s)
const writeBinaryContent = async (filePath, base64Content, onProgress = null) => {
  const tempPath = filePath + '.b64tmp';
  const CHUNK_SIZE = 60000; // ~60KB chunks (safe under 100KB API limit)
  const PARALLEL_REQUESTS = 5; // Parallel requests per batch
  const BATCH_DELAY = 300; // 300ms between batches (5 req / 300ms = ~16 req/s, under 20 limit)
  
  const totalChunks = Math.ceil(base64Content.length / CHUNK_SIZE);
  const chunkFiles = [];
  let completedChunks = 0;
  
  try {
    // Prepare all chunk data
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = base64Content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkPath = `${tempPath}.chunk${i}`;
      chunkFiles.push(chunkPath);
      chunks.push({ path: chunkPath, content: chunk, index: i });
    }
    
    // Upload chunks in parallel batches
    for (let batchStart = 0; batchStart < chunks.length; batchStart += PARALLEL_REQUESTS) {
      const batch = chunks.slice(batchStart, batchStart + PARALLEL_REQUESTS);
      
      // Upload batch in parallel
      await Promise.all(batch.map(async ({ path, content }) => {
        await mosCreateFile(path, content);
        completedChunks++;
        if (onProgress) {
          onProgress(Math.round((completedChunks / totalChunks) * 80));
        }
      }));
      
      // Delay between batches to respect rate limit
      if (batchStart + PARALLEL_REQUESTS < chunks.length) {
        await delay(BATCH_DELAY);
      }
    }
    
    if (onProgress) onProgress(85);
    
    // Concatenate chunk files into base64 temp file
    await apiCall('fb-b64cat', [tempPath, ...chunkFiles], 120);
    
    if (onProgress) onProgress(90);
    
    // Decode base64 to final binary file
    await apiCall('fb-b64decode', [tempPath, filePath], 120);
    
    if (onProgress) onProgress(100);
    
    return { success: true };
  } catch (e) {
    // Cleanup temp files on error
    try { 
      await apiCall('rm', ['-f', tempPath, ...chunkFiles]); 
    } catch {}
    throw new Error('Failed to upload binary file. Please reinstall the plugin. Error: ' + e.message);
  }
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
    await mosCreateFolder(path);
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
    await mosCreateFile(path, '');
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
    await mosDelete(path, { recursive: deleteTarget.value.isDir });
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
    const result = await mosReadFile(path);
    
    if (result.content !== undefined) {
      editorContent.value = result.content;
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
    await mosEditFile(editingFile.value, editorContent.value);
    notify('File saved', 'success');
    showEditor.value = false;
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

// Calculate single item size and store in item
const calculateSingleItemSize = async (item) => {
  const path = currentPath.value + '/' + item.name;
  item.calculating = true;
  
  try {
    const result = await apiCall('du', ['-sh', path], 120);
    if (result.output) {
      const match = result.output.match(/^(\S+)/);
      item.calculatedSize = match ? match[1] : result.output.trim();
    }
  } catch (e) {
    item.calculatedSize = 'Error';
    notify('Size calculation failed: ' + e.message, 'error');
  } finally {
    item.calculating = false;
  }
};

// Calculate all sizes
const calculateAllSizes = async () => {
  calculatingAll.value = true;
  notify('Calculating sizes for all items...', 'info');
  
  for (const item of items.value) {
    if (!item.calculatedSize) {
      await calculateSingleItemSize(item);
    }
  }
  
  calculatingAll.value = false;
  notify('All sizes calculated', 'success');
};

// Chmod functions
const parsePermissions = (perms) => {
  if (!perms || perms.length < 10) return;
  chmodValues.value = {
    ownerRead: perms[1] === 'r',
    ownerWrite: perms[2] === 'w',
    ownerExecute: perms[3] === 'x' || perms[3] === 's',
    groupRead: perms[4] === 'r',
    groupWrite: perms[5] === 'w',
    groupExecute: perms[6] === 'x' || perms[6] === 's',
    othersRead: perms[7] === 'r',
    othersWrite: perms[8] === 'w',
    othersExecute: perms[9] === 'x' || perms[9] === 't',
  };
  updateOctalFromCheckboxes();
};

const updateOctalFromCheckboxes = () => {
  const owner = (chmodValues.value.ownerRead ? 4 : 0) + (chmodValues.value.ownerWrite ? 2 : 0) + (chmodValues.value.ownerExecute ? 1 : 0);
  const group = (chmodValues.value.groupRead ? 4 : 0) + (chmodValues.value.groupWrite ? 2 : 0) + (chmodValues.value.groupExecute ? 1 : 0);
  const others = (chmodValues.value.othersRead ? 4 : 0) + (chmodValues.value.othersWrite ? 2 : 0) + (chmodValues.value.othersExecute ? 1 : 0);
  chmodOctal.value = `${owner}${group}${others}`;
};

const showChmodDialog = (item) => {
  closeContextMenu();
  chmodTarget.value = item;
  parsePermissions(item.permissions);
  chmodRecursive.value = false;
  chmodDialogVisible.value = true;
};

const doChmod = async () => {
  if (!chmodTarget.value) return;
  const path = currentPath.value + '/' + chmodTarget.value.name;
  
  try {
    await mosChmod(path, chmodOctal.value, chmodRecursive.value);
    notify('Permissions changed', 'success');
    chmodDialogVisible.value = false;
    refresh();
  } catch (e) {
    notify('Failed to change permissions: ' + e.message, 'error');
  }
};

// Chown functions
const showChownDialog = (item) => {
  closeContextMenu();
  chownTarget.value = item;
  chownOwner.value = '';
  chownGroup.value = '';
  chownRecursive.value = false;
  chownDialogVisible.value = true;
};

const doChown = async () => {
  if (!chownTarget.value || (!chownOwner.value && !chownGroup.value)) return;
  const path = currentPath.value + '/' + chownTarget.value.name;
  
  try {
    await mosChown(path, chownOwner.value || '500', chownGroup.value || '500', chownRecursive.value);
    notify('Owner changed', 'success');
    chownDialogVisible.value = false;
    refresh();
  } catch (e) {
    notify('Failed to change owner: ' + e.message, 'error');
  }
};

// Upload functions
const triggerUpload = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
  const fileList = Array.from(files);
  
  // Filter out too large files
  const validFiles = fileList.filter(file => {
    if (file.size > MAX_FILE_SIZE) {
      notify(`Skipped ${file.name}: File too large (max 50MB)`, 'error');
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) {
    event.target.value = '';
    return;
  }
  
  // Start upload progress display
  uploading.value = true;
  uploadTotal.value = validFiles.length;
  uploadCurrent.value = 0;
  
  for (const file of validFiles) {
    uploadCurrent.value++;
    uploadFileName.value = file.name;
    uploadProgress.value = 0;
    
    try {
      const isTextFile = file.type.startsWith('text/') || isEditable(file.name);
      const path = currentPath.value + '/' + file.name;
      
      // Read file with progress simulation
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            uploadProgress.value = Math.round((e.loaded / e.total) * 50); // 0-50% for reading
          }
        };
        
        reader.onload = (e) => {
          uploadProgress.value = 50;
          resolve(e.target.result);
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        if (isTextFile) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file); // Read as base64 data URL for binary
        }
      });
      
      uploadProgress.value = 60;
      
      // Upload file
      if (isTextFile) {
        await writeFileContent(path, content, true);
      } else {
        // Extract base64 content from data URL (remove "data:...;base64," prefix)
        const base64Content = content.split(',')[1] || content;
        await writeBinaryContent(path, base64Content);
      }
      
      uploadProgress.value = 100;
      notify(`Uploaded: ${file.name}`, 'success');
      
    } catch (err) {
      notify(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }
  
  uploading.value = false;
  uploadProgress.value = 0;
  uploadFileName.value = '';
  event.target.value = '';
  refresh();
};

// Download function
const downloadFile = async (item) => {
  closeContextMenu();
  const path = currentPath.value + '/' + item.name;
  
  try {
    const result = await apiCall('cat', [path]);
    if (result.output !== undefined) {
      const blob = new Blob([result.output], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('Download started', 'success');
    }
  } catch (e) {
    notify('Download failed: ' + e.message, 'error');
  }
};

// Compress function
const compressDirectory = async (item) => {
  closeContextMenu();
  const path = currentPath.value + '/' + item.name;
  const archiveName = item.name + '.tar.gz';
  const archivePath = currentPath.value + '/' + archiveName;
  
  try {
    notify('Compressing...', 'info');
    await apiCall('tar', ['-czf', archivePath, '-C', currentPath.value, item.name], 120);
    notify(`Created: ${archiveName}`, 'success');
    refresh();
  } catch (e) {
    notify('Compression failed: ' + e.message, 'error');
  }
};

// Extract function
const extractArchive = async (item) => {
  closeContextMenu();
  const path = currentPath.value + '/' + item.name;
  
  try {
    notify('Extracting...', 'info');
    if (item.name.endsWith('.tar.gz') || item.name.endsWith('.tgz')) {
      await apiCall('tar', ['-xzf', path, '-C', currentPath.value], 120);
    } else if (item.name.endsWith('.tar')) {
      await apiCall('tar', ['-xf', path, '-C', currentPath.value], 120);
    } else if (item.name.endsWith('.zip')) {
      await apiCall('unzip', ['-o', path, '-d', currentPath.value], 120);
    } else if (item.name.endsWith('.gz')) {
      await apiCall('gunzip', ['-k', path], 120);
    }
    notify('Extraction complete', 'success');
    refresh();
  } catch (e) {
    notify('Extraction failed: ' + e.message, 'error');
  }
};

// Check if file is archive
const isArchive = (filename) => {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || 
         lower.endsWith('.tar') || lower.endsWith('.zip') || 
         lower.endsWith('.gz') || lower.endsWith('.rar') || 
         lower.endsWith('.7z');
};

// Search functions
const doSearch = async () => {
  if (!searchPattern.value.trim()) return;
  
  searching.value = true;
  searchResults.value = [];
  
  try {
    let result;
    if (searchType.value === 'name') {
      const maxdepth = searchRecursive.value ? [] : ['-maxdepth', '1'];
      result = await apiCall('find', [currentPath.value, ...maxdepth, '-name', searchPattern.value], 60);
    } else {
      const args = searchRecursive.value 
        ? ['-r', '-l', searchPattern.value, currentPath.value]
        : ['-l', searchPattern.value, currentPath.value + '/*'];
      result = await apiCall('grep', args, 60);
    }
    
    if (result.output) {
      searchResults.value = result.output.split('\n').filter(l => l.trim()).slice(0, 100);
    }
    
    if (searchResults.value.length === 0) {
      notify('No results found', 'info');
    }
  } catch (e) {
    notify('Search failed: ' + e.message, 'error');
  } finally {
    searching.value = false;
  }
};

const navigateToSearchResult = (result) => {
  const parts = result.split('/');
  parts.pop(); // Remove filename
  const dir = parts.join('/') || '/';
  loadDirectory(dir);
  showSearchDialog.value = false;
};

// Disk usage
const showDiskUsage = async () => {
  try {
    const result = await apiCall('df', ['-h']);
    diskUsageInfo.value = result.output || 'No data';
    diskUsageDialogVisible.value = true;
  } catch (e) {
    notify('Failed to get disk usage: ' + e.message, 'error');
  }
};

// Watch chmod checkboxes to update octal
watch(chmodValues, updateOctalFromCheckboxes, { deep: true });

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

/* Calc Size Column */
.col-calcsize { 
  width: 100px; 
  text-align: center;
}

.calc-size-value {
  color: #4fc3f7;
  font-family: monospace;
  font-size: 12px;
}

/* Dialog improvements */
.dialog-wide {
  min-width: 600px;
  max-width: 800px;
}

.dialog-subtitle {
  color: #888;
  font-size: 14px;
  margin-bottom: 16px;
  font-family: monospace;
}

.dialog-input {
  width: 100%;
  padding: 12px;
  background: #3d3d3d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  margin-bottom: 12px;
}

.dialog-select {
  padding: 12px;
  background: #3d3d3d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  margin-bottom: 12px;
}

/* Chmod Dialog */
.chmod-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.chmod-section {
  background: #3d3d3d;
  padding: 12px;
  border-radius: 8px;
}

.chmod-section h4 {
  margin: 0 0 8px 0;
  color: #4fc3f7;
  font-size: 14px;
}

.chmod-section label {
  display: block;
  padding: 4px 0;
  cursor: pointer;
}

.chmod-section input[type="checkbox"] {
  margin-right: 8px;
  width: auto;
  margin-bottom: 0;
}

.chmod-octal {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.octal-input {
  width: 80px !important;
  text-align: center;
  font-family: monospace;
  font-size: 16px;
}

/* Search Dialog */
.search-inputs {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.search-inputs .dialog-input {
  flex: 1;
  margin-bottom: 0;
}

.search-inputs .dialog-select {
  width: 180px;
  margin-bottom: 0;
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
  background: #1a1a1a;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}

.search-results h4 {
  margin: 0 0 8px 0;
  color: #4fc3f7;
}

.search-result-item {
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  word-break: break-all;
}

.search-result-item:hover {
  background: #3d3d3d;
}

/* Upload Progress */
.upload-progress {
  padding: 16px 0;
}

.upload-file-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.upload-filename {
  font-weight: 500;
  color: #e0e0e0;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-count {
  color: #888;
  font-size: 13px;
}

.progress-bar-container {
  width: 100%;
  height: 20px;
  background: #3d3d3d;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #29b6f6);
  border-radius: 10px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  color: #4fc3f7;
  font-weight: 500;
  font-size: 14px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chmod-grid {
    grid-template-columns: 1fr;
  }
  
  .search-inputs {
    flex-direction: column;
  }
  
  .search-inputs .dialog-select {
    width: 100%;
  }
  
  .dialog-wide {
    min-width: auto;
  }
}
</style>
