# MOS API Feature Request - FileBrowser Plugin

## Aktueller Stand

Der MOS FileBrowser nutzt **wo möglich** die nativen MOS API Endpoints:

| Operation | Native API | Status |
|-----------|------------|--------|
| Datei erstellen | `/mos/createfile` | ✅ Wird genutzt |
| Datei bearbeiten | `/mos/editfile` | ✅ Wird genutzt |
| Datei lesen | `/mos/readfile` | ✅ Wird genutzt |
| Ordner erstellen | `/mos/createfolder` | ✅ Wird genutzt |
| Löschen | `/mos/delete` | ✅ Wird genutzt |
| Rechte ändern | `/mos/chmod` | ✅ Wird genutzt |
| Besitzer ändern | `/mos/chown` | ✅ Wird genutzt |

## Problem: Fehlende API Endpoints

Für einen **vollständigen FileBrowser** fehlen essenzielle Endpoints. Ohne diese müssen Symlinks zur Query-API genutzt werden:

| Operation | Benötigter Symlink | Grund |
|-----------|-------------------|-------|
| **Verzeichnis auflisten** | `ls` | Kein `/mos/listdir` |
| **Kopieren** | `cp` | Kein `/mos/copy` |
| **Verschieben/Umbenennen** | `mv` | Kein `/mos/move` |
| Speicherplatz | `du`, `df` | Kein `/mos/diskusage` |
| Datei-Info | `stat`, `file` | Kein `/mos/fileinfo` |
| Suche | `find`, `grep` | Kein `/mos/search` |
| Archive | `tar`, `unzip` | Kein `/mos/archive` |

**Die ersten 3 (listdir, copy, move) sind KRITISCH** - ohne diese ist kein FileBrowser möglich.

---

## Benötigte Endpoints

---

## Fehlende Endpoints

### 1. `/mos/listdir` - Verzeichnis auflisten

**Beschreibung:** Listet den Inhalt eines Verzeichnisses mit Datei-Metadaten auf.

**Request:**
```http
GET /api/v1/mos/listdir?path=/mnt/pool1/data
```

**Response:**
```json
{
  "path": "/mnt/pool1/data",
  "entries": [
    {
      "name": "documents",
      "type": "directory",
      "size": 4096,
      "permissions": "drwxr-xr-x",
      "owner": "500",
      "group": "500",
      "modified": "2026-01-22T10:30:00Z"
    },
    {
      "name": "video.mp4",
      "type": "file",
      "size": 1234567890,
      "permissions": "-rw-r--r--",
      "owner": "500",
      "group": "500",
      "modified": "2026-01-20T15:45:00Z"
    }
  ]
}
```

**Aktuell verwendet:** `ls -la` via Query-API Symlink

---

### 2. `/mos/copy` - Datei/Ordner kopieren

**Beschreibung:** Kopiert eine Datei oder einen Ordner (rekursiv).

**Request:**
```http
POST /api/v1/mos/copy
Content-Type: application/json

{
  "source": "/mnt/pool1/data/file.txt",
  "destination": "/mnt/pool2/backup/file.txt",
  "recursive": true,
  "preserve": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Copied successfully",
  "source": "/mnt/pool1/data/file.txt",
  "destination": "/mnt/pool2/backup/file.txt"
}
```

**Aktuell verwendet:** `cp -r` via Query-API Symlink

---

### 3. `/mos/move` - Datei/Ordner verschieben/umbenennen

**Beschreibung:** Verschiebt oder benennt eine Datei/Ordner um.

**Request:**
```http
POST /api/v1/mos/move
Content-Type: application/json

{
  "source": "/mnt/pool1/data/old-name.txt",
  "destination": "/mnt/pool1/data/new-name.txt"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Moved successfully",
  "source": "/mnt/pool1/data/old-name.txt",
  "destination": "/mnt/pool1/data/new-name.txt"
}
```

**Aktuell verwendet:** `mv` via Query-API Symlink

---

### 4. `/mos/fileinfo` - Datei-Informationen

**Beschreibung:** Liefert detaillierte Informationen zu einer Datei/Ordner.

**Request:**
```http
GET /api/v1/mos/fileinfo?path=/mnt/pool1/data/video.mp4
```

**Response:**
```json
{
  "path": "/mnt/pool1/data/video.mp4",
  "name": "video.mp4",
  "type": "file",
  "size": 1234567890,
  "permissions": "-rw-r--r--",
  "permissions_octal": "644",
  "owner": "500",
  "group": "500",
  "created": "2026-01-15T10:00:00Z",
  "modified": "2026-01-20T15:45:00Z",
  "accessed": "2026-01-22T10:30:00Z",
  "mime_type": "video/mp4",
  "is_symlink": false
}
```

**Aktuell verwendet:** `stat` + `file` via Query-API Symlinks

---

### 5. `/mos/search` - Dateisuche

**Beschreibung:** Sucht nach Dateien/Ordnern basierend auf Name oder Inhalt.

**Request:**
```http
POST /api/v1/mos/search
Content-Type: application/json

{
  "path": "/mnt/pool1",
  "pattern": "*.mp4",
  "type": "file",
  "max_depth": 5,
  "limit": 100
}
```

**Response:**
```json
{
  "results": [
    "/mnt/pool1/videos/movie.mp4",
    "/mnt/pool1/backup/clip.mp4"
  ],
  "count": 2,
  "truncated": false
}
```

**Aktuell verwendet:** `find` via Query-API Symlink

---

### 6. `/mos/diskusage` - Speicherplatz

**Beschreibung:** Zeigt Speichernutzung für einen Pfad.

**Request:**
```http
GET /api/v1/mos/diskusage?path=/mnt/pool1/data
```

**Response:**
```json
{
  "path": "/mnt/pool1/data",
  "size_bytes": 5368709120,
  "size_human": "5.0G",
  "files": 1234,
  "directories": 56
}
```

**Aktuell verwendet:** `du` via Query-API Symlink

---

## Kritisch: Datei-Upload mit Progress

### 8. `/mos/upload` - Datei-Upload (alle Dateitypen)

**Beschreibung:** Upload von Dateien aller Typen (Text, Binär, Medien) mit Fortschrittsanzeige. Das aktuelle `/mos/createfile` und `/mos/editfile` sind auf ~100KB Body-Limit beschränkt und unterstützen keine Binärdateien nativ.

**Option A: Multipart Upload (empfohlen)**
```http
POST /api/v1/mos/upload
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="file"; filename="video.mp4"
Content-Type: video/mp4

<binary data>
------boundary
Content-Disposition: form-data; name="path"

/mnt/pool1/uploads/video.mp4
------boundary
Content-Disposition: form-data; name="user"

500
------boundary--
```

**Option B: Chunked Upload mit Progress-Tracking**
```http
POST /api/v1/mos/upload/start
Content-Type: application/json

{
  "path": "/mnt/pool1/uploads/video.mp4",
  "size": 1234567890,
  "user": "500",
  "group": "500"
}
```
**Response:**
```json
{
  "upload_id": "upload_abc123",
  "chunk_size": 5242880
}
```

```http
POST /api/v1/mos/upload/chunk
Content-Type: application/json

{
  "upload_id": "upload_abc123",
  "chunk_index": 0,
  "content": "<base64 chunk>"
}
```
**Response:**
```json
{
  "received": 5242880,
  "total": 1234567890,
  "progress": 0.42
}
```

```http
POST /api/v1/mos/upload/complete
Content-Type: application/json

{
  "upload_id": "upload_abc123"
}
```

**Aktuelles Problem:** 
- API Body-Limit: 100KB
- Binärdateien müssen base64-kodiert werden (+33% Overhead)
- Kein nativer Progress-Support
- Plugin muss aktuell Workaround mit ~400 Chunk-Requests für 17MB Datei nutzen

---

## Progress-Support für Copy/Move

### Erweiterung für `/mos/copy` und `/mos/move`

**Problem:** Bei großen Dateien/Ordnern dauert Copy/Move lange ohne Feedback.

**Lösung: Async Operation mit Status-Abfrage**

**Request (Copy starten):**
```http
POST /api/v1/mos/copy
Content-Type: application/json

{
  "source": "/mnt/pool1/data/large-folder",
  "destination": "/mnt/pool2/backup/large-folder",
  "recursive": true,
  "async": true
}
```

**Response:**
```json
{
  "operation_id": "op_xyz789",
  "status": "running",
  "message": "Copy operation started"
}
```

**Status abfragen:**
```http
GET /api/v1/mos/operation/op_xyz789
```

**Response:**
```json
{
  "operation_id": "op_xyz789",
  "type": "copy",
  "status": "running",
  "progress": {
    "files_total": 1500,
    "files_done": 750,
    "bytes_total": 5368709120,
    "bytes_done": 2684354560,
    "percent": 50,
    "current_file": "/mnt/pool1/data/large-folder/subfolder/file.bin"
  },
  "started_at": "2026-01-22T11:00:00Z",
  "estimated_remaining": "00:02:30"
}
```

**Abgeschlossen:**
```json
{
  "operation_id": "op_xyz789",
  "type": "copy",
  "status": "completed",
  "progress": {
    "files_total": 1500,
    "files_done": 1500,
    "percent": 100
  },
  "completed_at": "2026-01-22T11:05:00Z"
}
```

---

## Optional: Archiv-Operationen

### 7. `/mos/archive` - Archiv erstellen/extrahieren

**Request (Erstellen):**
```http
POST /api/v1/mos/archive
Content-Type: application/json

{
  "action": "create",
  "source": "/mnt/pool1/data/folder",
  "destination": "/mnt/pool1/backup/folder.tar.gz",
  "format": "tar.gz"
}
```

**Request (Extrahieren):**
```http
POST /api/v1/mos/archive
Content-Type: application/json

{
  "action": "extract",
  "source": "/mnt/pool1/backup/folder.tar.gz",
  "destination": "/mnt/pool1/restored/"
}
```

**Aktuell verwendet:** `tar`, `gzip`, `unzip` via Query-API Symlinks

---

## Zusammenfassung

| Priorität | Endpoint | Ersetzt / Löst |
|-----------|----------|----------------|
| **🔴 Kritisch** | `/mos/upload` | Binär-Upload (100KB Limit Problem) |
| **🔴 Kritisch** | `/mos/listdir` | `ls` |
| **🔴 Hoch** | `/mos/copy` + Progress | `cp` |
| **🔴 Hoch** | `/mos/move` + Progress | `mv` |
| **🟡 Mittel** | `/mos/operation/:id` | Progress-Tracking für async Ops |
| **🟡 Mittel** | `/mos/fileinfo` | `stat`, `file` |
| **🟡 Mittel** | `/mos/search` | `find` |
| **🟢 Niedrig** | `/mos/diskusage` | `du` |
| **🟢 Niedrig** | `/mos/archive` | `tar`, `gzip`, `unzip` |

Mit diesen Endpoints könnte der FileBrowser **vollständig ohne Symlinks** arbeiten und wäre komplett API-basiert.

### Aktuelles Hauptproblem

Das **größte Problem** ist aktuell der Datei-Upload:
- API Body-Limit: **100KB**
- Binärdateien werden **base64-kodiert** (+33% Overhead)
- Für eine **17MB Datei** benötigt das Plugin aktuell **~400 API-Requests**
- Upload dauert **20-60 Sekunden** statt weniger Sekunden

Ein nativer `/mos/upload` Endpoint mit **Multipart-Support** oder **erhöhtem Body-Limit** würde dies sofort lösen.

---

## Kontakt

Bei Fragen zur Implementierung stehe ich gerne zur Verfügung.

**Plugin:** MOS FileBrowser v1.3.1  
**Repository:** https://github.com/RiDDiX/mos-file-browser
