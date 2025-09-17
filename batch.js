document.addEventListener('DOMContentLoaded', () => {
    // Bu dosyadaki metinler henüz i18n kapsamına alınmamıştır.
    // Ancak altyapısı app.js'deki gibi kurulabilir.
const mainNav = document.getElementById('main-nav');
function updateNavVisibility(isLoggedIn) {
  if (mainNav) mainNav.hidden = !isLoggedIn;
}
    // === DOM Elementleri ===
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const batchProcessCard = document.getElementById('batch-process-card');
    const fileListBody = document.getElementById('file-list-body');
    const uploadProgressEl = document.getElementById('upload-progress');
    const processSummaryEl = document.getElementById('process-summary');
    const downloadBtn = document.getElementById('download-results-btn');
    const tenantInfoDisplay = document.getElementById('tenant-info-display');
    const logoutButton = document.getElementById('logout-button');
    const feedbackContainer = document.getElementById('feedback-container');
    const batchView = document.getElementById('batch-view');

    if (batchView) {
        batchView.hidden = true;
    }

    // === Uygulama Durumu (State) ===
    let state = {
        tenantId: null,
        user: null,
        batchId: `batch_${crypto.randomUUID()}`,
        files: new Map(), // fileId -> { file, status, rowElement }
        ws: null,
        uploadQueue: [],
        concurrentUploads: 5,
        isUploading: false,
        completedCount: 0,
        failedCount: 0,
    };
    
    // === Fonksiyonlar ===

    /** Geri bildirim mesajı gösterir */
    function showFeedback(message, type = 'success') {
        feedbackContainer.textContent = message;
        feedbackContainer.className = `feedback ${type}`;
        feedbackContainer.classList.add('show');
        setTimeout(() => {
            feedbackContainer.classList.remove('show');
        }, 3000);
    }

    /** WebSocket bağlantısını başlatır */
    function initializeWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}?batchId=${state.batchId}`;
        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => console.log('WebSocket bağlantısı kuruldu.');
        state.ws.onclose = () => console.log('WebSocket bağlantısı kesildi.');
        state.ws.onerror = (error) => console.error('WebSocket hatası:', error);
        state.ws.onmessage = handleWebSocketMessage;
    }
    
    /** WebSocket'ten gelen mesajları işler */
    function handleWebSocketMessage(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'job_update') {
            const fileEntry = state.files.get(data.fileId || data.jobId); // Geriye dönük uyumluluk için jobId de kontrol et
             if (!fileEntry && data.jobId) {
                // Eğer fileId yoksa, jobId ile eşleşen dosyayı bul
                for (const [fId, entry] of state.files.entries()) {
                    if (entry.jobId === data.jobId) {
                         const fileEntryById = state.files.get(fId);
                         if (fileEntryById) {
                             processUpdate(fileEntryById, data);
                         }
                         return;
                    }
                }
            }
             if (fileEntry) {
                 processUpdate(fileEntry, data);
             }
        }
    }
    
    function processUpdate(fileEntry, data) {
        if (data.status === 'completed') {
            updateFileStatus(fileEntry.rowElement, 'completed', 'Tamamlandı');
            displayResult(fileEntry.rowElement, data.result);
            state.completedCount++;
        } else if (data.status === 'failed') {
            updateFileStatus(fileEntry.rowElement, 'failed', 'Hata');
            displayResult(fileEntry.rowElement, { message: data.error });
            state.failedCount++;
        }
        updateProcessSummary();
    }


    /** Dosya listesindeki bir satırın durumunu günceller */
    function updateFileStatus(row, statusClass, statusText) {
        const statusCell = row.cells[1];
        statusCell.innerHTML = `<span class="status-badge status-${statusClass}">${statusText}</span>`;
    }

    /** Sonucu ilgili hücrede gösterir */
    function displayResult(row, result) {
        const resultCell = row.cells[2];
        const verdict = result.verdict || (result.message ? 'red' : 'unknown');
        resultCell.innerHTML = `<span class="verdict-${verdict}">${result.message || 'Bilinmeyen durum'}</span>`;
    }

    /** İşlem özetini (tamamlanan/başarısız) günceller */
    function updateProcessSummary() {
        processSummaryEl.textContent = `Tamamlanan: ${state.completedCount} | Hatalı: ${state.failedCount}`;
        if (state.completedCount + state.failedCount === state.files.size) {
            downloadBtn.disabled = false;
        }
    }
    
    /** Yükleme ilerlemesini günceller */
    function updateUploadProgress() {
        const uploadedCount = state.files.size - state.uploadQueue.length;
        uploadProgressEl.textContent = `Yüklenen: ${uploadedCount} / ${state.files.size}`;
    }

    /** Dosyaları yükleme kuyruğuna ekler ve arayüzde gösterir */
    function handleFiles(files) {
        if (!state.user) {
            showFeedback('Devam etmek için lütfen giriş yapın.', 'error');
            return;
        }
        batchProcessCard.hidden = false;
        for (const file of files) {
            const fileId = `file_${crypto.randomUUID()}`;
            
            const row = fileListBody.insertRow();
            row.dataset.fileId = fileId;
            row.insertCell(0).textContent = file.name;
            row.insertCell(1).innerHTML = `<span class="status-badge status-waiting">Bekliyor</span>`;
            row.insertCell(2).textContent = '-';

            state.files.set(fileId, { file, status: 'waiting', rowElement: row, jobId: null });
            state.uploadQueue.push(fileId);
        }
        updateUploadProgress();
        processUploadQueue();
    }

    /** Yükleme kuyruğunu yönetir */
    async function processUploadQueue() {
        if (state.isUploading) return;
        state.isUploading = true;
        
        const workers = Array(state.concurrentUploads).fill(null).map(async () => {
            while(state.uploadQueue.length > 0) {
                const fileId = state.uploadQueue.shift();
                const fileEntry = state.files.get(fileId);
                
                try {
                    updateFileStatus(fileEntry.rowElement, 'uploading', 'Yükleniyor');
                    const formData = new FormData();
                    formData.append('file', fileEntry.file);
                    formData.append('batchId', state.batchId);
                    formData.append('fileId', fileId);

                    const response = await fetch('/batch/upload', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    });

                    if (!response.ok) throw new Error(`Sunucu hatası: ${response.statusText}`);
                    
                    const data = await response.json();
                    fileEntry.jobId = data.jobId;
                    state.files.set(fileId, fileEntry); // jobId'yi state'e kaydet
                    updateFileStatus(fileEntry.rowElement, 'processing', 'İşleniyor');
                } catch (error) {
                    console.error('Yükleme hatası:', error);
                    updateFileStatus(fileEntry.rowElement, 'failed', 'Yükleme Hatası');
                    displayResult(fileEntry.rowElement, { message: error.message });
                    state.failedCount++;
                    updateProcessSummary();
                } finally {
                     updateUploadProgress();
                }
            }
        });

        await Promise.all(workers);
        state.isUploading = false;
    }
    
    /** Oturum (login) durumunu kontrol eder */
    async function checkLoginState() {
        try {
            const response = await fetch('/auth/me', { credentials: 'include' });
            if (!response.ok) {
                throw new Error('Oturum bulunamadı.');
            }

            const { user, tenant } = await response.json();
            if (!tenant?.id) {
                throw new Error('Kiracı bilgisi alınamadı.');
            }

            state.user = user;
            state.tenantId = tenant.id;
            tenantInfoDisplay.textContent = `Kiracı: ${tenant.name || tenant.id}`;
            logoutButton.style.display = 'inline-block';
            updateNavVisibility(true);
            if (batchView) {
                batchView.hidden = false;
            }
            if (!state.ws) {
                initializeWebSocket();
            }
        } catch (error) {
            updateNavVisibility(false);
            state.user = null;
            state.tenantId = null;
            tenantInfoDisplay.textContent = 'Lütfen ana panelden giriş yapın...';
            logoutButton.style.display = 'none';
            showFeedback('Devam etmek için lütfen giriş yapın.', 'error');
            setTimeout(() => {
                window.location.replace('index.html?redirect=batch.html');
            }, 1200);
        }
    }

    async function handleLogout() {
        updateNavVisibility(false);
        try {
            await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.warn('Logout isteği başarısız oldu:', error);
        } finally {
            state.user = null;
            state.tenantId = null;
            window.location.href = 'index.html';
        }
    }

    // === Olay Dinleyicileri (Event Listeners) ===
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    logoutButton.addEventListener('click', handleLogout);

    downloadBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`/batch/${state.batchId}/download`, {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`İndirme sırasında hata oluştu (${response.status}).`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${state.batchId}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showFeedback('Rapor indirildi.', 'success');
        } catch (error) {
            showFeedback(error.message, 'error');
        }
    });

    // Sayfa yüklendiğinde oturum kontrolü yap
    checkLoginState();
    
});