document.addEventListener('DOMContentLoaded', () => {
    // === i18n Modülü ===
    const i18n = {
        translations: {},
        currentLang: 'tr',
        async loadLanguage(lang) {
            try {
                const response = await fetch(`/locales/${lang}.json`);
                if (!response.ok) throw new Error(`Dil dosyası yüklenemedi: ${lang}`);
                this.translations = await response.json();
                this.currentLang = lang;
                document.documentElement.lang = lang;
                this.translatePage();
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
        translatePage() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.dataset.i18n;
                const tag = el.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea') {
                    if (el.placeholder) {
                        el.placeholder = this.t(key);
                    }
                } else {
                    el.innerHTML = this.t(key);
                }
            });
        }
    };

    // === DOM Elementleri ===
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const dashboardView = document.getElementById('dashboard-view');
    const forgotPasswordView = document.getElementById('forgot-password-view');
    const resetPasswordView = document.getElementById('reset-password-view');
    
    const mainNav = document.getElementById('main-nav'); 

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    
    const tenantNameDisplay = document.getElementById('tenant-name-display');
    const logoutButton = document.getElementById('logout-button');
    
    const planNameEl = document.getElementById('plan-name');
    const usageInfoEl = document.getElementById('usage-info');
    const apiKeysListEl = document.getElementById('api-keys-list');
    
    const createKeyBtn = document.getElementById('create-key-btn');
    const apiKeyTemplate = document.getElementById('api-key-template');
    const feedbackContainer = document.getElementById('feedback-container');
    const newKeyAlert = document.getElementById('new-key-alert');
    const newKeyValueEl = document.getElementById('new-key-value');
    const copyNewKeyBtn = document.getElementById('copy-new-key');
    const dismissNewKeyBtn = document.getElementById('dismiss-new-key');

    const portalLogo = document.getElementById('portal-logo');
    const langSwitcher = document.getElementById('lang-switcher');
    
    const showRegisterViewLink = document.getElementById('show-register-view');
    const showLoginViewFromRegisterLink = document.getElementById('show-login-view-from-register');
    const showForgotPasswordViewLink = document.getElementById('show-forgot-password-view');
    const showLoginViewFromForgotLink = document.getElementById('show-login-view-from-forgot');


    // Analitik Elementleri
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const totalCallsStat = document.getElementById('total-calls-stat');
    const successBar = document.getElementById('success-bar');
    const successPercentage = document.getElementById('success-percentage');
    const avgTimeStat = document.getElementById('avg-time-stat');
    const activitiesTableBody = document.getElementById('activities-table-body');


    // === Uygulama Durumu (State) ===
    let state = {
        isLoggedIn: false,
        user: null,
        tenant: null,
        analyticsActivities: [], // CSV export için
    };

    const AUTH_BASE_PATH = '/auth';
    const authEndpoint = (path) => `${AUTH_BASE_PATH}${path}`;

    // === Marka Fonksiyonları ===
    const defaultBranding = {
        logoUrl: 'default-logo.svg',
        primaryColor: '#007bff',
        primaryHoverColor: '#0056b3',
        backgroundColor: '#f0f2f5',
    };

    /** Kiracıya özel marka ayarlarını API'den çeker */
    async function fetchBranding(tenantId) {
        if (!tenantId) {
            resetBranding();
            return;
        }
        try {
            const response = await fetch(`/branding/${tenantId}`);
            if (!response.ok) throw new Error('Branding could not be fetched.');
            const brandingSettings = await response.json();
            applyBranding(brandingSettings);
        } catch (error) {
            console.error('Failed to fetch branding:', error);
            resetBranding();
        }
    }

    /** Gelen marka ayarlarını arayüze uygular */
    function applyBranding(settings) {
        const branding = { ...defaultBranding, ...settings };
        portalLogo.src = branding.logoUrl;
        
        document.documentElement.style.setProperty('--primary', branding.primaryColor);
        document.documentElement.style.setProperty('--background', branding.backgroundColor);

        const primaryHover = calculateHoverColor(branding.primaryColor);
        document.documentElement.style.setProperty('--primary-hover', primaryHover);
    }

    /** Marka ayarlarını varsayılana sıfırlar */
    function resetBranding() {
        applyBranding(defaultBranding);
    }
    
    /** Ana renge göre hover rengi oluşturur */
    function calculateHoverColor(hex) {
        if (!hex.startsWith('#')) return defaultBranding.primaryHoverColor;
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.floor(r * 0.85);
        g = Math.floor(g * 0.85);
        b = Math.floor(b * 0.85);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // DEĞİŞİKLİK: Navigasyon menüsünün görünürlüğünü ayarlayan fonksiyon
    function updateNavVisibility() {
        if (!mainNav) return;
        mainNav.hidden = !state.isLoggedIn;
    }
    
    /** Oturum durumunu kontrol et */
    async function checkLoginState() {
        try {
            const response = await fetch(authEndpoint('/me'), { credentials: 'include' });
            if (response.ok) {
                const { user, tenant } = await response.json();
                state.isLoggedIn = true;
                state.user = user;
                state.tenant = tenant;
                
                await fetchBranding(state.tenant.id);
                toggleAuthViews('dashboard');
                initializeDateInputs();
                await loadDashboardData();
            } else {
                state.isLoggedIn = false; // DEĞİŞİKLİK: Hata durumunda durumu false yap
                throw new Error('Not logged in');
            }
        } catch (error) {
            state.isLoggedIn = false;
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('resetToken');
            if (resetToken) {
                toggleAuthViews('reset-password');
            } else {
                toggleAuthViews('login');
            }
            resetBranding();
        } finally {
            // DEĞİŞİKLİK: Her durumda navigasyonun durumunu güncelle
            updateNavVisibility();
        }
    }

    /** Geri bildirim mesajı gösterir */
    function showFeedback(message, type = 'success') {
        feedbackContainer.textContent = message;
        feedbackContainer.className = `feedback ${type}`;
        feedbackContainer.classList.add('show');
        setTimeout(() => {
            feedbackContainer.classList.remove('show');
        }, 3000);
    }

    function setApiKeyListState(messageKey, descriptionKey = null) {
        if (!apiKeysListEl) return;
        apiKeysListEl.innerHTML = '';
        const listItem = document.createElement('li');
        listItem.className = 'key-row key-row--empty';

        const metaContainer = document.createElement('div');
        metaContainer.className = 'key-row__meta';

        const messageEl = document.createElement('span');
        messageEl.dataset.i18n = messageKey;
        metaContainer.appendChild(messageEl);

        if (descriptionKey) {
            const descriptionEl = document.createElement('small');
            descriptionEl.dataset.i18n = descriptionKey;
            metaContainer.appendChild(descriptionEl);
        }

        listItem.appendChild(metaContainer);
        apiKeysListEl.appendChild(listItem);
        i18n.translatePage();
    }

    function revealNewKey(apiKey) {
        if (!newKeyAlert || !newKeyValueEl) return;
        if (!apiKey) {
            hideNewKeyAlert();
            return;
        }
        newKeyValueEl.textContent = apiKey;
        newKeyAlert.hidden = false;
        newKeyAlert.classList.add('show');
    }

    function hideNewKeyAlert() {
        if (!newKeyAlert || !newKeyValueEl) return;
        newKeyAlert.hidden = true;
        newKeyAlert.classList.remove('show');
        newKeyValueEl.textContent = '';
    }

    async function handleCopyNewKey() {
        if (!newKeyValueEl || !newKeyValueEl.textContent) return;
        const keyText = newKeyValueEl.textContent.trim();
        if (!keyText) return;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(keyText);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = keyText;
                textArea.setAttribute('readonly', '');
                textArea.style.position = 'absolute';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            showFeedback(i18n.t('feedback_key_copied'), 'success');
        } catch (error) {
            console.error('Failed to copy API key:', error);
            showFeedback(i18n.t('error_key_copy_failed'), 'error');
        }
    }

    /** API anahtarını güvenlik için maskeler */
    function maskApiKey(key) {
        if (!key) return '';
        return `${key.substring(0, 12)}...${key.substring(key.length - 4)}`;
    }

    /** Anahtar listesini DOM'da render eder */
    function normalizeKeyForDisplay(entry) {
        if (!entry) return null;
        if (typeof entry === 'string') {
            return { id: entry, label: maskApiKey(entry) };
        }
        const id = entry.id ?? entry.keyId ?? entry.key ?? null;
        if (!id) return null;
        const labelSource = entry.label ?? entry.masked ?? entry.display ?? null;
        const label = labelSource ?? maskApiKey(entry.value ?? '');
        return { id, label: label || '' };
    }

    function renderApiKeys(keys) {
        if (!apiKeysListEl) return;
        if (!keys || keys.length === 0) {
            setApiKeyListState('no_api_keys_yet', 'api_keys_empty_description');
            return;
        }

        apiKeysListEl.innerHTML = '';
        const fragment = document.createDocumentFragment();
        keys.forEach(key => {
            const normalized = normalizeKeyForDisplay(key);
            if (!normalized) {
                return;
            }
            const clone = apiKeyTemplate.content.cloneNode(true);
            const keyValueEl = clone.querySelector('.api-key-value');
            if (keyValueEl) {
                keyValueEl.textContent = normalized.label;
            }
            const deleteBtn = clone.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.dataset.keyId = normalized.id;
                deleteBtn.dataset.label = normalized.label;
            }
            fragment.appendChild(clone);
        });
        apiKeysListEl.appendChild(fragment);
        i18n.translatePage();
    }

    /** Panel verilerini API'den yükler */
    async function loadDashboardData() {
        if (!state.isLoggedIn) return;
        
        await Promise.all([
            fetchBillingInfo(),
            fetchUsageInfo(),
            fetchApiKeys(),
            loadAnalyticsData(),
        ]);
    }
    
    /** Fatura/Abonelik bilgilerini çeker */
    async function fetchBillingInfo() {
        planNameEl.textContent = i18n.t('loading_text');
        try {
            const response = await fetch('/billing', { credentials: 'include' });
            if (!response.ok) throw new Error('Abonelik bilgileri alınamadı.');
            const data = await response.json();
            planNameEl.textContent = data.plan_name || 'Bilinmiyor';
            tenantNameDisplay.textContent = i18n.t('tenant_display_text', { planName: data.plan_name, tenantId: state.tenant.id });
        } catch (error) {
            planNameEl.textContent = 'Hata';
            showFeedback(error.message, 'error');
        }
    }

    /** Kullanım bilgilerini çeker */
    async function fetchUsageInfo() {
        usageInfoEl.innerHTML = `<p>${i18n.t('loading_text')}</p>`;
        try {
            const response = await fetch('/billing', { credentials: 'include' });
            if (!response.ok) throw new Error('Kullanım bilgileri alınamadı.');
            const data = await response.json();

            let usageHtml = '';
            if (data.quota) {
                usageHtml = `<p>Kullanılan İstek: ${data.quota.used} / ${data.quota.limit}</p>`;
            } else if (data.credits) {
                usageHtml = `<p>Kalan Kredi: ${data.credits.remaining}</p>`;
            }
            usageInfoEl.innerHTML = usageHtml;
        } catch (error) {
            usageInfoEl.innerHTML = '<p>Hata</p>';
            showFeedback(error.message, 'error');
        }
    }

    /** API anahtarlarını çeker ve listeler */
    async function fetchApiKeys() {
        setApiKeyListState('loading_text');
        try {
            const response = await fetch(`/management/keys`, { credentials: 'include' });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                if (response.status === 403) {
                    setApiKeyListState('error_management_unauthorized');
                    throw new Error(i18n.t('error_management_unauthorized'));
                }
                const message = data?.error || i18n.t('error_api_keys_fetch_failed');
                throw new Error(message);
            }
            renderApiKeys(data?.keys);
            return data?.keys;
        } catch (error) {
            setApiKeyListState('error_api_keys_fetch_failed');
            showFeedback(error.message, 'error');
            return null;
        }
    }

    // === Analitik Fonksiyonları ===
    async function loadAnalyticsData() {
        if (!state.isLoggedIn) return;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        try {
            const response = await fetch(`/analytics?${query.toString()}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Analitik verileri alınamadı.');
            const data = await response.json();
            state.analyticsActivities = data.activities;
            updateAnalyticsDashboard(data);
        } catch (error) {
            showFeedback(error.message, 'error');
        }
    }

    function updateAnalyticsDashboard({ summary, activities }) {
        totalCallsStat.textContent = summary.totalCalls.toLocaleString(i18n.currentLang);
        avgTimeStat.textContent = `${summary.averageProcessingTime.toLocaleString(i18n.currentLang)} ms`;
        const successRate = summary.totalCalls > 0 ? (summary.successfulCalls / summary.totalCalls) * 100 : 0;
        successPercentage.textContent = `${successRate.toFixed(1)}%`;
        successBar.style.width = `${successRate}%`;
        activitiesTableBody.innerHTML = '';
        const activitiesToShow = activities.slice(0, 100);
        if(activitiesToShow.length === 0) {
            activitiesTableBody.innerHTML = `<tr><td colspan="4">${i18n.t('no_activity_found')}</td></tr>`;
            return;
        }
        activitiesToShow.forEach(activity => {
            const row = activitiesTableBody.insertRow();
            const date = new Date(activity.timestamp);
            row.insertCell(0).textContent = date.toLocaleString(i18n.currentLang);
            row.insertCell(1).textContent = activity.type;
            const statusCell = row.insertCell(2);
            statusCell.textContent = activity.status === 'success' ? i18n.t('status_success') : i18n.t('status_failed');
            statusCell.className = `status-cell ${activity.status}`;
            row.insertCell(3).textContent = activity.duration;
        });
    }

    function handleExportCsv() {
        if (state.analyticsActivities.length === 0) {
            showFeedback('Dışa aktarılacak veri yok.', 'error');
            return;
        }
        const headers = ['Tarih', 'İşlem Türü', 'Durum', 'İşlem Süresi (ms)'];
        const rows = state.analyticsActivities.map(act => [
            new Date(act.timestamp).toISOString(),
            act.type,
            act.status,
            act.duration
        ]);
        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `videokit_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showFeedback('CSV dışa aktarıldı.', 'success');
    }

    function initializeDateInputs() {
        const today = new Date();
        const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
        endDateInput.value = today.toISOString().split('T')[0];
        startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    }


    // === Olay Yöneticileri ===
    function toggleAuthViews(showView) {
        loginView.hidden = true;
        registerView.hidden = true;
        forgotPasswordView.hidden = true;
        resetPasswordView.hidden = true;
        dashboardView.hidden = true;

        if (showView === 'login') loginView.hidden = false;
        else if (showView === 'register') registerView.hidden = false;
        else if (showView === 'forgot-password') forgotPasswordView.hidden = false;
        else if (showView === 'reset-password') resetPasswordView.hidden = false;
        else if (showView === 'dashboard') dashboardView.hidden = false;

        if (showView !== 'dashboard') {
            hideNewKeyAlert();
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.querySelector('#login-email').value;
        const password = form.querySelector('#login-password').value;
        
        try {
            const response = await fetch(authEndpoint('/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Giriş başarısız oldu.');
            }
            
            await checkLoginState();

        } catch (error) {
            showFeedback(error.message, 'error');
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        const form = event.target;
        const companyName = form.querySelector('#company-name').value;
        const email = form.querySelector('#register-email').value;
        const password = form.querySelector('#register-password').value;

        if (!companyName || !email || !password) {
            showFeedback('Tüm alanlar zorunludur.', 'error');
            return;
        }
        
        try {
            const response = await fetch(authEndpoint('/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, email, password }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Kayıt başarısız oldu.');
            }
            showFeedback(i18n.t('feedback_register_success'), 'success');
            form.reset();
            toggleAuthViews('login');
        } catch (error) {
            showFeedback(error.message, 'error');
        }
    }

    async function handleForgotPassword(event) {
        event.preventDefault();
        const email = forgotPasswordForm.querySelector('#forgot-email').value;
        try {
            const response = await fetch(authEndpoint('/forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            showFeedback(i18n.t('feedback_reset_link_sent'), 'success');
            forgotPasswordForm.reset();
        } catch (error) {
            showFeedback(error.message, 'error');
        }
    }

    async function handleResetPassword(event) {
        event.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('resetToken');
        const password = resetPasswordForm.querySelector('#reset-password').value;

        if (!token) {
            showFeedback('Sıfırlama tokenı bulunamadı.', 'error');
            return;
        }
        if (password.length < 8) {
            showFeedback('Şifre en az 8 karakter olmalıdır.', 'error');
            return;
        }

        try {
            const response = await fetch(authEndpoint('/reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            showFeedback(i18n.t('feedback_password_updated_success'), 'success');
            
            window.history.pushState({}, '', window.location.pathname);
            toggleAuthViews('login');

        } catch (error) {
            showFeedback(error.message, 'error');
        }
    }
    
    async function handleLogout() {
        try {
            await fetch(authEndpoint('/logout'), { method: 'POST', credentials: 'include' });
        } catch(e) {
            console.error('Logout request failed:', e);
        } finally {
            state = { isLoggedIn: false, user: null, tenant: null, analyticsActivities: [] };
            toggleAuthViews('login');
            planNameEl.textContent = '';
            usageInfoEl.innerHTML = '';
            setApiKeyListState('no_api_keys_yet', 'api_keys_empty_description');
            tenantNameDisplay.textContent = '';
            loginForm.reset();
            registerForm.reset();
            hideNewKeyAlert();
            resetBranding();
            updateNavVisibility();
        }
    }

    async function handleCreateKey() {
        if (!createKeyBtn) return;
        const defaultLabel = i18n.t('create_key_button');
        createKeyBtn.textContent = i18n.t('loading_text');
        createKeyBtn.disabled = true;
        try {
            const response = await fetch(`/management/keys`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                const message = data?.error || i18n.t('error_create_key_failed');
                throw new Error(message);
            }

            if (data?.apiKey) {
                revealNewKey(data.apiKey);
            } else {
                hideNewKeyAlert();
            }

            showFeedback(i18n.t('feedback_new_key_success'), 'success');
            await fetchApiKeys();
        } catch (error) {
            showFeedback(error.message, 'error');
        } finally {
            createKeyBtn.textContent = defaultLabel;
            createKeyBtn.disabled = false;
        }
    }

    async function handleDeleteKey(event) {
        const button = event.target.closest('.delete-btn');
        if (!button) return;

        const keyId = button.dataset.keyId;
        if (!keyId) return;

        const maskedLabel = button.dataset.label || '';
        const confirmationMessage = maskedLabel
            ? `${i18n.t('confirm_delete_key')}\n${maskedLabel}`
            : i18n.t('confirm_delete_key');

        if (!confirm(confirmationMessage)) {
            return;
        }

        const defaultLabel = i18n.t('delete_button');
        button.textContent = i18n.t('deleting_text');
        button.disabled = true;

        try {
            const response = await fetch(`/management/keys/${encodeURIComponent(keyId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                const message = data?.error || i18n.t('error_delete_key_failed');
                throw new Error(message);
            }

            showFeedback(i18n.t('feedback_key_deleted_success'), 'success');
            await fetchApiKeys();
        } catch (error) {
            showFeedback(error.message, 'error');
        } finally {
            if (button.isConnected) {
                button.textContent = defaultLabel;
                button.disabled = false;
            }
        }
    }
    
    async function handleLanguageChange(event) {
        const newLang = event.target.value;
        localStorage.setItem('videokit_lang', newLang);
        await i18n.loadLanguage(newLang);
        if (state.isLoggedIn) {
            await loadDashboardData();
        }
    }

    // === Başlangıç Fonksiyonları ===
    async function initializeApp() {
        const savedLang = localStorage.getItem('videokit_lang') || 'tr';
        langSwitcher.value = savedLang;
        await i18n.loadLanguage(savedLang);
        hideNewKeyAlert();
        await checkLoginState();
    }

    // === Olay Dinleyicileri (Event Listeners) ===
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    resetPasswordForm.addEventListener('submit', handleResetPassword);

    logoutButton.addEventListener('click', handleLogout);
    createKeyBtn.addEventListener('click', handleCreateKey);
    apiKeysListEl.addEventListener('click', handleDeleteKey);
    langSwitcher.addEventListener('change', handleLanguageChange);

    if (copyNewKeyBtn) copyNewKeyBtn.addEventListener('click', handleCopyNewKey);
    if (dismissNewKeyBtn) dismissNewKeyBtn.addEventListener('click', hideNewKeyAlert);

    showRegisterViewLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthViews('register'); });
    showLoginViewFromRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthViews('login'); });
    showForgotPasswordViewLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthViews('forgot-password'); });
    showLoginViewFromForgotLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthViews('login'); });
    
    startDateInput.addEventListener('change', loadAnalyticsData);
    endDateInput.addEventListener('change', loadAnalyticsData);
    exportCsvBtn.addEventListener('click', handleExportCsv);

    initializeApp();
});