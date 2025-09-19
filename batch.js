document.addEventListener('DOMContentLoaded', () => {
    const i18n = {
        translations: {},
        currentLang: 'tr',
        async loadLanguage(lang) {
            try {
                const response = await fetch(`/locales/${lang}.json`);
                if (!response.ok) throw new Error(`Failed to load language: ${lang}`);
                this.translations = await response.json();
                this.currentLang = lang;
                document.documentElement.lang = lang;
                this.applyTranslations();
            } catch (error) {
                console.error(error);
            }
        },
        t(key, replacements = {}) {
            let text = this.translations[key] || key;
            for (const placeholder in replacements) {
                text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacements[placeholder]);
            }
            return text;
        },
        applyTranslations(root = document) {
            const elements = [];
            if (root instanceof Element || root instanceof DocumentFragment) {
                if (root.dataset?.i18n) {
                    elements.push(root);
                }
                elements.push(...root.querySelectorAll('[data-i18n]'));
            } else {
                elements.push(...document.querySelectorAll('[data-i18n]'));
            }
            elements.forEach((el) => {
                const key = el.dataset.i18n;
                if (!key) return;
                let replacements = {};
                if (el.dataset.i18nArgs) {
                    try {
                        replacements = JSON.parse(el.dataset.i18nArgs);
                    } catch (error) {
                        console.warn('Failed to parse i18n args for element', el, error);
                    }
                }
                const tag = el.tagName?.toLowerCase?.();
                const translated = this.t(key, replacements);
                if (tag === 'input' || tag === 'textarea') {
                    if (typeof el.placeholder === 'string') {
                        el.placeholder = translated;
                    }
                } else {
                    el.innerHTML = translated;
                }
            });
        }
    };

    const mainNav = document.getElementById('main-nav');
    function updateNavVisibility(isLoggedIn) {
        if (mainNav) mainNav.hidden = !isLoggedIn;
    }
    // === DOM Elements ===
    const langSwitcher = document.getElementById('lang-switcher');
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

    // === Application State ===
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
    
    // === Functions ===

    function setTranslation(element, key, replacements = {}) {
        if (!element) return;
        element.dataset.i18n = key;
        const hasArgs = replacements && Object.keys(replacements).length > 0;
        if (hasArgs) {
            element.dataset.i18nArgs = JSON.stringify(replacements);
        } else {
            delete element.dataset.i18nArgs;
        }
        i18n.applyTranslations(element);
    }

    /** Displays a feedback message */
    function showFeedback(message, type = 'success') {
        if (!feedbackContainer) return;
        feedbackContainer.textContent = message;
        feedbackContainer.className = `feedback ${type}`;
        feedbackContainer.classList.add('show');
        setTimeout(() => {
            feedbackContainer.classList.remove('show');
        }, 3000);
    }

    /** Initializes the WebSocket connection */
    function initializeWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}?batchId=${state.batchId}`;
        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => console.log('WebSocket connection established.');
        state.ws.onclose = () => console.log('WebSocket connection closed.');
        state.ws.onerror = (error) => console.error('WebSocket error:', error);
        state.ws.onmessage = handleWebSocketMessage;
    }
    
    /** Processes incoming WebSocket messages */
    function handleWebSocketMessage(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'job_update') {
            const fileEntry = state.files.get(data.fileId || data.jobId); // Legacy fallback to jobId
             if (!fileEntry && data.jobId) {
                // If fileId is missing, match the entry by jobId
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
            updateFileStatus(fileEntry.rowElement, 'completed', 'status_success');
            displayResult(fileEntry.rowElement, data.result);
            state.completedCount++;
        } else if (data.status === 'failed') {
            updateFileStatus(fileEntry.rowElement, 'failed', 'status_failed');
            displayResult(fileEntry.rowElement, { message: data.error });
            state.failedCount++;
        }
        updateProcessSummary();
    }


    /** Updates the status cell for a table row */
    function renderStatusBadge(cell, statusClass, translationKey, replacements = {}) {
        if (!cell) return;
        const badge = document.createElement('span');
        badge.className = `status-badge status-${statusClass}`;
        if (translationKey) {
            setTranslation(badge, translationKey, replacements);
        }
        cell.innerHTML = '';
        cell.appendChild(badge);
    }

    function updateFileStatus(row, statusClass, translationKey, replacements = {}) {
        const statusCell = row.cells[1];
        renderStatusBadge(statusCell, statusClass, translationKey, replacements);
    }

    /** Renders the result cell content */
    function displayResult(row, result) {
        const resultCell = row.cells[2];
        const verdict = result.verdict || (result.message ? 'red' : 'unknown');
        const badge = document.createElement('span');
        badge.className = `verdict-${verdict}`;
        if (result.message) {
            delete badge.dataset.i18n;
            delete badge.dataset.i18nArgs;
            badge.textContent = result.message;
        } else {
            setTranslation(badge, 'status_unknown');
        }
        resultCell.innerHTML = '';
        resultCell.appendChild(badge);
    }

    /** Updates the completed/failed summary */
    function updateProcessSummary() {
        const completed = state.completedCount;
        const failed = state.failedCount;
        const total = state.files.size;
        setTranslation(processSummaryEl, 'batch_process_summary', {
            completed,
            failed,
        });
        if (downloadBtn) {
            downloadBtn.disabled = !(total > 0 && completed + failed === total);
        }
    }

    /** Updates the upload progress indicator */
    function updateUploadProgress() {
        const uploadedCount = state.files.size - state.uploadQueue.length;
        setTranslation(uploadProgressEl, 'batch_upload_progress', {
            uploaded: uploadedCount,
            total: state.files.size,
        });
    }

    /** Adds files to the upload queue and renders them */
    function handleFiles(files) {
        if (!state.user) {
            showFeedback(i18n.t('batch_login_prompt'), 'error');
            return;
        }
        batchProcessCard.hidden = false;
        for (const file of files) {
            const fileId = `file_${crypto.randomUUID()}`;

            const row = fileListBody.insertRow();
            row.dataset.fileId = fileId;
            row.insertCell(0).textContent = file.name;
            const statusCell = row.insertCell(1);
            renderStatusBadge(statusCell, 'waiting', 'status_waiting');
            row.insertCell(2).textContent = '-';

            state.files.set(fileId, { file, status: 'waiting', rowElement: row, jobId: null });
            state.uploadQueue.push(fileId);
        }
        updateUploadProgress();
        processUploadQueue();
    }

    /** Handles the concurrent upload queue */
    async function processUploadQueue() {
        if (state.isUploading) return;
        state.isUploading = true;
        
        const workers = Array(state.concurrentUploads).fill(null).map(async () => {
            while(state.uploadQueue.length > 0) {
                const fileId = state.uploadQueue.shift();
                const fileEntry = state.files.get(fileId);
                
                try {
                    updateFileStatus(fileEntry.rowElement, 'uploading', 'status_uploading');
                    const formData = new FormData();
                    formData.append('file', fileEntry.file);
                    formData.append('batchId', state.batchId);
                    formData.append('fileId', fileId);

                    const response = await fetch('/batch/upload', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(i18n.t('batch_upload_error_status', { status: response.status }));
                    }
                    
                    const data = await response.json();
                    fileEntry.jobId = data.jobId;
                    state.files.set(fileId, fileEntry); // jobId'yi state'e kaydet
                    updateFileStatus(fileEntry.rowElement, 'processing', 'status_processing');
                } catch (error) {
                    console.error('Upload error:', error);
                    updateFileStatus(fileEntry.rowElement, 'failed', 'status_upload_error');
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

    async function handleLanguageChange(event) {
        const newLang = event.target.value;
        localStorage.setItem('videokit_lang', newLang);
        await i18n.loadLanguage(newLang);
        updateProcessSummary();
        updateUploadProgress();
    }
    
    /** Checks the current login session */
    async function checkLoginState() {
        try {
            const response = await fetch('/auth/me', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(i18n.t('error_not_logged_in'));
            }

            const { user, tenant } = await response.json();
            if (!tenant?.id) {
                throw new Error(i18n.t('batch_tenant_missing'));
            }

            state.user = user;
            state.tenantId = tenant.id;
            const tenantName = tenant.name || i18n.t('plan_name_unknown');
            setTranslation(tenantInfoDisplay, 'batch_tenant_display', {
                tenantName,
                tenantId: tenant.id,
            });
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
            setTranslation(tenantInfoDisplay, 'batch_login_prompt');
            logoutButton.style.display = 'none';
            showFeedback(i18n.t('batch_login_prompt'), 'error');
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
            console.warn('Logout request failed:', error);
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
                throw new Error(i18n.t('batch_download_error_status', { status: response.status }));
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
            showFeedback(i18n.t('batch_download_success'), 'success');
        } catch (error) {
            showFeedback(error.message, 'error');
        }
    });

    if (langSwitcher) {
        langSwitcher.addEventListener('change', handleLanguageChange);
    }

    const initialize = async () => {
        const savedLang = localStorage.getItem('videokit_lang') || 'tr';
        if (langSwitcher) {
            langSwitcher.value = savedLang;
        }
        await i18n.loadLanguage(savedLang);
        updateProcessSummary();
        updateUploadProgress();
        await checkLoginState();
    };

    initialize().catch((error) => {
        console.error('Batch initialization failed:', error);
    });

});