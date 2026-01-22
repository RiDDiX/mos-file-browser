/**
 * MOS FileBrowser Loader
 * Injects folder icons into Disks, Pools, and Shares pages
 * to allow quick access to file browsing
 */
(function() {
  'use strict';

  const PLUGIN_NAME = 'mos-file-browser';
  const ICON_CLASS = 'mos-filebrowser-icon';
  
  // SVG folder icon
  const FOLDER_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  `;

  // Create and style the folder button
  function createFolderButton(path, title) {
    const btn = document.createElement('button');
    btn.className = ICON_CLASS;
    btn.innerHTML = FOLDER_ICON_SVG;
    btn.title = title || 'Browse files';
    btn.style.cssText = `
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      margin-left: 8px;
      color: #4fc3f7;
      opacity: 0.7;
      transition: opacity 0.2s, transform 0.2s;
      vertical-align: middle;
      display: inline-flex;
      align-items: center;
    `;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.transform = 'scale(1.1)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.7';
      btn.style.transform = 'scale(1)';
    });
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFileBrowser(path);
    });
    
    return btn;
  }

  // Open the file browser dialog/page
  function openFileBrowser(path) {
    // Try to use MOS plugin system to open the file browser
    const event = new CustomEvent('mos-open-file-browser', {
      detail: { path: path }
    });
    window.dispatchEvent(event);
    
    // Fallback: navigate to plugin page with path parameter
    const pluginUrl = `/plugins/${PLUGIN_NAME}?path=${encodeURIComponent(path)}`;
    
    // Check if we can use Vue router
    if (window.__MOS_ROUTER__) {
      window.__MOS_ROUTER__.push(pluginUrl);
    } else {
      // Try to find and click the plugin nav item, then set path
      sessionStorage.setItem('mos-file-browser-path', path);
      window.location.hash = pluginUrl;
    }
  }

  // Inject icons into disk/pool/share rows
  function injectFolderIcons() {
    // Remove existing icons first
    document.querySelectorAll('.' + ICON_CLASS).forEach(el => el.remove());
    
    // Find disk rows in Disks page
    const diskRows = document.querySelectorAll('[data-disk-path], [data-mount-point], .disk-row, .v-list-item');
    
    diskRows.forEach(row => {
      // Try to extract path from various attributes or content
      let path = row.dataset.diskPath || 
                 row.dataset.mountPoint || 
                 row.dataset.path ||
                 row.getAttribute('data-path');
      
      // If no data attribute, try to find path in row content
      if (!path) {
        const pathEl = row.querySelector('.mount-point, .path, [class*="path"], [class*="mount"]');
        if (pathEl) {
          path = pathEl.textContent.trim();
        }
      }
      
      // For /mnt/disk* patterns
      if (!path) {
        const text = row.textContent;
        const match = text.match(/\/mnt\/\S+/);
        if (match) {
          path = match[0];
        }
      }
      
      if (path && path.startsWith('/')) {
        // Find the title/name element to append icon
        const titleEl = row.querySelector('.v-list-item-title, .disk-name, .title, h3, h4, strong') || row;
        
        // Don't add duplicate icons
        if (!titleEl.querySelector('.' + ICON_CLASS)) {
          const btn = createFolderButton(path, `Browse ${path}`);
          titleEl.appendChild(btn);
        }
      }
    });

    // Find share rows
    const shareRows = document.querySelectorAll('[data-share-path], .share-row');
    shareRows.forEach(row => {
      let path = row.dataset.sharePath || row.dataset.path;
      
      if (!path) {
        const pathEl = row.querySelector('.share-path, .path');
        if (pathEl) {
          path = pathEl.textContent.trim();
        }
      }
      
      if (path && path.startsWith('/')) {
        const titleEl = row.querySelector('.v-list-item-title, .share-name, .title') || row;
        if (!titleEl.querySelector('.' + ICON_CLASS)) {
          titleEl.appendChild(createFolderButton(path, `Browse ${path}`));
        }
      }
    });

    // Find pool rows
    const poolRows = document.querySelectorAll('[data-pool-path], .pool-row');
    poolRows.forEach(row => {
      let path = row.dataset.poolPath || row.dataset.path;
      
      if (!path) {
        const pathEl = row.querySelector('.pool-path, .path');
        if (pathEl) {
          path = pathEl.textContent.trim();
        }
      }
      
      if (path && path.startsWith('/')) {
        const titleEl = row.querySelector('.v-list-item-title, .pool-name, .title') || row;
        if (!titleEl.querySelector('.' + ICON_CLASS)) {
          titleEl.appendChild(createFolderButton(path, `Browse ${path}`));
        }
      }
    });
  }

  // Watch for page changes and re-inject icons
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldInject = true;
          break;
        }
      }
      
      if (shouldInject) {
        // Debounce the injection
        clearTimeout(window._mosFileBrowserInjectTimeout);
        window._mosFileBrowserInjectTimeout = setTimeout(injectFolderIcons, 300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectFolderIcons();
        setupObserver();
      });
    } else {
      injectFolderIcons();
      setupObserver();
    }

    // Also inject on hash/route changes
    window.addEventListener('hashchange', () => {
      setTimeout(injectFolderIcons, 500);
    });

    // Listen for Vue router navigation if available
    window.addEventListener('popstate', () => {
      setTimeout(injectFolderIcons, 500);
    });
  }

  init();
})();
