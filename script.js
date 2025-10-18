// script.js - WARDA Panel - Temiz ve Güncellenmiş Versiyon

document.addEventListener('DOMContentLoaded', function() {

    // =======================================
    // --- SABİT LİSTELER VE GENEL DEĞİŞKENLER ---
    // =======================================
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const KDV_ORANI = 0.20;
    const SABIT_SIRKET_KATEGORILER = ["WARDA", "BEYLERBEYİ", "ATÖLYE", "TULUM YAPI", "BROSS", "ORYAP"];
    const SABIT_KURUM_KATEGORILERI = ["BÜYÜKŞEHİR", "ORBEL", "ORTUR", "BAYBURT VALİLİK"];
    const ODEME_SEKILLERI = ["NAKİT", "BANKA", "KREDİ KARTI", "ÇEK", "HAVALE/EFT"];

    // =======================================
    // --- TÜM VERİLER İÇİN MASTER NESNE ---
    // =======================================
    let db = {
        totalCash: 0,
        companies: [],
        jobs: [],
        cards: [],
        overdrafts: [],
        checks: [],
        loans: [],
        debts: [],
        receivables: [],
        expenses: [],
        incomes: [],
        bilancoVarliklar: [],
        bilancoAlacaklar: [],
        bilancoBorclar: [],
        payments: [],
        projects: [],
        monthlyPaymentStatus: {},
        fixedExpenses: {
            salary: 0,
            insurance: 0,
            loan: 0,
            card: 0
        }
    };

    // =======================================
    // --- YARDIMCI FONKSİYONLAR ---
    // =======================================
    const formatCurrency = (num) => `₺${(num || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const parseCurrency = (str) => {
        if (!str) return 0;
        const cleanStr = String(str).replace('₺', '').trim().replace(/\./g, '').replace(',', '.').replace(/<i.*?<\/i>/, '');
        return parseFloat(cleanStr) || 0;
    };
    
    const getCleanNumericValue = (elementId) => parseCurrency(document.getElementById(elementId)?.value || 0);
    
    const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);
    
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('tr-TR');
    };

    // =======================================
    // --- NOTIFICATION SİSTEMİ ---
    // =======================================
    const showNotification = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconMap = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || iconMap.info}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // =======================================
    // --- LOADING STATE YÖNETİMİ ---
    // =======================================
    const showLoading = () => {
        let loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `<div class="spinner"></div><p>Yükleniyor...</p>`;
            document.body.appendChild(loadingOverlay);
        }
        loadingOverlay.classList.add('show');
    };

    const hideLoading = () => {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.remove('show');
    };

    // =======================================
    // --- VERİ KAYDETME VE YÜKLEME ---
    // =======================================
    const saveData = async () => {
        try {
            showLoading();
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db),
            });

            if (!response.ok) throw new Error('Sunucu hatası: ' + response.status);
            
            await response.json();
            hideLoading();
            showNotification('Veriler başarıyla kaydedildi', 'success');
        } catch (error) {
            hideLoading();
            console.error('Veriler sunucuya kaydedilemedi:', error);
            showNotification('Hata: Veriler sunucuya kaydedilemedi.', 'error');
        }
    };

    const loadData = async () => {
        try {
            showLoading();
            const response = await fetch('api.php');
            
            if (!response.ok) throw new Error('Veri yükleme hatası: ' + response.status);
            
            const loadedDb = await response.json();

            if (Object.keys(loadedDb).length > 0) {
                Object.keys(db).forEach(key => {
                    db[key] = loadedDb[key] !== undefined ? loadedDb[key] : 
                        (Array.isArray(db[key]) ? [] : (typeof db[key] === 'object' && db[key] !== null ? loadedDb[key] || {} : 0));
                });
            }

            if (!db.fixedExpenses || Object.keys(db.fixedExpenses).length === 0) {
                db.fixedExpenses = { salary: 0, insurance: 0, loan: 0, card: 0 };
            }
            
            if (db.totalCash === 0 && (db.companies || []).length === 0 && (db.jobs || []).length === 0) { 
                db.totalCash = 125450.00;
            }

            populateMonthFilters();
            populateCariSubmenuAndPages();
            renderAll();
            
            hideLoading();
            showNotification('Veriler başarıyla yüklendi', 'success');
        } catch (error) {
            hideLoading();
            console.error('Veriler sunucudan alınamadı:', error);
            showNotification('Veriler yüklenirken bir hata oluştu.', 'warning');
            
            populateMonthFilters();
            populateCariSubmenuAndPages();
            renderAll();
        }
    };

    // =======================================
    // --- FORM VALİDASYONU ---
    // =======================================
    const validateForm = (formData, formType) => {
        const errors = [];

        switch (formType) {
            case 'job':
                if (!formData.name || !formData.name.trim()) errors.push('İş adı boş olamaz');
                if (!formData.customer) errors.push('Müşteri seçilmelidir');
                if (!formData.company) errors.push('Şirket seçilmelidir');
                if (formData.amount <= 0) errors.push('Tutar sıfırdan büyük olmalıdır');
                if (formData.collected < 0) errors.push('Tahsilat negatif olamaz');
                if (formData.collected > (formData.amount * (1 + KDV_ORANI))) errors.push('Tahsilat tutardan fazla olamaz');
                break;

            case 'check':
                if (!formData.company || !formData.company.trim()) errors.push('Firma adı boş olamaz');
                if (!formData.checkbookName || !formData.checkbookName.trim()) errors.push('Çek defteri adı boş olamaz');
                if (!formData.givenDate) errors.push('Veriliş tarihi seçilmelidir');
                if (!formData.dueDate) errors.push('Vade tarihi seçilmelidir');
                if (formData.amount <= 0) errors.push('Çek tutarı sıfırdan büyük olmalıdır');
                break;

            case 'loan':
                if (!formData.name || !formData.name.trim()) errors.push('Kredi adı boş olamaz');
                if (formData.principal <= 0) errors.push('Anapara sıfırdan büyük olmalıdır');
                if (formData.term <= 0) errors.push('Vade sıfırdan büyük olmalıdır');
                if (formData.installmentAmount <= 0) errors.push('Taksit tutarı sıfırdan büyük olmalıdır');
                if (formData.paidInstallments < 0) errors.push('Ödenmiş taksit sayısı negatif olamaz');
                if (formData.paidInstallments > formData.term) errors.push('Ödenmiş taksit sayısı toplam vadeden fazla olamaz');
                break;

            case 'card':
            case 'overdraft':
                if (!formData.name || !formData.name.trim()) errors.push('Ad boş olamaz');
                if (formData.limit <= 0) errors.push('Limit sıfırdan büyük olmalıdır');
                if (formData.debt < 0) errors.push('Borç negatif olamaz');
                if (formData.debt > formData.limit) errors.push('Borç limitten büyük olamaz');
                break;

            case 'expense':
            case 'income':
                if (!formData.date) errors.push('Tarih seçilmelidir');
                if (!formData.category || !formData.category.trim()) errors.push('Kategori seçilmelidir');
                if (!formData.description || !formData.description.trim()) errors.push('Açıklama boş olamaz');
                if (formData.amount <= 0) errors.push('Tutar sıfırdan büyük olmalıdır');
                break;

            case 'company':
                if (!formData.name || !formData.name.trim()) errors.push('Tedarikçi adı boş olamaz');
                break;

            case 'debt':
            case 'receivable':
                if (!formData.description || !formData.description.trim()) errors.push('Açıklama boş olamaz');
                if (formData.amount <= 0) errors.push('Tutar sıfırdan büyük olmalıdır');
                break;

            case 'payment':
                if (!formData.day) errors.push('Ödeme günü seçilmelidir');
                if (!formData.recipient || !formData.recipient.trim()) errors.push('Alıcı adı boş olamaz');
                // Açıklama alanı kaldırıldı, validasyon yok
                if (!formData.category || !formData.category.trim()) errors.push('Kategori seçilmelidir');
                if (formData.amount <= 0) errors.push('Tutar sıfırdan büyük olmalıdır');
                break;

            case 'project':
                if (!formData.name || !formData.name.trim()) errors.push('Proje adı boş olamaz');
                if (!formData.customer || !formData.customer.trim()) errors.push('Müşteri adı boş olamaz');
                // Başlangıç tarihi, bitiş tarihi, ilerleme, sorumlu ve bütçe alanları kaldırıldı
                if (!formData.status) errors.push('Durum seçilmelidir');
                break;
        }

        if (errors.length > 0) {
            showNotification(errors.join('\n'), 'error');
            return false;
        }
        return true;
    };

    // =======================================
    // --- DİNAMİK MENÜ VE SAYFA OLUŞTURMA ---
    // =======================================
    const populateCariSubmenuAndPages = () => {
        const submenu = document.getElementById('ust-firma-cari-submenu');
        const cariContainer = document.getElementById('ust-firma-carisi');
        const activeCariPageId = document.querySelector('.cari-page.active')?.id || 
            document.querySelector('.sidebar-nav a.nav-link.active[data-target^="cari-page-"]')?.dataset.target;

        submenu.innerHTML = '';
        cariContainer.innerHTML = '';

        if (!db.companies || db.companies.length === 0) {
            submenu.innerHTML = '<li style="padding: 15px 25px; color: #adb5bd; font-size: 13px; font-style: italic;">Tedarikçi bulunamadı.</li>';
        } else {
            const sortedCompanies = [...db.companies].sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));
            sortedCompanies.forEach(company => {
                submenu.innerHTML += `<li class="dynamic-company-link"><a href="#" class="nav-link" data-target="cari-page-${company.id}">${company.name}</a></li>`;
                cariContainer.innerHTML += `<div id="cari-page-${company.id}" class="content-section cari-page"></div>`;
            });
        }
        updateDynamicSelects();

        if (activeCariPageId) {
            const currentActiveLink = document.querySelector(`.sidebar-nav a[data-target="${activeCariPageId}"]`);
            const currentActivePage = document.getElementById(activeCariPageId);

            if (currentActiveLink && currentActivePage) {
                document.querySelectorAll('.nav-link, .content-section, .cari-page').forEach(el => el.classList.remove('active'));
                const mainCariLink = document.querySelector('a[data-target="ust-firma-carisi"]');
                const mainCariContainer = document.getElementById('ust-firma-carisi');
                if (mainCariLink) mainCariLink.classList.add('active');
                if (mainCariContainer) mainCariContainer.classList.add('active');
                currentActiveLink.classList.add('active');
                currentActivePage.classList.add('active');
                const submenuParent = mainCariLink?.closest('.has-submenu');
                if (submenuParent) {
                    submenuParent.classList.add('open');
                    submenuParent.querySelector('.submenu').classList.add('open');
                }
            }
        }
    };

    const updateDynamicSelects = () => {
        const getCustomerList = () => {
            const dynamicCustomers = (db.jobs || []).map(job => job.customer).filter(Boolean);
            const allCustomers = [...new Set([...SABIT_KURUM_KATEGORILERI, ...dynamicCustomers])];
            return allCustomers.sort((a, b) => a.localeCompare(b, 'tr'));
        };

        const customerList = getCustomerList();
        ['job-customer', 'edit-job-customer'].forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                const currentVal = selectElement.value;
                let options = customerList.map(name => `<option value="${name}">${name}</option>`).join('');
                selectElement.innerHTML = `<option value="" disabled selected>Müşteri seçin...</option>${options}<option value="Diğer">Diğer</option>`;
                selectElement.value = currentVal;
            }
        });

        const dynamicSelectMap = {
            'job-company': SABIT_SIRKET_KATEGORILER,
            'edit-job-company': SABIT_SIRKET_KATEGORILER,
            'expense-category': SABIT_SIRKET_KATEGORILER,
            'edit-expense-category': SABIT_SIRKET_KATEGORILER,
            'income-category': SABIT_SIRKET_KATEGORILER,
            'edit-income-category': SABIT_SIRKET_KATEGORILER
        };

        Object.entries(dynamicSelectMap).forEach(([selectId, categories]) => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                const currentVal = selectElement.value;
                let options = categories.filter(name => name).map(name => `<option value="${name}">${name}</option>`).join('');
                selectElement.innerHTML = `<option value="" disabled selected>Kategori seçin...</option>${options}<option value="Diğer">Diğer</option>`;
                selectElement.value = currentVal;
            }
        });

        const paymentMethodSelects = ['cari-expense-method', 'expense-method', 'income-method', 'edit-expense-method', 'edit-income-method'];
        paymentMethodSelects.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                const currentVal = selectElement.value;
                let options = ODEME_SEKILLERI.map(name => `<option value="${name.toLowerCase()}">${name}</option>`).join('');
                selectElement.innerHTML = `<option value="" disabled selected>Seçiniz...</option>${options}`;
                if (currentVal) {
                    selectElement.value = currentVal;
                } else if (!selectId.startsWith('edit-')) {
                    selectElement.value = 'nakit';
                }
            }
        });
    };

    const renderCompanyCari = (company) => {
        const pageDiv = document.getElementById(`cari-page-${company.id}`);
        if (!pageDiv) return;

        const allExpensesForCompany = (db.expenses || []).filter(exp => exp.payee === company.name);
        const debtRecords = allExpensesForCompany.filter(exp => exp.category === 'Cari Borç Kaydı');
        const paymentRecords = allExpensesForCompany.filter(exp => exp.category !== 'Cari Borç Kaydı');

        const totalWorkValue = debtRecords.reduce((sum, exp) => sum + exp.amount, 0);
        const totalPayments = paymentRecords.reduce((sum, exp) => sum + exp.amount, 0);
        const balance = totalPayments - totalWorkValue;

        let balanceStatus = "Bakiye Sıfır";
        let balanceClass = "checks";
        if (balance > 0.01) {
            balanceStatus = "Tedarikçiden Alacaklı (Fazla Ödeme)";
            balanceClass = "income";
        } else if (balance < -0.01) {
            balanceStatus = "Tedarikçiye Borçlu";
            balanceClass = "expense";
        }

        pageDiv.innerHTML = `
            <div class="page-header">
                <h1>${company.name} - Tedarikçi Cari Ekstresi</h1>
                <div class="action-group">
                    <button class="btn btn-secondary export-btn" data-export-type="excel" data-export-target="#cari-page-${company.id}">
                        <i class="fas fa-file-excel"></i> Excel İndir
                    </button>
                    <button class="btn btn-secondary export-btn" data-export-type="pdf" data-export-target="#cari-page-${company.id}">
                        <i class="fas fa-file-pdf"></i> PDF İndir
                    </button>
                </div>
            </div>
            <div class="dashboard-cards cari-summary-cards" style="margin-bottom: 30px;">
                <div class="card"><div class="card-icon checks"><i class="fas fa-file-invoice-dollar"></i></div><div class="card-content"><span class="card-title">TEDARİKÇİNİN TOPLAM YAPTIĞI İŞ</span><span class="card-value">${formatCurrency(totalWorkValue)}</span></div></div>
                <div class="card"><div class="card-icon income"><i class="fas fa-hand-holding-usd"></i></div><div class="card-content"><span class="card-title">YAPILAN TOPLAM ÖDEME</span><span class="card-value">${formatCurrency(totalPayments)}</span></div></div>
                <div class="card"><div class="card-icon ${balanceClass}"><i class="fas fa-balance-scale"></i></div><div class="card-content"><span class="card-title">GÜNCEL BAKİYE (${balanceStatus})</span><span class="card-value">${formatCurrency(Math.abs(balance))}</span></div></div>
            </div>
            <div class="sub-section">
                <div class="sub-section-header">
                    <h2>Tedarikçiden Alınan Hizmet</h2>
                    <button class="btn btn-primary open-cari-job-modal-btn" data-company-id="${company.id}" data-company-name="${company.name}"><i class="fas fa-plus"></i> Borç Kaydı Ekle</button>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>TARİH</th><th>AÇIKLAMA</th><th class="text-right">TUTAR</th><th>İŞLEMLER</th></tr></thead>
                        <tbody>${debtRecords.length > 0 ? debtRecords.map(exp => `<tr><td>${formatDate(exp.date)}</td><td>${exp.description}</td><td class="text-right">${formatCurrency(exp.amount)}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${exp.id}" data-type="cari-debt"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${exp.id}" data-type="expense"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;">Bu tedarikçiye ait borç kaydı bulunamadı.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <div class="sub-section">
                <div class="sub-section-header">
                    <h2>Tedarikçiye Yapılan Ödemeler</h2>
                    <button class="btn btn-primary open-cari-expense-modal-btn" data-company-id="${company.id}" data-company-name="${company.name}"><i class="fas fa-plus"></i> Ödeme Ekle</button>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>ÖDEME TARİHİ</th><th>ÖDEME ŞEKLİ</th><th>AÇIKLAMA</th><th class="text-right">ÖDEME MİKTARI</th><th>İŞLEMLER</th></tr></thead>
                        <tbody>${paymentRecords.length > 0 ? paymentRecords.map(exp => `<tr><td>${formatDate(exp.date)}</td><td>${(exp.paymentMethod || 'Bilinmiyor').toUpperCase()}</td><td>${exp.description}</td><td class="text-right">${formatCurrency(exp.amount)}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${exp.id}" data-type="cari-payment"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${exp.id}" data-type="expense"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;">Bu tedarikçiye yapılmış ödeme kaydı bulunamadı.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    };

    // =======================================
    // --- RENDER FONKSİYONLARI ---
    // =======================================
    const renderAll = () => {
        renderCompanies();
        renderJobs();
        renderChecks();
        renderLoans();
        renderCards();
        renderOverdrafts();
        renderDebts();
        renderReceivables();
        renderExpenses();
        renderIncomes();
        renderBilancoTables();
        renderPayments();
        renderProjects();
        (db.companies || []).forEach(company => renderCompanyCari(company));
        updateAllSummaries();
    };

    const renderGeneric = (dataType, tableBodyId) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        tableBody.innerHTML = '';
        (db[dataType] || []).forEach(item => {
            const rowHTML = `<td>${item.to || item.from}</td><td>${item.description}</td><td class="text-right">${formatCurrency(item.amount)}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${item.id}" data-type="${dataType.slice(0, -1)}"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${item.id}" data-type="${dataType.slice(0, -1)}"><i class="fas fa-trash-alt"></i></button></td>`;
            tableBody.innerHTML += `<tr data-id="${item.id}">${rowHTML}</tr>`;
        });
    };

    const renderDated = (dataType, tableBodyId, filterFn) => {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const allItems = db[dataType] || [];
        const itemsToRender = filterFn ? allItems.filter(filterFn) : allItems;

        itemsToRender.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
            const paymentMethod = item.paymentMethod || 'nakit';
            const sourcePayee = item.source || item.payee || 'Bilinmiyor';
            const rowHTML = `<td data-date="${item.date}">${formatDate(item.date)}</td><td>${item.category}</td><td>${item.description}</td><td>${sourcePayee}</td><td class="text-right">${formatCurrency(item.amount)}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${item.id}" data-type="${dataType.slice(0, -1)}"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${item.id}" data-type="${dataType.slice(0, -1)}"><i class="fas fa-trash-alt"></i></button></td>`;
            tableBody.innerHTML += `<tr data-id="${item.id}" data-method="${paymentMethod}">${rowHTML}</tr>`;
        });
    };

    const renderCompanies = () => {
        const tableBody = document.getElementById('companies-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        (db.companies || []).forEach(company => {
            tableBody.innerHTML += `<tr data-id="${company.id}"><td>${company.name}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${company.id}" data-type="company"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${company.id}" data-type="company"><i class="fas fa-trash-alt"></i></button></td></tr>`;
        });
    };

    const renderJobs = () => {
        const ongoingBody = document.getElementById('ongoing-jobs-table-body');
        const completedBody = document.getElementById('completed-jobs-table-body');
        if (!ongoingBody || !completedBody) return;

        ongoingBody.innerHTML = '';
        completedBody.innerHTML = '';

        (db.jobs || []).forEach(job => {
            const amountWithVAT = job.amount * (1 + KDV_ORANI);
            const remainingBalance = amountWithVAT - (job.collected || 0);
            const isCompleted = remainingBalance <= 0.01;

            let statusHTML = job.invoiceStatus === 'invoiced'
                ? `<span class="status status-invoiced"><i class="fas fa-check-circle"></i> Faturalandı</span>`
                : `<span class="status status-pending-invoice"><i class="fas fa-hourglass-half"></i> Fatura Bekliyor</span>`;

            const rowHTML = `
                <td class="job-name-cell">${job.name}</td>
                <td>${job.customer}</td>
                <td>${job.company}</td>
                <td>${statusHTML}</td>
                <td class="text-right">${formatCurrency(job.amount)}</td>
                <td class="text-right">${formatCurrency(amountWithVAT)}</td>
                <td class="text-right">${formatCurrency(job.collected || 0)}</td>
                <td class="text-right text-bold">${formatCurrency(remainingBalance)}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-id="${job.id}" data-type="job"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon btn-delete" data-id="${job.id}" data-type="job"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            (isCompleted ? completedBody : ongoingBody).innerHTML += `<tr data-id="${job.id}">${rowHTML}</tr>`;
        });
    };

    const renderChecks = () => {
        const pendingContainer = document.getElementById('pending-checks-container');
        const paidContainer = document.getElementById('paid-checks-container');
        if (!pendingContainer || !paidContainer) return;

        const selectedPartnership = document.getElementById('check-partnership-filter')?.value || 'all';
        pendingContainer.innerHTML = '';
        paidContainer.innerHTML = '';

        const partnershipCategories = ["WARDA", "ATÖLYE", "BROSS", "ORYAP"];
        const checksByPartnership = {};
        [...partnershipCategories, "Diğer"].forEach(name => checksByPartnership[name] = { pending: [], paid: [] });

        (db.checks || []).forEach(check => {
            const category = check.partnershipCategory || "Diğer";
            let groupingCategory = partnershipCategories.includes(category) ? category : "Diğer";

            let isPartnershipMatch = (selectedPartnership === 'all')
                || (selectedPartnership === 'Diğer' && !partnershipCategories.includes(category))
                || (selectedPartnership === category);

            if (isPartnershipMatch) {
                const targetArray = check.status === 'paid' ? checksByPartnership[groupingCategory].paid : checksByPartnership[groupingCategory].pending;
                targetArray.push(check);
            }
        });

        Object.keys(checksByPartnership).forEach(category => {
            checksByPartnership[category].pending.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            checksByPartnership[category].paid.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        });

        const createTableHTML = (checks) => {
            if (checks.length === 0) {
                return '<tr><td colspan="10" style="text-align:center; font-style:italic;">Bu ortaklık segmentine ait çek kaydı bulunamadı.</td></tr>';
            }
            return checks.map(check => {
                const statusClass = `status-${check.status}`;
                const companyShareDecimal = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
                const companyObligation = check.amount * companyShareDecimal;
                const responsibleText = check.responsibleParty === 'partnership' ? `${(companyShareDecimal * 100).toFixed(0)}% Ortaklık` : 'Şirket (100%)';
                const partnershipCategory = check.partnershipCategory || 'Bilinmiyor';

                return `
                    <tr data-id="${check.id}">
                        <td>${formatDate(check.givenDate)}</td>
                        <td>${partnershipCategory}</td>
                        <td>${check.company}</td>
                        <td>${check.checkbookName}</td>
                        <td>${formatDate(check.dueDate)}</td>
                        <td class="text-right">${formatCurrency(check.amount)}</td>
                        <td>${responsibleText}</td>
                        <td class="text-right">${formatCurrency(companyObligation)}</td>
                        <td><span class="status ${statusClass}">${check.status === 'paid' ? 'Ödendi' : 'Bekliyor'}</span></td>
                        <td class="actions-cell">
                            <button class="btn-icon btn-edit" data-id="${check.id}" data-type="check"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn-icon btn-delete" data-id="${check.id}" data-type="check"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    </tr>`;
            }).join('');
        };

        const tableHeaders = `<thead><tr><th>VERİLİŞ TARİHİ</th><th>ORTAKLIK</th><th>FİRMA</th><th>ÇEK DEFTERİ</th><th>VADE TARİHİ</th><th class="text-right">TUTAR</th><th>SORUMLULUK</th><th class="text-right">ŞİRKET BORCU</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead>`;

        const renderPartnershipChecks = (categoryName, checkData, container) => {
            const currentContainer = container.id === 'pending-checks-container' ? checkData.pending : checkData.paid;
            if (currentContainer.length > 0) {
                container.innerHTML += `
                    <div class="sub-section-inner">
                        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px;">${categoryName} Çekleri</h3>
                        <div class="table-container">
                            <table class="data-table">
                                ${tableHeaders}
                                <tbody>${createTableHTML(currentContainer)}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        };

        [...partnershipCategories, "Diğer"].forEach(name => {
            renderPartnershipChecks(name, checksByPartnership[name], pendingContainer);
            renderPartnershipChecks(name, checksByPartnership[name], paidContainer);
        });

        if (pendingContainer.innerHTML === '') {
            pendingContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Filtreye uygun bekleyen çek kaydı bulunmamaktadır.</p>';
        }
        if (paidContainer.innerHTML === '') {
            paidContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Filtreye uygun ödenmiş çek kaydı bulunmamaktadır.</p>';
        }
        
        // Çekler sekmesi için bu ay ödenecek çekleri render et
        renderCurrentMonthChecksTable();
        
        // Özet kartları güncelle
        updateChecksSummaryCards();
    };
    
    const renderCurrentMonthChecksTable = () => {
        const tableBody = document.getElementById('current-month-checks-table-body');
        if (!tableBody) return;
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Bu ay ödenecek çekleri filtrele
        const currentMonthChecks = (db.checks || []).filter(check => {
            if (check.status === 'paid') return false;
            const dueDate = new Date(check.dueDate);
            return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        if (currentMonthChecks.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; font-style:italic; color: var(--text-secondary);">Bu ay ödenecek çek bulunmamaktadır.</td></tr>';
            return;
        }
        
        // Ortaklık renkleri
        const partnershipColors = {
            'WARDA': '#e3f2fd',      // Açık mavi
            'ATÖLYE': '#fff3e0',     // Açık turuncu
            'BROSS': '#f3e5f5',      // Açık mor
            'ORYAP': '#e8f5e9',      // Açık yeşil
            'Diğer': '#f5f5f5'       // Açık gri
        };
        
        tableBody.innerHTML = currentMonthChecks.map(check => {
            const partnership = check.partnershipCategory || 'Diğer';
            const bgColor = partnershipColors[partnership] || partnershipColors['Diğer'];
            
            // Sorumluluk payını hesapla
            const companyShareDecimal = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
            const companyObligation = check.amount * companyShareDecimal;
            const sharePercentage = (companyShareDecimal * 100).toFixed(0);
            
            // Sorumluluk durumunu belirle
            const responsibilityText = check.responsibleParty === 'partnership' 
                ? `${partnership} (${sharePercentage}%)` 
                : `${partnership} (100%)`;
            
            return `
                <tr style="background-color: ${bgColor};">
                    <td><strong>${responsibilityText}</strong></td>
                    <td>${check.company}</td>
                    <td>${check.checkbookName}</td>
                    <td>${formatDate(check.dueDate)}</td>
                    <td style="text-align: right;"><strong>${formatCurrency(companyObligation)}</strong></td>
                </tr>
            `;
        }).join('');
    };
    
    const updateChecksSummaryCards = () => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Bu ay ödenecek çekler
        const thisMonthChecks = (db.checks || []).filter(check => {
            if (check.status === 'paid') return false;
            const dueDate = new Date(check.dueDate);
            return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
        });
        
        const thisMonthCount = thisMonthChecks.length;
        const thisMonthTotal = thisMonthChecks.reduce((sum, check) => {
            const companyShare = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
            return sum + (check.amount * companyShare);
        }, 0);
        
        // Bekleyen çekler
        const pendingChecks = (db.checks || []).filter(c => c.status !== 'paid');
        const pendingCount = pendingChecks.length;
        const pendingTotal = pendingChecks.reduce((sum, check) => {
            const companyShare = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
            return sum + (check.amount * companyShare);
        }, 0);
        
        // Ödenmiş çekler
        const paidChecks = (db.checks || []).filter(c => c.status === 'paid');
        const paidCount = paidChecks.length;
        const paidTotal = paidChecks.reduce((sum, check) => {
            const companyShare = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
            return sum + (check.amount * companyShare);
        }, 0);
        
        // Toplam
        const totalCount = (db.checks || []).length;
        const totalAmount = pendingTotal + paidTotal;
        
        // Kartları güncelle
        document.getElementById('checks-this-month-count').textContent = `${thisMonthCount} Çek`;
        document.getElementById('checks-this-month-total').textContent = formatCurrency(thisMonthTotal);
        
        document.getElementById('checks-pending-count').textContent = `${pendingCount} Çek`;
        document.getElementById('checks-pending-total').textContent = formatCurrency(pendingTotal);
        
        document.getElementById('checks-paid-count').textContent = `${paidCount} Çek`;
        document.getElementById('checks-paid-total').textContent = formatCurrency(paidTotal);
        
        document.getElementById('checks-total-count').textContent = `${totalCount} Çek`;
        document.getElementById('checks-total-amount').textContent = formatCurrency(totalAmount);
    };
    
    const renderThisMonthChecks = () => {
        const checksPageTableBody = document.getElementById('this-month-checks-table-body');
        if (!checksPageTableBody) return;
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Bu ay ödenecek çekleri filtrele (bekleyen ve bu ay vadesi gelen)
        const thisMonthChecks = (db.checks || []).filter(check => {
            if (check.status === 'paid') return false;
            const dueDate = new Date(check.dueDate);
            return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        // Ortaklıklara göre grupla
        const partnershipCategories = ["WARDA", "ATÖLYE", "BROSS", "ORYAP"];
        const checksByPartnership = {};
        [...partnershipCategories, "Diğer"].forEach(name => checksByPartnership[name] = []);
        
        thisMonthChecks.forEach(check => {
            const category = check.partnershipCategory || "Diğer";
            const groupingCategory = partnershipCategories.includes(category) ? category : "Diğer";
            checksByPartnership[groupingCategory].push(check);
        });
        
        const createCheckRow = (check) => {
            const partnershipName = check.partnershipCategory || 'Diğer';
            
            return `
                <tr data-id="${check.id}">
                    <td>${check.company}</td>
                    <td>${check.checkbookName}</td>
                    <td>${formatDate(check.dueDate)}</td>
                    <td style="text-align: right;">${formatCurrency(check.amount)}</td>
                    <td style="text-align: center;"><span class="status status-info">${partnershipName}</span></td>
                    <td style="text-align: center;">
                        <button class="btn-icon btn-edit" data-id="${check.id}" data-type="check"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon btn-delete" data-id="${check.id}" data-type="check"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        };
        
        const createPartnershipSection = (partnershipName, checks) => {
            if (checks.length === 0) return '';
            
            const total = checks.reduce((sum, check) => sum + (check.amount || 0), 0);
            
            return `
                <tr style="background-color: #f8f9fa;">
                    <td colspan="6" style="font-weight: 600; padding: 12px 15px;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i>${partnershipName} - Toplam: ${formatCurrency(total)}
                    </td>
                </tr>
                ${checks.map(check => createCheckRow(check)).join('')}
            `;
        };
        
        // Çekler sekmesi tablosu
        if (thisMonthChecks.length === 0) {
            checksPageTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; font-style:italic; color: var(--text-secondary);">Bu ay ödenecek çek bulunmamaktadır.</td></tr>';
        } else {
            const html = [...partnershipCategories, "Diğer"]
                .map(name => createPartnershipSection(name, checksByPartnership[name]))
                .join('');
            checksPageTableBody.innerHTML = html;
        }
    };

    const renderLoans = () => {
        const tableBody = document.getElementById('loans-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        (db.loans || []).forEach(loan => {
            const totalPaid = (loan.paidInstallments || 0) * (loan.installmentAmount || 0);
            const remainingPayment = ((loan.term || 0) * (loan.installmentAmount || 0)) - totalPaid;
            
            // İlerleme yüzdesini hesapla
            const progressPercentage = loan.term > 0 ? ((loan.paidInstallments || 0) / loan.term) * 100 : 0;
            
            const rowHTML = `
                <td>Ayın ${loan.paymentDay}. Günü</td>
                <td>${loan.name}</td>
                <td class="text-right">${formatCurrency(loan.principal)}</td>
                <td class="text-right">${loan.term} Ay</td>
                <td class="text-right">${loan.paidInstallments}</td>
                <td class="text-right">${formatCurrency(loan.installmentAmount)}</td>
                <td class="text-right">${formatCurrency(totalPaid)}</td>
                <td class="text-right">${formatCurrency(remainingPayment)}</td>
                <td>
                    <div class="progress-bar-container" style="width: 100px;">
                        <div class="progress-bar" style="width: ${progressPercentage}%;"></div>
                        <span class="progress-bar-text">${progressPercentage.toFixed(1)}%</span>
                    </div>
                </td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-id="${loan.id}" data-type="loan"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon btn-delete" data-id="${loan.id}" data-type="loan"><i class="fas fa-trash-alt"></i></button>
                </td>`;
            tableBody.innerHTML += `<tr data-id="${loan.id}">${rowHTML}</tr>`;
        });
    };

    const renderCards = () => {
        const tableBody = document.getElementById('cards-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        [...(db.cards || [])].sort((a, b) => b.debt - a.debt).forEach(card => {
            const availableLimit = (card.limit || 0) - (card.debt || 0);
            const percentage = (card.limit > 0) ? ((card.debt || 0) / card.limit) * 100 : 0;
            let textValue = `%${percentage.toFixed(2)}`;
            const rowHTML = `<td>${card.name}</td><td class="text-right">${formatCurrency(card.limit)}</td><td class="text-right">${formatCurrency(availableLimit)}</td><td class="text-right">${formatCurrency(card.debt)}</td><td><div class="progress-bar-container"><div class="progress-bar" style="width: ${percentage.toFixed(2)}%;"></div><span class="progress-bar-text">${textValue}</span></div></td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${card.id}" data-type="card"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${card.id}" data-type="card"><i class="fas fa-trash-alt"></i></button></td>`;
            tableBody.innerHTML += `<tr data-id="${card.id}">${rowHTML}</tr>`;
        });
    };

    const renderOverdrafts = () => {
        const tableBody = document.getElementById('overdrafts-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        [...(db.overdrafts || [])].sort((a, b) => b.debt - a.debt).forEach(od => {
            const availableLimit = (od.limit || 0) - (od.debt || 0);
            const percentage = (od.limit > 0) ? ((od.debt || 0) / od.limit) * 100 : 0;
            let textValue = `%${percentage.toFixed(2)}`;
            const rowHTML = `<td>${od.name}</td><td class="text-right">${formatCurrency(od.limit)}</td><td class="text-right">${formatCurrency(availableLimit)}</td><td class="text-right">${formatCurrency(od.debt)}</td><td><div class="progress-bar-container"><div class="progress-bar" style="width: ${percentage.toFixed(2)}%;"></div><span class="progress-bar-text">${textValue}</span></div></td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${od.id}" data-type="overdraft"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${od.id}" data-type="overdraft"><i class="fas fa-trash-alt"></i></button></td>`;
            tableBody.innerHTML += `<tr data-id="${od.id}">${rowHTML}</tr>`;
        });
    };

    const renderDebts = () => renderGeneric('debts', 'debts-table-body');
    const renderReceivables = () => renderGeneric('receivables', 'receivables-table-body');

    const renderExpenses = () => {
        const filterFunction = (item) => item.category !== 'Cari Borç Ödemesi' && item.category !== 'Cari Borç Kaydı';
        renderDated('expenses', 'expenses-table-body', filterFunction);
    };

    const renderIncomes = () => renderDated('incomes', 'incomes-table-body');

    const getAutomaticBilancoItems = () => {
        const islerdenAlacaklar = ((db.jobs || []).reduce((sum, job) => sum + (job.amount * (1 + KDV_ORANI)), 0)) - ((db.jobs || []).reduce((sum, job) => sum + (job.collected || 0), 0));
        const piyasadanAlacaklar = (db.receivables || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const cekBorclari = (db.checks || []).filter(c => c.status === 'waiting' && c.partnershipCategory === 'WARDA').reduce((sum, check) => sum + check.amount, 0);
        const krediBorclari = ((db.loans || []).reduce((sum, l) => sum + ((l.term || 0) * (l.installmentAmount || 0)), 0)) - ((db.loans || []).reduce((sum, l) => sum + ((l.paidInstallments || 0) * (l.installmentAmount || 0)), 0));
        const krediKartiBorclari = (db.cards || []).reduce((sum, card) => sum + card.debt, 0);
        const piyasaBorclari = (db.debts || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const eksiHesapBorclari = (db.overdrafts || []).reduce((sum, od) => sum + od.debt, 0);

        let cariBorclar = 0;
        let cariAlacaklar = 0;

        (db.companies || []).forEach(company => {
            const allExpensesForCompany = (db.expenses || []).filter(exp => exp.payee === company.name);
            const totalDebtRecords = allExpensesForCompany
                .filter(exp => exp.category === 'Cari Borç Kaydı')
                .reduce((sum, exp) => sum + exp.amount, 0);
            const totalPaymentRecords = allExpensesForCompany
                .filter(exp => exp.category !== 'Cari Borç Kaydı')
                .reduce((sum, exp) => sum + exp.amount, 0);

            const balance = totalPaymentRecords - totalDebtRecords;

            if (balance > 0.01) {
                cariAlacaklar += balance;
            } else if (balance < -0.01) {
                cariBorclar += Math.abs(balance);
            }
        });

        const autoAlacaklar = [
            { id: 'auto_islerden', name: 'İŞLERDEN ALACAKLAR', amount: islerdenAlacaklar },
            { id: 'auto_piyasadan', name: 'PİYASADAN ALACAKLAR', amount: piyasadanAlacaklar },
            { id: 'auto_cari_alacak', name: 'CARİ ALACAKLARI (TEDARİKÇİ)', amount: cariAlacaklar }
        ];

        const autoBorclar = [
            { id: 'auto_cek', name: 'WARDA ÇEK BORÇLARI', amount: cekBorclari },
            { id: 'auto_kredi', name: 'KREDİ BORÇLARI', amount: krediBorclari },
            { id: 'auto_kart', name: 'KREDİ KARTI BORÇLARI', amount: krediKartiBorclari },
            { id: 'auto_piyasa_borc', name: 'PİYASA BORÇLARI', amount: piyasaBorclari },
            { id: 'auto_eksi', name: 'EKSİ HESAP BORÇLARI', amount: eksiHesapBorclari },
            { id: 'auto_cari_borc', name: 'CARİ BORÇLARI (TEDARİKÇİ)', amount: cariBorclar }
        ];

        return { autoAlacaklar, autoBorclar };
    };

    const renderBilancoTables = () => {
        const { autoAlacaklar, autoBorclar } = getAutomaticBilancoItems();

        const renderBilancoGeneric = (dataType, tableBodyId, itemType, autoItems = []) => {
            const tableBody = document.getElementById(tableBodyId);
            if (!tableBody) return;
            tableBody.innerHTML = '';

            autoItems.forEach(item => {
                if (item.amount > 0.01) {
                    const rowHTML = `<td>${item.name}</td><td class="text-right">${formatCurrency(item.amount)}</td><td class="actions-cell"><i>Otomatik</i></td>`;
                    tableBody.innerHTML += `<tr data-id="${item.id}" class="auto-generated-row">${rowHTML}</tr>`;
                }
            });

            (db[dataType] || []).forEach(item => {
                const rowHTML = `<td>${item.name}</td><td class="text-right">${formatCurrency(item.amount)}</td><td class="actions-cell"><button class="btn-icon btn-edit" data-id="${item.id}" data-type="${itemType}"><i class="fas fa-pencil-alt"></i></button><button class="btn-icon btn-delete" data-id="${item.id}" data-type="${itemType}"><i class="fas fa-trash-alt"></i></button></td>`;
                tableBody.innerHTML += `<tr data-id="${item.id}">${rowHTML}</tr>`;
            });
        };

        renderBilancoGeneric('bilancoVarliklar', 'bilanco-varliklar-table-body', 'bilanco-varlik');
        renderBilancoGeneric('bilancoAlacaklar', 'bilanco-alacaklar-table-body', 'bilanco-alacak', autoAlacaklar);
        renderBilancoGeneric('bilancoBorclar', 'bilanco-borclar-table-body', 'bilanco-borc', autoBorclar);
        updateBilancoTotals();
    };

    const updateBilancoTotals = () => {
        const { autoAlacaklar, autoBorclar } = getAutomaticBilancoItems();
        const totalVarliklar = (db.bilancoVarliklar || []).reduce((sum, item) => sum + item.amount, 0);
        const manualAlacaklar = (db.bilancoAlacaklar || []).reduce((sum, item) => sum + item.amount, 0);
        const automaticAlacaklar = autoAlacaklar.reduce((sum, item) => sum + item.amount, 0);
        const totalAlacaklar = manualAlacaklar + automaticAlacaklar;
        const manualBorclar = (db.bilancoBorclar || []).reduce((sum, item) => sum + item.amount, 0);
        const automaticBorclar = autoBorclar.reduce((sum, item) => sum + item.amount, 0);
        const totalBorclar = manualBorclar + automaticBorclar;
        const netDeger = totalVarliklar + totalAlacaklar - totalBorclar;

        document.getElementById('bilanco-total-varliklar').innerText = formatCurrency(totalVarliklar);
        document.getElementById('bilanco-total-alacaklar').innerText = formatCurrency(totalAlacaklar);
        document.getElementById('bilanco-total-borclar').innerText = formatCurrency(totalBorclar);
        document.getElementById('bilanco-net-deger').innerText = formatCurrency(netDeger);
    };

    // =======================================
    // --- ÖZET GÜNCELLEME FONKSİYONLARI ---
    // =======================================
    const updateAllSummaries = () => {
        // Eksi Hesaplar toplam borcunu kontrol et
        const totalOverdraftDebt = (db.overdrafts || []).reduce((sum, od) => sum + (od.debt || 0), 0);
        
        // Kart elementlerini al
        const cashValueEl = document.getElementById('total-cash-value');
        const cashTitleEl = document.getElementById('total-cash-title');
        const cashIconEl = document.getElementById('total-cash-icon');
        const cashCardEl = document.getElementById('total-cash-card');
        
        // Eksi hesaplarda borç varsa - KIRMIZI UYARI
        if (totalOverdraftDebt > 0) {
            cashValueEl.innerText = '-' + formatCurrency(totalOverdraftDebt);
            cashValueEl.style.cursor = 'default';
            cashValueEl.style.color = '#dc2626';
            cashValueEl.title = 'Eksi Hesaplar Toplam Borcu (Otomatik)';
            
            cashTitleEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right: 6px; color: #dc2626;"></i>KASADAKİ GÜNCEL BAKİYE';
            cashTitleEl.style.color = '#dc2626';
            
            cashIconEl.className = 'card-icon expense';
            cashIconEl.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            
            cashCardEl.style.border = '2px solid #fee2e2';
            cashCardEl.style.background = 'linear-gradient(to bottom, #fef2f2, #fff)';
        } 
        // Kasa artıda - YEŞİL POZİTİF
        else if (db.totalCash > 0) {
            cashValueEl.innerText = '+' + formatCurrency(db.totalCash);
            cashValueEl.style.cursor = 'pointer';
            cashValueEl.style.color = '#16a34a';
            cashValueEl.title = 'Düzenlemek için tıklayın';
            
            cashTitleEl.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 6px; color: #16a34a;"></i>KASADAKİ GÜNCEL BAKİYE';
            cashTitleEl.style.color = '#16a34a';
            
            cashIconEl.className = 'card-icon income';
            cashIconEl.innerHTML = '<i class="fas fa-arrow-trend-up"></i>';
            
            cashCardEl.style.border = '2px solid #dcfce7';
            cashCardEl.style.background = 'linear-gradient(to bottom, #f0fdf4, #fff)';
        }
        // Kasa sıfır veya boş - NORMAL
        else {
            cashValueEl.innerText = formatCurrency(db.totalCash);
            cashValueEl.style.cursor = 'pointer';
            cashValueEl.style.color = '';
            cashValueEl.title = 'Düzenlemek için tıklayın';
            
            cashTitleEl.innerHTML = 'KASADAKİ GÜNCEL BAKİYE';
            cashTitleEl.style.color = '';
            
            cashIconEl.className = 'card-icon checks';
            cashIconEl.innerHTML = '<i class="fas fa-hand-holding-usd"></i>';
            
            cashCardEl.style.border = '';
            cashCardEl.style.background = '';
        }
        
        updateJobSummary();
        updateLoanSummary();
        updateCardSummary();
        updateOverdraftSummary();
        updateCheckSummaryAndChart();
        renderMonthlyBalanceChart();
        filterAndSummarizeDatedItems();
        updateMainDashboardBalances();
        renderUpcomingPayments();
        renderNotes();
    };

    const updateJobSummary = () => {
        const totalVatAmount = (db.jobs || []).reduce((sum, job) => sum + (job.amount * (1 + KDV_ORANI)), 0);
        const totalCollected = (db.jobs || []).reduce((sum, job) => sum + (job.collected || 0), 0);
        const totalRemaining = totalVatAmount - totalCollected;
        document.getElementById('total-job-vat-amount').innerText = formatCurrency(totalVatAmount);
        document.getElementById('total-job-collected').innerText = formatCurrency(totalCollected);
        document.getElementById('total-job-remaining').innerText = formatCurrency(totalRemaining);
        document.getElementById('main-total-job-amount').innerText = formatCurrency(totalVatAmount);
        document.getElementById('main-collected-amount').innerText = formatCurrency(totalCollected);
        document.getElementById('main-remaining-amount').innerText = formatCurrency(totalRemaining);
    };

    const updateLoanSummary = () => {
        const totalMonthlyInstallment = (db.loans || []).reduce((sum, loan) => sum + (loan.installmentAmount || 0), 0);
        const totalPrincipal = (db.loans || []).reduce((sum, loan) => sum + (loan.principal || 0), 0);
        const totalPaidLoan = (db.loans || []).reduce((sum, loan) => sum + ((loan.paidInstallments || 0) * (loan.installmentAmount || 0)), 0);
        const totalLoanAmount = (db.loans || []).reduce((sum, l) => sum + ((l.term || 0) * (l.installmentAmount || 0)), 0);
        const totalRemainingLoan = totalLoanAmount - totalPaidLoan;
        document.getElementById('total-monthly-installment').innerText = formatCurrency(totalMonthlyInstallment);
        document.getElementById('total-principal').innerText = formatCurrency(totalPrincipal);
        document.getElementById('total-paid-loan').innerText = formatCurrency(totalPaidLoan);
        document.getElementById('total-remaining-loan').innerText = formatCurrency(totalRemainingLoan);
    };

    const updateCardSummary = () => {
        const totalLimit = (db.cards || []).reduce((sum, card) => sum + (card.limit || 0), 0);
        const totalDebt = (db.cards || []).reduce((sum, card) => sum + (card.debt || 0), 0);
        const totalAvailableLimit = totalLimit - totalDebt;
        const usageRate = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
        document.getElementById('total-card-limit').innerText = formatCurrency(totalLimit);
        document.getElementById('total-card-debt').innerText = formatCurrency(totalDebt);
        document.getElementById('total-available-limit').innerText = formatCurrency(totalAvailableLimit);
        document.getElementById('total-usage-rate').innerText = `${usageRate.toFixed(2)}%`;
    };

    const updateOverdraftSummary = () => {
        const totalLimit = (db.overdrafts || []).reduce((sum, od) => sum + (od.limit || 0), 0);
        const totalDebt = (db.overdrafts || []).reduce((sum, od) => sum + (od.debt || 0), 0);
        const totalAvailableLimit = totalLimit - totalDebt;
        const usageRate = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
        document.getElementById('total-overdraft-limit').innerText = formatCurrency(totalLimit);
        document.getElementById('total-overdraft-debt').innerText = formatCurrency(totalDebt);
        document.getElementById('total-overdraft-available-limit').innerText = formatCurrency(totalAvailableLimit);
        document.getElementById('total-overdraft-usage-rate').innerText = `${usageRate.toFixed(2)}%`;
    };

    const updateCheckSummaryAndChart = () => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Bu ay + önümüzdeki 2 ay = 3 ay
        const monthsToShow = [];
        const monthlyTotals = [];
        
        for (let i = 0; i <= 2; i++) {
            const targetMonth = currentMonth + i;
            const targetDate = new Date(currentYear, targetMonth, 1);
            monthsToShow.push({
                month: targetDate.getMonth(),
                year: targetDate.getFullYear(),
                name: monthNames[targetDate.getMonth()]
            });
            monthlyTotals.push(0);
        }
        
        // Çekleri filtrele ve topla
        (db.checks || []).filter(c => c.status === 'waiting').forEach(check => {
            const date = new Date(check.dueDate);
            if (!isNaN(date.getTime())) {
                monthsToShow.forEach((monthInfo, index) => {
                    if (date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year) {
                        const companyShareDecimal = (check.companyShare !== undefined && check.companyShare !== null) ? check.companyShare : 1.00;
                        monthlyTotals[index] += (check.amount || 0) * companyShareDecimal;
                    }
                });
            }
        });

        const chartBarsContainer = document.getElementById('chart-bars-container-check');
        const yAxis = document.getElementById('chart-y-axis-check');

        if (!chartBarsContainer || !yAxis) return;
        chartBarsContainer.innerHTML = '';
        yAxis.innerHTML = '';

        const maxTotal = Math.max(...monthlyTotals, 1);
        const niceMax = Math.ceil(maxTotal / 500000) * 500000 || 500000;
        const formatYAxis = (value) => value >= 1000 ? `${(value / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}K` : value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });

        yAxis.innerHTML = `<span>${formatYAxis(niceMax)}</span><span>${formatYAxis(niceMax * 2 / 3)}</span><span>${formatYAxis(niceMax * 1 / 3)}</span><span>0</span>`;

        monthsToShow.forEach((monthInfo, index) => {
            const value = monthlyTotals[index];
            const percentage = niceMax > 0 ? (value / niceMax) * 100 : 0;
            const barColor = 'var(--color-checks)';
            const barHTML = value > 0
                ? `<div class="bar" style="height: ${percentage}%; background-color: ${barColor};"><span class="bar-value">${formatCurrency(value)}</span></div>`
                : `<div class="bar empty"></div>`;

            chartBarsContainer.innerHTML += `<div class="chart-bar-group">${barHTML}<span class="month">${monthInfo.name.substring(0, 3).toUpperCase()}</span></div>`;
        });
    };

    const renderMonthlyBalanceChart = () => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Bu ay + önümüzdeki 2 ay = 3 ay
        const monthsToShow = [];
        const monthlyData = [];
        
        for (let i = 0; i <= 2; i++) {
            const targetMonth = currentMonth + i;
            const targetDate = new Date(currentYear, targetMonth, 1);
            monthsToShow.push({
                month: targetDate.getMonth(),
                year: targetDate.getFullYear(),
                name: monthNames[targetDate.getMonth()]
            });
            monthlyData.push({ income: 0, expense: 0, balance: 0 });
        }

        (db.incomes || []).forEach(item => {
            const date = new Date(item.date);
            if (!isNaN(date.getTime())) {
                monthsToShow.forEach((monthInfo, index) => {
                    if (date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year) {
                        monthlyData[index].income += (item.amount || 0);
                    }
                });
            }
        });

        (db.expenses || []).filter(item => item.category !== 'Cari Borç Ödemesi' && item.category !== 'Cari Borç Kaydı').forEach(item => {
            const date = new Date(item.date);
            if (!isNaN(date.getTime())) {
                monthsToShow.forEach((monthInfo, index) => {
                    if (date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year) {
                        monthlyData[index].expense += (item.amount || 0);
                    }
                });
            }
        });

        const fixedExpenseMonthly = Object.values(db.fixedExpenses || {}).reduce((sum, amount) => sum + amount, 0);
        monthlyData.forEach(data => {
            data.expense += fixedExpenseMonthly;
            data.balance = data.income - data.expense;
        });

        const cardsContainer = document.getElementById('balance-cards-container');
        if (!cardsContainer) return;

        cardsContainer.innerHTML = monthsToShow.map((monthInfo, index) => {
            const data = monthlyData[index];
            const balance = data.balance;
            const balanceClass = balance >= 0 ? 'income' : 'expense';
            const balanceIcon = balance >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const balanceText = balance >= 0 ? 'Gelir Fazlası' : 'Gider Fazlası';
            
            return `
                <div class="card" style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; text-align: center; color: var(--text-primary); font-size: 20px; font-weight: 700; border-bottom: 2px solid var(--border-color); padding-bottom: 12px;">
                        ${monthInfo.name.toUpperCase()}
                    </h3>
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background-color: rgba(46, 204, 113, 0.1); border-radius: 8px;">
                            <span style="color: var(--text-secondary); font-size: 15px; font-weight: 500;">
                                <i class="fas fa-arrow-up" style="color: var(--color-income); margin-right: 8px;"></i>Gelir
                            </span>
                            <span style="font-weight: 700; font-size: 16px; color: var(--color-income);">${formatCurrency(data.income)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background-color: rgba(231, 76, 60, 0.1); border-radius: 8px;">
                            <span style="color: var(--text-secondary); font-size: 15px; font-weight: 500;">
                                <i class="fas fa-arrow-down" style="color: var(--color-expense); margin-right: 8px;"></i>Gider
                            </span>
                            <span style="font-weight: 700; font-size: 16px; color: var(--color-expense);">${formatCurrency(data.expense)}</span>
                        </div>
                        <hr style="margin: 18px 0; border: none; border-top: 3px solid var(--border-color);">
                        <div style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background-color: ${balance >= 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)'}; border-radius: 8px;">
                            <div style="display: flex; align-items: center; justify-content: center;">
                                <i class="fas ${balanceIcon}" style="color: var(--color-${balanceClass}); margin-right: 8px; font-size: 16px;"></i>
                                <span style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${balanceText}</span>
                            </div>
                            <div style="text-align: center;">
                                <span style="font-weight: 800; font-size: 24px; color: var(--color-${balanceClass});">${formatCurrency(Math.abs(balance))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const filterAndSummarizeDatedItems = () => {
        const incomeMonth = document.getElementById('income-month-filter')?.value;
        const expenseMonth = document.getElementById('expense-month-filter')?.value;
        const expenseMethod = document.getElementById('expense-method-filter')?.value || 'all';
        
        const filterTable = (tableBodyId, selectedMonth, selectedMethod) => {
            const tableBody = document.getElementById(tableBodyId);
            if (!tableBody) return;
            tableBody.querySelectorAll('tr').forEach(row => {
                const date = row.querySelector('[data-date]')?.dataset.date;
                const method = row.dataset.method;
                const monthMatch = (selectedMonth === 'all' || !date || (new Date(date).getMonth() + 1) == selectedMonth);
                const methodMatch = (selectedMethod === 'all' || method === selectedMethod);
                row.style.display = (monthMatch && methodMatch) ? '' : 'none';
            });
        };
        
        filterTable('incomes-table-body', incomeMonth, 'all');
        filterTable('expenses-table-body', expenseMonth, expenseMethod);
        
        const updateCategoryCards = (summaryEl, tableBodyId, type) => {
            if (!summaryEl || !document.getElementById(tableBodyId)) return;
            const totals = {};
            let totalCategoryAmount = 0;
            document.getElementById(tableBodyId).querySelectorAll('tr:not([style*="display: none"])').forEach(row => {
                const category = row.cells[1]?.innerText?.trim();
                const amount = parseCurrency(row.cells[4]?.innerText);
                if (category) {
                    totals[category] = (totals[category] || 0) + amount;
                    totalCategoryAmount += amount;
                }
            });
            summaryEl.innerHTML = '';
            const sortedTotals = Object.entries(totals).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
            sortedTotals.forEach(([category, total]) => {
                const icon = type === 'expense' ? 'fa-tag' : 'fa-hand-holding-usd';
                summaryEl.insertAdjacentHTML('beforeend', `<div class="card small-card"><div class="card-icon ${type}"><i class="fas ${icon}"></i></div><div class="card-content"><span class="card-title">${category}</span><span class="card-value">${formatCurrency(total)}</span></div></div>`);
            });
            if (totalCategoryAmount === 0) {
                summaryEl.innerHTML = '<div class="card small-card"><div class="card-content" style="text-align:center;"><span class="card-title">Filtreye Uygun Kayıt Yok</span><span class="card-value">₺0,00</span></div></div>';
            }
        };
        
        updateCategoryCards(document.getElementById('expense-category-summary'), 'expenses-table-body', 'expense');
        updateCategoryCards(document.getElementById('income-category-summary'), 'incomes-table-body', 'income');
        updateMonthlyBalanceCard();
    };

    const updateMonthlyBalanceCard = () => {
        const fixedExpensesTotal = Object.values(db.fixedExpenses || {}).reduce((sum, amount) => sum + amount, 0);
        let totalIncome = 0, totalExpense = 0;
        document.querySelectorAll('#incomes-table-body tr:not([style*="display: none"])').forEach(r => totalIncome += parseCurrency(r.cells[4]?.innerText));
        document.querySelectorAll('#expenses-table-body tr:not([style*="display: none"])').forEach(r => totalExpense += parseCurrency(r.cells[4]?.innerText));
        totalExpense += fixedExpensesTotal;
        const balance = totalIncome - totalExpense;
        document.getElementById('monthly-total-income').innerText = formatCurrency(totalIncome);
        document.getElementById('monthly-total-expense').innerText = formatCurrency(totalExpense);
        document.getElementById('monthly-balance').innerText = formatCurrency(balance);
        const balanceCard = document.getElementById('balance-card');
        const icon = balanceCard?.querySelector('.card-icon');
        const i = icon?.querySelector('i');
        if (icon) {
            icon.className = 'card-icon';
            if (balance > 0) { icon.classList.add('income'); if (i) i.className = 'fas fa-arrow-up'; }
            else if (balance < 0) { icon.classList.add('expense'); if (i) i.className = 'fas fa-arrow-down'; }
            else { icon.classList.add('checks'); if (i) i.className = 'fas fa-balance-scale'; }
        }
    };

    const renderUpcomingPayments = () => {
        const container = document.getElementById('upcoming-payments-container');
        if (!container) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(today.getDate() + 7);
        
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        // Ödeme Takip'ten bekleyen ödemeleri al
        const upcomingPayments = (db.payments || []).filter(payment => {
            if (payment.status === 'completed') return false;
            
            // Tekrarlayan ödeme ise bu ayın günü
            if (payment.isRecurring) {
                const paymentDate = new Date(currentYear, currentMonth - 1, parseInt(payment.day));
                return paymentDate >= today && paymentDate <= sevenDaysLater;
            }
            
            // Tek seferlik ödeme ise specificMonth'a bak
            if (payment.specificMonth) {
                const [year, month] = payment.specificMonth.split('-');
                const paymentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(payment.day));
                return paymentDate >= today && paymentDate <= sevenDaysLater;
            }
            
            return false;
        }).map(payment => {
            // Ödeme tarihini hesapla
            let paymentDate;
            if (payment.isRecurring) {
                paymentDate = new Date(currentYear, currentMonth - 1, parseInt(payment.day));
            } else if (payment.specificMonth) {
                const [year, month] = payment.specificMonth.split('-');
                paymentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(payment.day));
            }
            return { ...payment, paymentDate };
        }).sort((a, b) => a.paymentDate - b.paymentDate);
        
        if (upcomingPayments.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-secondary); background-color: rgba(46, 204, 113, 0.1); border-radius: 8px;"><i class="fas fa-check-circle" style="font-size: 24px; color: var(--color-income); margin-bottom: 10px;"></i><p style="margin: 0; font-size: 16px;">Önümüzdeki 7 günde ödeme bulunmamaktadır.</p></div>';
            return;
        }
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                ${upcomingPayments.map(payment => {
                    const daysUntil = Math.ceil((payment.paymentDate - today) / (1000 * 60 * 60 * 24));
                    
                    // Yeni renk aralıkları: 0-1, 2-3, 4-5, 6-7
                    let urgencyColor, urgencyBgColor, urgencyIcon;
                    if (daysUntil <= 1) {
                        urgencyColor = '#e74c3c'; // Kırmızı
                        urgencyBgColor = 'rgba(231, 76, 60, 0.1)';
                        urgencyIcon = 'fa-exclamation-circle';
                    } else if (daysUntil <= 3) {
                        urgencyColor = '#f39c12'; // Turuncu
                        urgencyBgColor = 'rgba(243, 156, 18, 0.1)';
                        urgencyIcon = 'fa-clock';
                    } else if (daysUntil <= 5) {
                        urgencyColor = '#3498db'; // Mavi
                        urgencyBgColor = 'rgba(52, 152, 219, 0.1)';
                        urgencyIcon = 'fa-calendar-day';
                    } else {
                        urgencyColor = '#1abc9c'; // Yeşil-mavi
                        urgencyBgColor = 'rgba(26, 188, 156, 0.1)';
                        urgencyIcon = 'fa-calendar-check';
                    }
                    
                    const urgencyText = daysUntil === 0 ? 'BUGÜN' : daysUntil === 1 ? 'YARIN' : `${daysUntil} GÜN`;
                    
                    return `
                        <div class="card" style="padding: 14px; border-radius: 10px; background: ${urgencyBgColor}; border: 2px solid ${urgencyColor}20; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s;">
                            <div style="text-align: center; margin-bottom: 10px;">
                                <div style="background: ${urgencyColor}; color: white; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px ${urgencyColor}40;">
                                    <i class="fas ${urgencyIcon}" style="font-size: 12px;"></i>
                                    ${urgencyText}
                                </div>
                            </div>
                            <div style="text-align: center; margin-bottom: 10px;">
                                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">${payment.recipient}</div>
                                <div style="font-size: 10px; color: var(--text-secondary); background-color: rgba(255,255,255,0.6); padding: 3px 8px; border-radius: 4px; display: inline-block;">
                                    <i class="fas fa-tag" style="margin-right: 3px; font-size: 9px;"></i>${payment.category}
                                </div>
                            </div>
                            <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 11px; color: var(--text-secondary);">
                                    <i class="fas fa-calendar-alt" style="margin-right: 4px; font-size: 10px; color: ${urgencyColor};"></i>${formatDate(payment.paymentDate)}
                                </span>
                                <span style="font-weight: 800; font-size: 15px; color: ${urgencyColor};">${formatCurrency(payment.amount)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };
    
    const updateMainDashboardBalances = () => {
        const { autoAlacaklar, autoBorclar } = getAutomaticBilancoItems();
        const manualAlacaklar = (db.bilancoAlacaklar || []).reduce((sum, item) => sum + item.amount, 0);
        const automaticAlacaklar = autoAlacaklar.reduce((sum, item) => sum + item.amount, 0);
        const toplamAlacaklar = manualAlacaklar + automaticAlacaklar;
        const manualBorclar = (db.bilancoBorclar || []).reduce((sum, item) => sum + item.amount, 0);
        const automaticBorclar = autoBorclar.reduce((sum, item) => sum + item.amount, 0);
        const toplamBorclar = manualBorclar + automaticBorclar;
        const nakitBilancosu = (toplamAlacaklar - toplamBorclar) + db.totalCash;
        const malVarligiBilancosu = (db.bilancoVarliklar || []).reduce((sum, item) => sum + item.amount, 0);

        document.getElementById('cash-balance-value').innerText = formatCurrency(nakitBilancosu);
        document.getElementById('asset-balance-value').innerText = formatCurrency(malVarligiBilancosu);
    };

    // =======================================
    // --- EXPORT FONKSİYONLARI ---
    // =======================================
    const exportToPdfWithTurkish = async (targetSelector, fileName) => {
        const targetElement = document.querySelector(targetSelector);
        
        if (!targetElement) {
            showNotification('PDF oluşturulamadı', 'error');
            return;
        }

        // Tarayıcı yazdırma kullan - en iyi sonuç
        const printWindow = window.open('', '_blank');
        const clonedContent = targetElement.cloneNode(true);
        
        // Butonları kaldır
        clonedContent.querySelectorAll('button, .export-btn, .btn-icon').forEach(btn => btn.remove());
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${fileName}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    @page { 
                        size: A4; 
                        margin: 12mm; 
                    }
                    
                    * { box-sizing: border-box; }
                    
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        color: #2c3e50;
                        line-height: 1.6;
                        background: #fff;
                    }
                    
                    /* Sayfa başlığı - Modern Indigo gradient */
                    .page-header h1 {
                        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
                        color: white;
                        padding: 20px;
                        margin: 0 0 20px 0;
                        text-align: center;
                        font-size: 20px;
                        font-weight: 700;
                        letter-spacing: 1px;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                        border-radius: 8px;
                    }
                    
                    /* Başlıklar */
                    h1 { 
                        font-size: 24px; 
                        margin: 15px 0 10px 0; 
                        color: #2c3e50;
                        border-bottom: 3px solid #3498db;
                        padding-bottom: 8px;
                        font-weight: 700;
                    }
                    
                    h2 { 
                        font-size: 16px; 
                        margin: 12px 0 8px 0; 
                        color: #34495e;
                        background: linear-gradient(to right, #ecf0f1, transparent);
                        padding: 8px 12px;
                        border-left: 4px solid #3498db;
                        font-weight: 600;
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    
                    h3 { 
                        font-size: 14px; 
                        margin: 8px 0; 
                        color: #7f8c8d;
                        font-weight: 600;
                    }
                    
                    /* Tablolar - Modern ve renkli */
                    table { 
                        width: 100%; 
                        border-collapse: separate;
                        border-spacing: 0;
                        margin: 15px 0;
                        page-break-inside: auto;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    
                    /* Tablo başlığını her sayfada tekrarla */
                    thead {
                        display: table-header-group;
                    }
                    
                    tbody {
                        display: table-row-group;
                    }
                    
                    /* Başlık ve ilk satır birlikte kalsın */
                    thead tr {
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    
                    tbody tr {
                        page-break-inside: avoid;
                    }
                    
                    th { 
                        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                        color: #fff;
                        font-weight: 700;
                        padding: 14px 10px;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border: none;
                        text-align: left;
                    }
                    
                    td { 
                        border-bottom: 1px solid #e8e8e8;
                        border-right: 1px solid #f0f0f0;
                        padding: 12px 10px;
                        font-size: 11px;
                        color: #2c3e50;
                    }
                    
                    td:last-child {
                        border-right: none;
                    }
                    
                    tbody tr:last-child td {
                        border-bottom: none;
                    }
                    
                    tbody tr:nth-child(even) {
                        background-color: #f8f9fa;
                    }
                    
                    tbody tr:hover {
                        background-color: #e8f4f8;
                    }
                    
                    /* Kartlar - Modern Indigo renkleri */
                    .card, .mini-card { 
                        border: 2px solid #6366f1;
                        border-radius: 12px;
                        padding: 16px; 
                        margin: 8px;
                        page-break-inside: avoid;
                        background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%);
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
                        border-left: 6px solid #6366f1;
                        position: relative;
                    }
                    
                    .card-icon {
                        width: 50px;
                        height: 50px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 10px;
                        background: linear-gradient(135deg, #6366f1, #8b5cf6);
                        color: white;
                        font-size: 22px;
                        box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
                    }
                    
                    .card-title {
                        font-size: 10px;
                        color: #475569;
                        text-transform: uppercase;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                        display: block;
                        margin-bottom: 6px;
                    }
                    
                    .card-value {
                        font-size: 24px;
                        color: #6366f1;
                        font-weight: 800;
                        display: block;
                    }
                    
                    /* Dashboard cards - Grid layout */
                    .dashboard-cards {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                        margin: 20px 0;
                    }
                    
                    /* Status badges */
                    .status {
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 600;
                        display: inline-block;
                    }
                    
                    .status-income {
                        background-color: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                    }
                    
                    .status-expense {
                        background-color: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                    }
                    
                    .status-info {
                        background-color: #d1ecf1;
                        color: #0c5460;
                        border: 1px solid #bee5eb;
                    }
                    
                    /* Hizalama */
                    .text-right { text-align: right; font-weight: 600; }
                    .text-center { text-align: center; }
                    
                    /* Dashboard cards grid */
                    .dashboard-cards {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 12px;
                        margin: 15px 0;
                    }
                    
                    /* İkonlar */
                    .fa, .fas, .far {
                        margin-right: 6px;
                        color: #3498db;
                    }
                    
                    /* Progress bar */
                    .progress-bar-container {
                        background-color: #ecf0f1;
                        border-radius: 4px;
                        overflow: hidden;
                        height: 20px;
                        position: relative;
                    }
                    
                    .progress-bar {
                        background: linear-gradient(to right, #3498db, #2980b9);
                        height: 100%;
                        border-radius: 4px;
                    }
                    
                    .progress-bar-text {
                        position: absolute;
                        width: 100%;
                        text-align: center;
                        line-height: 20px;
                        font-size: 10px;
                        font-weight: 600;
                        color: #2c3e50;
                    }
                    
                    /* Footer - Her sayfada */
                    @page {
                        margin-bottom: 25mm;
                        
                        @bottom-center {
                            content: element(footer);
                        }
                    }
                    
                    .pdf-footer {
                        position: running(footer);
                        width: 100%;
                        text-align: center;
                        padding: 15px 0;
                        border-top: 3px solid #6366f1;
                        margin-top: 20px;
                    }
                    
                    .pdf-footer-content {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        max-width: 100%;
                    }
                    
                    .pdf-footer-logo {
                        font-size: 16px;
                        font-weight: 800;
                        color: #6366f1;
                        letter-spacing: 2px;
                    }
                    
                    .pdf-footer-page {
                        font-size: 10px;
                        color: #64748b;
                    }
                </style>
            </head>
            <body>
                ${clonedContent.innerHTML}
                <div class="pdf-footer">
                    <div class="pdf-footer-content">
                        <span class="pdf-footer-logo">WARDA AŞ</span>
                        <span class="pdf-footer-page">© ${new Date().getFullYear()} - Tüm hakları saklıdır</span>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
        
        showNotification('Yazdırma penceresi açıldı. "PDF olarak kaydet" seçeneğini kullanın.', 'success');
    };

    const exportToExcel = (targetSelector, fileName) => {
        const targetElement = document.querySelector(targetSelector);
        
        if (!targetElement) {
            showNotification('Excel oluşturulamadı: Hedef element bulunamadı', 'error');
            return;
        }

        showLoading();

        try {
            const tables = targetElement.querySelectorAll('.data-table, table');
            
            if (tables.length === 0) {
                hideLoading();
                showNotification('Tablolar bulunamadı', 'warning');
                return;
            }

            const workbook = XLSX.utils.book_new();

            tables.forEach((table, index) => {
                const sheetName = `Sayfa${index + 1}`;
                const worksheet = XLSX.utils.table_to_sheet(table);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });

            XLSX.writeFile(workbook, `${fileName}.xlsx`);
            hideLoading();
            showNotification('Excel başarıyla indirildi!', 'success');
        } catch (error) {
            hideLoading();
            console.error('Excel hatası:', error);
            showNotification('Excel oluşturulurken hata oluştu', 'error');
        }
    };

    // =======================================
    // --- FORM SUBMIT & CRUD İŞLEMLERİ ---
    // =======================================
    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('open');
    };

    const closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            const form = modal.querySelector('form');
            form?.reset();
            modal.querySelectorAll('[id$="-other-group"]').forEach(el => el.style.display = 'none');
            modal.querySelectorAll('[id$="-share-group"]').forEach(el => el.style.display = 'none');
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const modal = form.closest('.modal-overlay');

        const formId = form.id;
        let isEdit = false;
        let type = '';

        if (formId.startsWith('edit-')) {
            isEdit = true;
            type = formId.replace('edit-', '').replace('-form', '');
        } else if (formId.startsWith('add-')) {
            type = formId.replace('add-', '').replace('-form', '');
        } else {
            console.error("Form ID formatı tanınmıyor:", formId);
            showNotification('Form hatası: Geçersiz form ID', 'error');
            return;
        }

        let newCompanyId = null;
        let data = { id: isEdit ? form.querySelector('input[type="hidden"]')?.value : generateId() };
        let dataType;

        if (type === 'cari-job' || type === 'cari-expense') {
            dataType = 'expenses';
        } else if (type.startsWith('bilanco-')) {
            const bilancoMap = {
                'bilanco-varlik': 'bilancoVarliklar',
                'bilanco-alacak': 'bilancoAlacaklar',
                'bilanco-borc': 'bilancoBorclar'
            };
            dataType = bilancoMap[type];
        } else {
            dataType = type === 'company' ? 'companies' : type + 's';
        }

        switch (type) {
            case 'company':
                data.name = (document.getElementById(isEdit ? 'edit-company-name' : 'company-name')?.value || '').trim().toUpperCase();
                if (!validateForm(data, 'company')) return;
                if (!isEdit) newCompanyId = data.id;
                break;

            case 'job':
                const customerSelect = document.getElementById(isEdit ? 'edit-job-customer' : 'job-customer');
                const companySelect = document.getElementById(isEdit ? 'edit-job-company' : 'job-company');
                data.name = document.getElementById(isEdit ? 'edit-job-name' : 'job-name')?.value;
                data.customer = customerSelect?.value === 'Diğer' ? document.getElementById(isEdit ? 'edit-job-customer-other' : 'job-customer-other')?.value : customerSelect?.value;
                data.company = companySelect?.value === 'Diğer' ? document.getElementById(isEdit ? 'edit-job-company-other' : 'job-company-other')?.value : companySelect?.value;
                data.invoiceStatus = document.getElementById(isEdit ? 'edit-job-invoice-status' : 'job-invoice-status')?.value;
                data.amount = getCleanNumericValue(isEdit ? 'edit-job-amount' : 'job-amount');
                data.collected = getCleanNumericValue(isEdit ? 'edit-job-collected' : 'job-collected');
                if (!validateForm(data, 'job')) return;
                break;

            case 'check':
                const prefixCheck = isEdit ? 'edit-check' : 'check';
                const partnershipSelect = document.getElementById(`${prefixCheck}-partnership-category`);
                data.givenDate = document.getElementById(`${prefixCheck}-given-date`)?.value;
                data.partnershipCategory = partnershipSelect?.value === 'Diğer' ? document.getElementById(`${prefixCheck}-partnership-category-other`)?.value : partnershipSelect?.value;
                data.company = document.getElementById(`${prefixCheck}-company`)?.value;
                data.checkbookName = document.getElementById(`${prefixCheck}-checkbook-name`)?.value;
                data.dueDate = document.getElementById(`${prefixCheck}-due-date`)?.value;
                data.amount = getCleanNumericValue(`${prefixCheck}-amount`);
                data.responsibleParty = document.getElementById(`${prefixCheck}-responsible-party`)?.value;
                if (data.responsibleParty === 'partnership') {
                    const sharePercentage = parseFloat(document.getElementById(`${prefixCheck}-company-share`)?.value || 0);
                    data.companyShare = sharePercentage / 100;
                } else {
                    data.companyShare = 1.0;
                }
                data.status = document.getElementById(`${prefixCheck}-status`)?.value;
                if (!validateForm(data, 'check')) return;
                break;

            case 'loan':
                data.name = document.getElementById(isEdit ? 'edit-loan-name' : 'loan-name')?.value;
                data.paymentDay = parseInt(document.getElementById(isEdit ? 'edit-loan-payment-day' : 'loan-payment-day')?.value || '0');
                data.principal = getCleanNumericValue(isEdit ? 'edit-loan-principal' : 'loan-principal');
                data.term = parseInt(document.getElementById(isEdit ? 'edit-loan-term' : 'loan-term')?.value || '0');
                data.paidInstallments = parseInt(document.getElementById(isEdit ? 'edit-loan-paid-installments' : 'loan-paid-installments')?.value || '0');
                data.installmentAmount = getCleanNumericValue(isEdit ? 'edit-loan-installment-amount' : 'loan-installment-amount');
                if (!validateForm(data, 'loan')) return;
                break;

            case 'card':
                data.name = document.getElementById(isEdit ? 'edit-card-name' : 'card-name')?.value;
                data.limit = getCleanNumericValue(isEdit ? 'edit-card-limit' : 'card-limit');
                const availableLimit = getCleanNumericValue(isEdit ? 'edit-card-available-limit' : 'card-available-limit');
                // Güncel borç = Limit - Kullanılabilir Limit
                data.debt = data.limit - availableLimit;
                if (!validateForm(data, 'card')) return;
                break;

            case 'overdraft':
                data.name = document.getElementById(isEdit ? 'edit-overdraft-name' : 'overdraft-name')?.value;
                data.limit = getCleanNumericValue(isEdit ? 'edit-overdraft-limit' : 'overdraft-limit');
                const overdraftAvailableLimit = getCleanNumericValue(isEdit ? 'edit-overdraft-available-limit' : 'overdraft-available-limit');
                // Güncel borç = Limit - Kullanılabilir Limit
                data.debt = data.limit - overdraftAvailableLimit;
                if (!validateForm(data, 'overdraft')) return;
                break;

            case 'debt':
                data.to = document.getElementById(isEdit ? 'edit-debt-to' : 'debt-to')?.value;
                data.description = document.getElementById(isEdit ? 'edit-debt-description' : 'debt-description')?.value;
                data.amount = getCleanNumericValue(isEdit ? 'edit-debt-amount' : 'debt-amount');
                if (!validateForm(data, 'debt')) return;
                break;

            case 'receivable':
                data.from = document.getElementById(isEdit ? 'edit-receivable-from' : 'receivable-from')?.value;
                data.description = document.getElementById(isEdit ? 'edit-receivable-description' : 'receivable-description')?.value;
                data.amount = getCleanNumericValue(isEdit ? 'edit-receivable-amount' : 'receivable-amount');
                if (!validateForm(data, 'receivable')) return;
                break;

            case 'cari-job':
                data.date = new Date().toISOString().split('T')[0];
                data.description = document.getElementById('cari-job-description')?.value;
                data.amount = getCleanNumericValue('cari-job-amount');
                data.paymentMethod = null;
                data.payee = document.getElementById('cari-job-company-name')?.value;
                data.category = 'Cari Borç Kaydı';
                break;

            case 'cari-expense':
                data.date = document.getElementById('cari-expense-date')?.value;
                data.description = document.getElementById('cari-expense-description')?.value;
                data.amount = getCleanNumericValue('cari-expense-amount');
                data.category = 'Cari Borç Ödemesi';
                data.payee = document.getElementById('cari-expense-company-name')?.value;
                data.paymentMethod = document.getElementById('cari-expense-method')?.value;
                break;

            case 'expense':
            case 'income':
                const genericPrefix = isEdit ? `edit-${type}` : type;
                const catSelect = document.getElementById(`${genericPrefix}-category`);
                data.date = document.getElementById(`${genericPrefix}-date`)?.value;
                data.category = catSelect?.value === 'Diğer' ? document.getElementById(`${genericPrefix}-category-other`)?.value : catSelect?.value;
                data.description = document.getElementById(`${genericPrefix}-description`)?.value;
                data[type === 'expense' ? 'payee' : 'source'] = document.getElementById(`${genericPrefix}-${type === 'expense' ? 'payee' : 'source'}`)?.value;
                data.amount = getCleanNumericValue(`${genericPrefix}-amount`);
                data.paymentMethod = document.getElementById(`${genericPrefix}-method`)?.value;
                if (!validateForm(data, type)) return;
                break;

            case 'bilanco-varlik':
            case 'bilanco-alacak':
            case 'bilanco-borc':
                const bilancoPrefix = isEdit ? `edit-${type}` : type;
                data.name = document.getElementById(`${bilancoPrefix}-name`)?.value;
                data.amount = getCleanNumericValue(`${bilancoPrefix}-amount`);
                break;

            default:
                console.error("Bilinmeyen form tipi:", type);
                showNotification('Bilinmeyen form tipi', 'error');
                return;
        }

        updateDb(dataType, data, isEdit);
        if (modal) closeModal(modal.id);

        if (newCompanyId) {
            setTimeout(() => {
                const newCariLink = document.querySelector(`a[data-target="cari-page-${newCompanyId}"]`);
                if (newCariLink) newCariLink.click();
            }, 100);
        }
    };

    const updateDb = (dataType, data, isEdit) => {
        if (!db[dataType]) db[dataType] = [];

        if (dataType === 'expenses' || dataType === 'incomes') {
            const oldItem = isEdit ? db[dataType].find(item => item.id == data.id) : null;
            if (oldItem) {
                if (oldItem.paymentMethod === 'nakit') {
                    if (dataType === 'incomes') db.totalCash -= (oldItem.amount || 0);
                    else if (dataType === 'expenses') db.totalCash += (oldItem.amount || 0);
                }
            }
            if (data.paymentMethod === 'nakit') {
                if (dataType === 'incomes') db.totalCash += data.amount;
                else if (dataType === 'expenses') db.totalCash -= data.amount;
            }
        }

        if (isEdit) {
            const index = db[dataType].findIndex(item => item.id == data.id);
            if (index > -1) db[dataType][index] = data;
        } else {
            db[dataType].push(data);
        }

        saveData();
        populateCariSubmenuAndPages();
        renderAll();
    };

    const handleEditClick = (id, type) => {
        let dataType;
        if (type === 'bilanco-varlik') dataType = 'bilancoVarliklar';
        else if (type === 'bilanco-alacak') dataType = 'bilancoAlacaklar';
        else if (type === 'bilanco-borc') dataType = 'bilancoBorclar';
        else if (type === 'cari-debt' || type === 'cari-payment') dataType = 'expenses';
        else {
            dataType = type === 'company' ? 'companies' : type + 's';
        }

        const item = db[dataType]?.find(i => i.id == id);
        if (!item) {
            console.error(`Düzenlenecek öğe bulunamadı. ID: ${id}, Tip: ${type}, Veri Tipi: ${dataType}`);
            showNotification('Düzenlenecek kayıt bulunamadı', 'error');
            return;
        }

        const handleSelect = (selectId, otherGroupId, otherId, itemValue, categories) => {
            const select = document.getElementById(selectId);
            const otherGroup = document.getElementById(otherGroupId);
            const otherInput = document.getElementById(otherId);
            if (!select || !otherGroup || !otherInput) return;
            const isKnown = categories.includes(itemValue);

            select.value = isKnown ? itemValue : 'Diğer';
            otherGroup.style.display = isKnown ? 'none' : 'block';
            otherInput.value = isKnown ? '' : itemValue;
        };

        switch (type) {
            case 'company':
                document.getElementById('edit-company-id').value = item.id;
                document.getElementById('edit-company-name').value = item.name;
                openModal('edit-company-modal');
                break;

            case 'cari-debt':
                const modalId = 'cari-job-modal';
                const form = document.getElementById(modalId).querySelector('form');
                form.id = 'edit-cari-job-form';
                document.getElementById('cari-job-modal-title').innerText = "Borç Kaydını Düzenle";
                form.querySelector('input[type="hidden"]').value = item.id;
                document.getElementById('cari-job-company-name').value = item.payee;
                document.getElementById('cari-job-description').value = item.description;
                document.getElementById('cari-job-amount').value = item.amount;
                openModal(modalId);
                break;

            case 'cari-payment':
                const paymentModalId = 'cari-expense-modal';
                const paymentForm = document.getElementById(paymentModalId).querySelector('form');
                paymentForm.id = 'edit-cari-expense-form';
                document.getElementById('cari-expense-modal-title').innerText = "Ödemeyi Düzenle";
                paymentForm.querySelector('input[type="hidden"]').value = item.id;
                document.getElementById('cari-expense-company-name').value = item.payee;
                document.getElementById('cari-expense-date').value = item.date;
                document.getElementById('cari-expense-description').value = item.description;
                document.getElementById('cari-expense-amount').value = item.amount;
                document.getElementById('cari-expense-method').value = item.paymentMethod || 'nakit';
                openModal(paymentModalId);
                break;

            case 'check':
                const editCheckPrefix = 'edit-check';
                document.getElementById(`${editCheckPrefix}-id`).value = item.id;
                document.getElementById(`${editCheckPrefix}-given-date`).value = item.givenDate || '';
                document.getElementById(`${editCheckPrefix}-company`).value = item.company || '';
                document.getElementById(`${editCheckPrefix}-checkbook-name`).value = item.checkbookName || '';
                document.getElementById(`${editCheckPrefix}-due-date`).value = item.dueDate || '';
                document.getElementById(`${editCheckPrefix}-amount`).value = item.amount;
                document.getElementById(`${editCheckPrefix}-status`).value = item.status;

                const partnershipCategories = ["WARDA", "ATÖLYE", "BROSS", "ORYAP"];
                handleSelect(`${editCheckPrefix}-partnership-category`, `${editCheckPrefix}-partnership-category-other-group`, `${editCheckPrefix}-partnership-category-other`, item.partnershipCategory, partnershipCategories);

                const responsiblePartySelect = document.getElementById(`${editCheckPrefix}-responsible-party`);
                const shareGroup = document.getElementById(`${editCheckPrefix}-share-group`);
                responsiblePartySelect.value = item.responsibleParty || 'company';
                if (item.responsibleParty === 'partnership') {
                    shareGroup.style.display = 'block';
                    document.getElementById(`${editCheckPrefix}-company-share`).value = (item.companyShare || 0) * 100;
                } else {
                    shareGroup.style.display = 'none';
                }

                openModal('edit-check-modal');
                break;

            case 'job':
                const editJobModalId = `edit-job-modal`;
                const jobPrefix = `edit-job`;
                document.getElementById(`${jobPrefix}-id`).value = item.id;
                document.getElementById(`${jobPrefix}-name`).value = item.name;
                document.getElementById(`${jobPrefix}-amount`).value = item.amount;
                document.getElementById(`${jobPrefix}-collected`).value = item.collected;

                updateDynamicSelects();
                const allCustomers = [...new Set([...SABIT_KURUM_KATEGORILERI, ...((db.jobs || []).map(j => j.customer).filter(Boolean))])];
                handleSelect('edit-job-customer', 'edit-job-customer-other-group', 'edit-job-customer-other', item.customer, allCustomers);
                handleSelect('edit-job-company', 'edit-job-company-other-group', 'edit-job-company-other', item.company, SABIT_SIRKET_KATEGORILER);
                document.getElementById('edit-job-invoice-status').value = item.invoiceStatus;
                openModal(editJobModalId);
                break;

            case 'expense':
            case 'income':
                const editModalId = `edit-${type}-modal`;
                const prefix = `edit-${type}`;
                document.getElementById(`${prefix}-id`).value = item.id;
                ['description', 'amount', 'date', 'payee', 'source'].forEach(field => {
                    const el = document.getElementById(`${prefix}-${field}`);
                    if (el && item[field] !== undefined) el.value = item[field];
                });
                document.getElementById(`edit-${type}-method`).value = item.paymentMethod || 'nakit';
                handleSelect(`edit-${type}-category`, `edit-${type}-category-other-group`, `edit-${type}-category-other`, item.category, SABIT_SIRKET_KATEGORILER);
                openModal(editModalId);
                break;

            case 'loan':
                document.getElementById('edit-loan-id').value = item.id;
                document.getElementById('edit-loan-name').value = item.name || '';
                document.getElementById('edit-loan-payment-day').value = item.paymentDay || '';
                document.getElementById('edit-loan-principal').value = item.principal || '';
                document.getElementById('edit-loan-term').value = item.term || '';
                document.getElementById('edit-loan-paid-installments').value = item.paidInstallments || '';
                document.getElementById('edit-loan-installment-amount').value = item.installmentAmount || '';
                openModal('edit-loan-modal');
                break;

            case 'card':
                document.getElementById('edit-card-id').value = item.id;
                document.getElementById('edit-card-name').value = item.name || '';
                document.getElementById('edit-card-limit').value = item.limit || '';
                // Kullanılabilir limit = Limit - Borç
                const availableLimit = (item.limit || 0) - (item.debt || 0);
                document.getElementById('edit-card-available-limit').value = availableLimit;
                openModal('edit-card-modal');
                break;

            case 'overdraft':
                document.getElementById('edit-overdraft-id').value = item.id;
                document.getElementById('edit-overdraft-name').value = item.name || '';
                document.getElementById('edit-overdraft-limit').value = item.limit || '';
                // Kullanılabilir limit = Limit - Borç
                const overdraftAvailableLimit = (item.limit || 0) - (item.debt || 0);
                document.getElementById('edit-overdraft-available-limit').value = overdraftAvailableLimit;
                openModal('edit-overdraft-modal');
                break;

            case 'debt':
                document.getElementById('edit-debt-id').value = item.id;
                document.getElementById('edit-debt-to').value = item.to || '';
                document.getElementById('edit-debt-description').value = item.description || '';
                document.getElementById('edit-debt-amount').value = item.amount || '';
                openModal('edit-debt-modal');
                break;

            case 'receivable':
                document.getElementById('edit-receivable-id').value = item.id;
                document.getElementById('edit-receivable-from').value = item.from || '';
                document.getElementById('edit-receivable-description').value = item.description || '';
                document.getElementById('edit-receivable-amount').value = item.amount || '';
                openModal('edit-receivable-modal');
                break;

            case 'bilanco-varlik':
            case 'bilanco-alacak':
            case 'bilanco-borc':
                const bilancoModalId = `edit-${type}-modal`;
                const bilancoPrefix = `edit-${type}`;
                document.getElementById(`${bilancoPrefix}-id`).value = item.id;
                document.getElementById(`${bilancoPrefix}-name`).value = item.name;
                document.getElementById(`${bilancoPrefix}-amount`).value = item.amount;
                openModal(bilancoModalId);
                break;
        }
    };

    const handleDeleteClick = (id, type) => {
        let dataType;
        const isIncomeOrExpense = type === 'expense' || type === 'income';

        if (type === 'bilanco-varlik') dataType = 'bilancoVarliklar';
        else if (type === 'bilanco-alacak') dataType = 'bilancoAlacaklar';
        else if (type === 'bilanco-borc') dataType = 'bilancoBorclar';
        else {
            dataType = (type === 'company' ? 'companies' : type.replace('cari-', '') + 's');
        }

        if (type === 'company') {
            const company = db.companies.find(c => c.id == id);
            if (company && (db.expenses || []).some(e => e.payee === company.name)) {
                showNotification(`'${company.name}' tedarikçisini silemezsiniz. Bu tedarikçiye ait gider (ödeme/borç) kayıtları bulunmaktadır.`, 'error');
                return;
            }
        }

        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            let itemToRemove = null;
            const index = (db[dataType] || []).findIndex(item => item.id == id);

            if (index > -1) {
                itemToRemove = db[dataType][index];
                if (isIncomeOrExpense && itemToRemove.paymentMethod === 'nakit') {
                    if (dataType === 'incomes') db.totalCash -= (itemToRemove.amount || 0);
                    else if (dataType === 'expenses') db.totalCash += (itemToRemove.amount || 0);
                }
                db[dataType].splice(index, 1);
            }

            saveData();
            if (type === 'company') {
                populateCariSubmenuAndPages();
                document.querySelector('a[data-target="anasayfa"]')?.click();
            } else {
                renderAll();
            }
        }
    };

    // =======================================
    // --- EVENT LISTENERS ---
    // =======================================
    const setupInitialListeners = () => {
        // Sidebar navigation
        document.querySelector('.sidebar-nav')?.addEventListener('click', e => {
            const link = e.target.closest('a.nav-link');
            if (!link) return;
            e.preventDefault();

            const parentLi = link.parentElement;

            if (parentLi.classList.contains('has-submenu')) {
                parentLi.classList.toggle('open');
                parentLi.querySelector('.submenu')?.classList.toggle('open');
                return;
            }

            const isSubmenuLink = link.closest('.submenu');

            if (!isSubmenuLink) {
                document.querySelectorAll('.has-submenu.open, .submenu.open').forEach(el => {
                    el.classList.remove('open');
                });
            }

            document.querySelectorAll('.nav-link, .content-section, .cari-page').forEach(el => el.classList.remove('active'));
            link.classList.add('active');

            if (isSubmenuLink) {
                const mainNavLink = isSubmenuLink.closest('.has-submenu')?.querySelector('a.nav-link');
                if (mainNavLink) mainNavLink.classList.add('active');
            }

            const targetId = link.dataset.target;
            if (targetId?.startsWith('cari-page-')) {
                const mainCariContainer = document.getElementById('ust-firma-carisi');
                const cariPage = document.getElementById(targetId);
                const mainCariLink = document.querySelector('a[data-target="ust-firma-carisi"]');

                if (mainCariLink) mainCariLink.classList.add('active');
                if (mainCariContainer) mainCariContainer.classList.add('active');
                if (cariPage) cariPage.classList.add('active');

                const submenuParent = mainCariLink?.closest('.has-submenu');
                if (submenuParent) {
                    submenuParent.classList.add('open');
                    submenuParent.querySelector('.submenu')?.classList.add('open');
                }
            } else {
                const targetElement = document.getElementById(targetId);
                if (targetElement) targetElement.classList.add('active');
            }
        });

        // Modal açma/kapama ve EXPORT butonları
        document.body.addEventListener('click', e => {
            // MODAL AÇMA
            const openBtn = e.target.closest('[id$="-modal-btn"], .open-cari-job-modal-btn, .open-cari-expense-modal-btn, [data-modal-target]');
            if (openBtn) {
                let modalId = openBtn.dataset.modalTarget || openBtn.id.replace('open-', '').replace('-btn', '');

                if (openBtn.classList.contains('open-cari-job-modal-btn')) {
                    modalId = 'cari-job-modal';
                    const cariModal = document.getElementById(modalId);
                    if (cariModal) {
                        cariModal.querySelector('form').id = 'add-cari-job-form';
                        document.getElementById('cari-job-modal-title').innerText = "Yeni Borç Kaydı Ekle";
                        document.getElementById('cari-job-company-name').value = openBtn.dataset.companyName;
                    }
                } else if (openBtn.classList.contains('open-cari-expense-modal-btn')) {
                    modalId = 'cari-expense-modal';
                    const cariModal = document.getElementById(modalId);
                    if (cariModal) {
                        cariModal.querySelector('form').id = 'add-cari-expense-form';
                        document.getElementById('cari-expense-modal-title').innerText = "Yeni Ödeme Ekle";
                        document.getElementById('cari-expense-company-name').value = openBtn.dataset.companyName;
                    }
                }

                const modalToOpen = document.getElementById(modalId);
                if (modalToOpen) {
                    modalToOpen.querySelector('form')?.reset();
                    modalToOpen.querySelectorAll('[id$="-other-group"]').forEach(el => el.style.display = 'none');
                    openModal(modalId);
                }
            }

            // MODAL KAPAMA
            if (e.target.matches('.modal-overlay, .close-modal, .close-modal-btn')) {
                const modal = e.target.closest('.modal-overlay');
                if (modal) closeModal(modal.id);
            }

            // EXPORT BUTONLARI
            const exportBtn = e.target.closest('.export-btn');
            if (exportBtn) {
                e.preventDefault();
                
                const exportType = exportBtn.dataset.exportType;
                const targetSelector = exportBtn.dataset.exportTarget;
                
                const targetElement = document.querySelector(targetSelector);
                if (!targetElement) {
                    showNotification('Dışa aktarılacak bölüm bulunamadı', 'error');
                    return;
                }
                
                const pageTitle = targetElement.querySelector('h1')?.innerText || 'Rapor';
                
                const cleanTitle = pageTitle
                    .replace(/[İ]/g, 'I')
                    .replace(/[ı]/g, 'i')
                    .replace(/[Ş]/g, 'S')
                    .replace(/[ş]/g, 's')
                    .replace(/[Ğ]/g, 'G')
                    .replace(/[ğ]/g, 'g')
                    .replace(/[Ü]/g, 'U')
                    .replace(/[ü]/g, 'u')
                    .replace(/[Ö]/g, 'O')
                    .replace(/[ö]/g, 'o')
                    .replace(/[Ç]/g, 'C')
                    .replace(/[ç]/g, 'c')
                    .replace(/\s+/g, '_')
                    .replace(/[^\w\-]/g, '');
                
                const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
                const fileName = `${cleanTitle}_${dateStr}`;
                
                if (exportType === 'pdf') {
                    exportToPdfWithTurkish(targetSelector, fileName);
                } else if (exportType === 'excel') {
                    exportToExcel(targetSelector, fileName);
                } else {
                    showNotification('Bilinmeyen dışa aktarma tipi', 'error');
                }
                
                return;
            }

            // EDIT VE DELETE BUTONLARI
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');

            if (editBtn) {
                e.preventDefault();
                handleEditClick(editBtn.dataset.id, editBtn.dataset.type);
                return;
            }
            
            if (deleteBtn) {
                e.preventDefault();
                handleDeleteClick(deleteBtn.dataset.id, deleteBtn.dataset.type);
                return;
            }
        });

        // Form submit
        document.querySelectorAll('form').forEach(form => form.addEventListener('submit', handleFormSubmit));

        // Filtreler
        ['income-month-filter', 'expense-month-filter', 'expense-method-filter', 'check-partnership-filter'].forEach(id => {
            const filterEl = document.getElementById(id);
            if (filterEl) {
                const renderFunc = id === 'check-partnership-filter' ? renderChecks : filterAndSummarizeDatedItems;
                filterEl.addEventListener('change', renderFunc);
            }
        });

        // "Diğer" seçeneği için listeners
        const setupOtherListener = (prefix, fields) => {
            fields.forEach(field => {
                const select = document.getElementById(`${prefix}-${field}`);
                if (select) select.addEventListener('change', () => {
                    const otherGroup = document.getElementById(`${prefix}-${field}-other-group`);
                    if (otherGroup) otherGroup.style.display = select.value === 'Diğer' ? 'block' : 'none';
                });
            });
        };
        setupOtherListener('job', ['customer', 'company']);
        setupOtherListener('edit-job', ['customer', 'company']);
        setupOtherListener('expense', ['category']);
        setupOtherListener('edit-expense', ['category']);
        setupOtherListener('income', ['category']);
        setupOtherListener('edit-income', ['category']);
        setupOtherListener('check', ['partnership-category']);
        setupOtherListener('edit-check', ['partnership-category']);

        // Sorumluluk payı listeners
        const setupResponsibilityListener = (prefix) => {
            const select = document.getElementById(`${prefix}-responsible-party`);
            if (select) {
                select.addEventListener('change', () => {
                    const shareGroup = document.getElementById(`${prefix}-share-group`);
                    if (shareGroup) shareGroup.style.display = select.value === 'partnership' ? 'block' : 'none';
                });
            }
        };
        setupResponsibilityListener('check');
        setupResponsibilityListener('edit-check');

        // Toplam nakit düzenleme - Sadece eksi hesaplarda borç yoksa
        const cashValueEl = document.getElementById('total-cash-value');
        cashValueEl?.addEventListener('click', () => {
            // Eksi Hesaplar toplam borcunu kontrol et
            const totalOverdraftDebt = (db.overdrafts || []).reduce((sum, od) => sum + (od.debt || 0), 0);
            
            // Eğer borç varsa düzenlemeye izin verme
            if (totalOverdraftDebt > 0) {
                showNotification('Eksi Hesaplarda borç varken manuel düzenleme yapılamaz', 'warning');
                return;
            }
            
            if (cashValueEl.querySelector('input')) return;
            const currentVal = db.totalCash;
            cashValueEl.innerHTML = `<input type="number" step="0.01" value="${currentVal.toFixed(2)}" />`;
            const input = cashValueEl.querySelector('input');
            input.focus();
            const saveCash = () => {
                db.totalCash = parseFloat(input.value) || 0;
                saveData();
                renderAll();
            };
            input.addEventListener('blur', saveCash);
            input.addEventListener('keypress', e => { if (e.key === 'Enter') input.blur(); });
        });

        // Collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.collapsible-section')?.classList.toggle('collapsed');
            });
        });

        // Mobile hamburger menu
        setupMobileMenu();
    };

    // =======================================
    // --- MOBİLE MENU SETUP ---
    // =======================================
    const setupMobileMenu = () => {
        if (window.innerWidth <= 768 && !document.querySelector('.hamburger-menu')) {
            const hamburger = document.createElement('button');
            hamburger.className = 'hamburger-menu';
            hamburger.innerHTML = '<span></span><span></span><span></span>';
            document.body.insertBefore(hamburger, document.body.firstChild);

            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);

            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                document.querySelector('.sidebar')?.classList.toggle('open');
                overlay.classList.toggle('show');
            });

            overlay.addEventListener('click', () => {
                hamburger.classList.remove('active');
                document.querySelector('.sidebar')?.classList.remove('open');
                overlay.classList.remove('show');
            });

            document.querySelector('.sidebar-nav')?.addEventListener('click', (e) => {
                if (e.target.closest('a.nav-link') && !e.target.closest('.has-submenu')) {
                    setTimeout(() => {
                        hamburger.classList.remove('active');
                        document.querySelector('.sidebar')?.classList.remove('open');
                        overlay.classList.remove('show');
                    }, 300);
                }
            });
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                document.querySelector('.sidebar')?.classList.remove('open');
                document.querySelector('.sidebar-overlay')?.classList.remove('show');
                document.querySelector('.hamburger-menu')?.classList.remove('active');
            }
        });
    };

    // =======================================
    // --- AY FİLTRELERİNİ DOLDUR ---
    // =======================================
    const populateMonthFilters = () => {
        const currentMonth = new Date().getMonth() + 1;
        [document.getElementById('income-month-filter'), document.getElementById('expense-month-filter')].forEach(filter => {
            if (!filter) return;
            const currentSelectedValue = filter.value;
            filter.innerHTML = '<option value="all">Tümü</option>';
            monthNames.forEach((name, index) => { filter.innerHTML += `<option value="${index + 1}">${name}</option>`; });
            filter.value = currentSelectedValue === 'all' ? 'all' : String(currentMonth);
        });
        const methodFilter = document.getElementById('expense-method-filter');
        if (methodFilter) {
            const currentSelectedValue = methodFilter.value;
            methodFilter.innerHTML = '<option value="all">Tümü</option>' + ODEME_SEKILLERI.map(name => `<option value="${name.toLowerCase()}">${name}</option>`).join('');
            methodFilter.value = currentSelectedValue || 'all';
        }
    };

    // =======================================
    // --- OTOMATİK BACKUP SİSTEMİ ---
    // =======================================
    const createBackup = () => {
        try {
            const backup = {
                data: db,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            localStorage.setItem('warda_backup', JSON.stringify(backup));

            const backups = JSON.parse(localStorage.getItem('warda_backups') || '[]');
            backups.unshift(backup);
            if (backups.length > 5) backups.pop();
            localStorage.setItem('warda_backups', JSON.stringify(backups));

            console.log('Backup oluşturuldu:', new Date().toISOString());
        } catch (error) {
            console.error('Backup oluşturma hatası:', error);
        }
    };

    const restoreFromBackup = () => {
        try {
            const backup = localStorage.getItem('warda_backup');
            if (backup) {
                const backupData = JSON.parse(backup);
                if (confirm('Son yedekten geri yüklemek istediğinize emin misiniz?')) {
                    db = backupData.data;
                    saveData();
                    renderAll();
                    showNotification('Veriler yedekten geri yüklendi', 'success');
                }
            } else {
                showNotification('Yedek bulunamadı', 'warning');
            }
        } catch (error) {
            console.error('Geri yükleme hatası:', error);
            showNotification('Geri yükleme sırasında hata oluştu', 'error');
        }
    };

    // Günde bir kez otomatik backup
    setInterval(createBackup, 24 * 60 * 60 * 1000);

    // Sayfa kapatılırken backup
    window.addEventListener('beforeunload', () => {
        createBackup();
    });

    // =======================================
    // --- KEYBOARD SHORTCUTS ---
    // =======================================
    document.addEventListener('keydown', (e) => {
        // Ctrl + S veya Cmd + S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveData();
        }

        // Ctrl + B veya Cmd + B
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            createBackup();
            showNotification('Yedek oluşturuldu', 'success');
        }

        // ESC
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });

    // =======================================
    // --- SAYFA YÜKLENDİĞİNDE ÇALIŞTIR ---
    // =======================================
    setupInitialListeners();
    loadData();

    // İlk backup'ı oluştur
    setTimeout(createBackup, 5000);

    // =======================================
    // --- GLOBAL ERROR HANDLER ---
    // =======================================
    window.addEventListener('error', (e) => {
        console.error('Global hata:', e.error);
        showNotification('Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.', 'error');
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promise hatası:', e.reason);
        showNotification('Bir işlem sırasında hata oluştu. Lütfen tekrar deneyin.', 'error');
    });

    // =======================================
    // --- CONSOLE LOG ---
    // =======================================
    console.log('%c WARDA PANEL ', 'background: #4A90E2; color: white; font-size: 20px; padding: 10px;');
    console.log('%c Sistem başlatıldı ✓', 'color: #2ECC71; font-size: 14px;');
    console.log('%c Versiyon: 3.0 (Temiz Kod)', 'color: #95a5a6; font-size: 12px;');

    // =======================================
    // --- ÖDEME TAKİP FONKSİYONLARI ---
    // =======================================
    
    // Aylık ödeme durumlarını oluştur/güncelle
    const generateMonthlyPayments = (year, month) => {
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        // Bu ay için ödeme durumları zaten var mı kontrol et
        if (!db.monthlyPaymentStatus) db.monthlyPaymentStatus = {};
        if (!db.monthlyPaymentStatus[monthKey]) db.monthlyPaymentStatus[monthKey] = {};
        
        // Tekrarlayan ödemeler için bu ay durumları oluştur
        (db.payments || []).forEach(payment => {
            if (payment.isRecurring) {
                const paymentKey = `payment_${payment.id}`;
                if (!db.monthlyPaymentStatus[monthKey][paymentKey]) {
                    db.monthlyPaymentStatus[monthKey][paymentKey] = {
                        status: 'bekliyor',
                        actualDate: null,
                        paymentMethod: null
                    };
                }
            }
        });
    };
    
    const renderPayments = () => {
        const pendingTableBody = document.getElementById('pending-payments-table-body');
        const completedTableBody = document.getElementById('completed-payments-table-body');
        
        if (!pendingTableBody || !completedTableBody) return;
        
        pendingTableBody.innerHTML = '';
        completedTableBody.innerHTML = '';
        
        // Seçili ay/yıl al
        const selectedMonth = document.getElementById('payment-month-filter')?.value || new Date().getMonth() + 1;
        const selectedYear = document.getElementById('payment-year-filter')?.value || new Date().getFullYear();
        const monthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        
        // Bu ay için ödeme durumları oluştur
        generateMonthlyPayments(selectedYear, selectedMonth);
        
        const monthlyStatus = db.monthlyPaymentStatus?.[monthKey] || {};
        
        // Ödemeleri filtrele ve render et
        (db.payments || []).forEach(payment => {
            const paymentKey = `payment_${payment.id}`;
            const currentStatus = monthlyStatus[paymentKey] || { status: 'bekliyor' };
            
            // Sadece tekrarlayan ödemeler veya seçili aya ait tek seferlik ödemeler
            if (!payment.isRecurring && payment.specificMonth !== monthKey) return;
            
            const dayText = payment.day === 'son-gun' ? 'Son Gün' : payment.day;
            const currentDate = new Date();
            const paymentDate = payment.day === 'son-gun' 
                ? new Date(selectedYear, selectedMonth, 0).getDate() 
                : parseInt(payment.day);
            
            const isOverdue = currentDate.getDate() > paymentDate && 
                            currentDate.getMonth() + 1 == selectedMonth && 
                            currentDate.getFullYear() == selectedYear &&
                            currentStatus.status === 'bekliyor';
            
            const statusClass = currentStatus.status === 'tamamlandı' ? 'income' : (isOverdue ? 'expense' : 'checks');
            const statusText = currentStatus.status === 'tamamlandı' ? 'ÖDENDİ' : (isOverdue ? 'GECİKTİ' : 'BEKLİYOR');
            const statusIcon = currentStatus.status === 'tamamlandı' ? 'fas fa-check-circle' : (isOverdue ? 'fas fa-exclamation-triangle' : 'fas fa-clock');
            
            const rowHTML = `
                <td>${dayText}</td>
                <td>${payment.recipient}</td>
                <td>${payment.category}</td>
                <td class="text-right">${formatCurrency(payment.amount)}</td>
                <td style="text-align: center;"><span class="status status-${statusClass}"><i class="${statusIcon}"></i>${statusText}</span></td>
                <td class="actions-cell">
                    <button class="btn-icon btn-complete" data-id="${payment.id}" data-month="${monthKey}" title="Ödemeyi Tamamla" style="color: #27ae60;"><i class="fas fa-check-circle"></i></button>
                    <button class="btn-icon btn-edit" data-id="${payment.id}" data-type="payment" data-month="${monthKey}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon btn-delete" data-id="${payment.id}" data-type="payment"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            
            if (currentStatus.status === 'tamamlandı') {
                const completedRowHTML = `
                    <td>${dayText}</td>
                    <td>${payment.recipient}</td>
                    <td>${payment.category}</td>
                    <td class="text-right">${formatCurrency(payment.amount)}</td>
                    <td style="text-align: center;"><span class="status status-income"><i class="fas fa-check-circle"></i>TAMAMLANDI</span></td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-id="${payment.id}" data-type="payment" data-month="${monthKey}"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon btn-delete" data-id="${payment.id}" data-type="payment"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                completedTableBody.innerHTML += `<tr data-id="${payment.id}">${completedRowHTML}</tr>`;
            } else {
                pendingTableBody.innerHTML += `<tr data-id="${payment.id}">${rowHTML}</tr>`;
            }
        });
        
        updatePaymentSummary();
    };
    
    const updatePaymentSummary = () => {
        const selectedMonth = document.getElementById('payment-month-filter')?.value || new Date().getMonth() + 1;
        const selectedYear = document.getElementById('payment-year-filter')?.value || new Date().getFullYear();
        const monthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        
        const monthlyStatus = db.monthlyPaymentStatus?.[monthKey] || {};
        const payments = db.payments || [];
        
        let pendingCount = 0;
        let overdueCount = 0;
        let completedCount = 0;
        let monthlyTotal = 0;
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        payments.forEach(payment => {
            // Sadece bu aya ait ödemeleri say
            if (!payment.isRecurring && payment.specificMonth !== monthKey) return;
            if (payment.isRecurring || payment.specificMonth === monthKey) {
                const paymentKey = `payment_${payment.id}`;
                const status = monthlyStatus[paymentKey]?.status || 'bekliyor';
                
                monthlyTotal += payment.amount || 0;
                
                if (status === 'tamamlandı') {
                    completedCount++;
                } else {
                    pendingCount++;
                    
                    // Gecikme kontrolü (sadece mevcut ay için)
                    if (selectedMonth == currentMonth && selectedYear == currentYear) {
                        const paymentDay = payment.day === 'son-gun' 
                            ? new Date(currentYear, currentMonth, 0).getDate()
                            : parseInt(payment.day);
                        
                        if (currentDate.getDate() > paymentDay) {
                            overdueCount++;
                        }
                    }
                }
            }
        });
        
        document.getElementById('pending-payments-count').textContent = pendingCount;
        document.getElementById('overdue-payments-count').textContent = overdueCount;
        document.getElementById('completed-payments-count').textContent = completedCount;
        document.getElementById('monthly-total-payments').textContent = formatCurrency(monthlyTotal);
    };
    
    // Ay/yıl filtrelerini doldur
    const populatePaymentFilters = () => {
        const monthFilter = document.getElementById('payment-month-filter');
        const yearFilter = document.getElementById('payment-year-filter');
        
        if (monthFilter) {
            const currentMonth = new Date().getMonth() + 1;
            monthFilter.innerHTML = monthNames.map((name, index) => 
                `<option value="${index + 1}" ${index + 1 === currentMonth ? 'selected' : ''}>${name}</option>`
            ).join('');
        }
        
        if (yearFilter) {
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let year = currentYear - 2; year <= currentYear + 2; year++) {
                years.push(`<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`);
            }
            yearFilter.innerHTML = years.join('');
        }
    };
    
    // =======================================
    // --- PROJE TAKİP FONKSİYONLARI ---
    // =======================================
    const renderProjects = () => {
        const devamEdiyorBody = document.getElementById('devam-ediyor-table-body');
        const ihaleBody = document.getElementById('ihale-table-body');
        const projeBody = document.getElementById('proje-table-body');
        const gorusmeBody = document.getElementById('gorusme-table-body');
        const tamamlandiBody = document.getElementById('tamamlandi-table-body');
        const iptalBody = document.getElementById('iptal-table-body');
        
        if (!devamEdiyorBody || !ihaleBody || !projeBody || !gorusmeBody || !tamamlandiBody || !iptalBody) return;
        
        devamEdiyorBody.innerHTML = '';
        ihaleBody.innerHTML = '';
        projeBody.innerHTML = '';
        gorusmeBody.innerHTML = '';
        tamamlandiBody.innerHTML = '';
        iptalBody.innerHTML = '';
        
        const devamEdiyorProjects = (db.projects || []).filter(p => p.status === 'devam-ediyor');
        const ihaleProjects = (db.projects || []).filter(p => p.status === 'ihale');
        const projeProjects = (db.projects || []).filter(p => p.status === 'proje');
        const gorusmeProjects = (db.projects || []).filter(p => p.status === 'gorusme');
        const tamamlandiProjects = (db.projects || []).filter(p => p.status === 'tamamlandi');
        const iptalProjects = (db.projects || []).filter(p => p.status === 'iptal');
        
        // Tüm projeleri render et
        const allProjects = [
            ...devamEdiyorProjects,
            ...ihaleProjects,
            ...projeProjects,
            ...gorusmeProjects,
            ...tamamlandiProjects,
            ...iptalProjects
        ];
        
        allProjects.forEach(project => {
            const statusInfo = {
                'devam-ediyor': { class: 'checks', text: 'Devam Ediyor', icon: 'fas fa-cogs' },
                'ihale': { class: 'checks', text: 'İhale Aşamasında', icon: 'fas fa-gavel', color: '#e67e22' },
                'proje': { class: 'info', text: 'Proje Aşamasında', icon: 'fas fa-project-diagram', color: '#3498db' },
                'gorusme': { class: 'info', text: 'Görüşme Aşamasında', icon: 'fas fa-comments', color: '#1abc9c' },
                'tamamlandi': { class: 'income', text: 'Tamamlandı', icon: 'fas fa-check-circle' },
                'iptal': { class: 'expense', text: 'İptal Edildi', icon: 'fas fa-times-circle' }
            };
            
            const status = statusInfo[project.status] || { class: 'info', text: project.status, icon: 'fas fa-circle' };
            const statusStyle = status.color ? `style="background-color: ${status.color};"` : '';
            const statusClass = status.class;
            
            const rowHTML = `
                <td>${project.name}</td>
                <td>${project.customer}</td>
                <td style="text-align: center;"><span class="status status-${statusClass}" ${statusStyle}><i class="${status.icon}"></i>${status.text}</span></td>
                <td style="text-align: center;">
                    <button class="btn-icon btn-edit" data-id="${project.id}" data-type="project"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon btn-delete" data-id="${project.id}" data-type="project"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            
            // Duruma göre ilgili tabloya ekle
            const tableBodyMap = {
                'devam-ediyor': devamEdiyorBody,
                'ihale': ihaleBody,
                'proje': projeBody,
                'gorusme': gorusmeBody,
                'tamamlandi': tamamlandiBody,
                'iptal': iptalBody
            };
            
            const targetBody = tableBodyMap[project.status];
            if (targetBody) {
                targetBody.innerHTML += `<tr data-id="${project.id}">${rowHTML}</tr>`;
            }
        });
        
        updateProjectSummary();
    };
    
    const updateProjectSummary = () => {
        const projects = db.projects || [];
        const devamEdiyorCount = projects.filter(p => p.status === 'devam-ediyor').length;
        const ihaleCount = projects.filter(p => p.status === 'ihale').length;
        const projeCount = projects.filter(p => p.status === 'proje').length;
        const gorusmeCount = projects.filter(p => p.status === 'gorusme').length;
        const tamamlandiCount = projects.filter(p => p.status === 'tamamlandi').length;
        const iptalCount = projects.filter(p => p.status === 'iptal').length;
        
        document.getElementById('devam-ediyor-count').textContent = devamEdiyorCount;
        document.getElementById('ihale-count').textContent = ihaleCount;
        document.getElementById('proje-count').textContent = projeCount;
        document.getElementById('gorusme-count').textContent = gorusmeCount;
        document.getElementById('tamamlandi-count').textContent = tamamlandiCount;
        document.getElementById('iptal-count').textContent = iptalCount;
    };
    
    // =======================================
    // --- YENİ MODAL EVENT LISTENERS ---
    // =======================================
    
    // Filtreleri doldur
    populatePaymentFilters();
    
    // Filtre değişiklik event listeners
    document.getElementById('payment-month-filter')?.addEventListener('change', renderPayments);
    document.getElementById('payment-year-filter')?.addEventListener('change', renderPayments);
    
    // Ödeme modal event listeners
    document.getElementById('open-payment-modal-btn')?.addEventListener('click', () => {
        document.getElementById('add-payment-modal').classList.add('open');
    });
    
    document.getElementById('add-payment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            id: generateId(),
            day: document.getElementById('payment-day').value,
            recipient: document.getElementById('payment-recipient').value,
            description: '', // Açıklama kaldırıldı, boş string olarak saklanıyor
            category: document.getElementById('payment-category').value,
            amount: parseFloat(document.getElementById('payment-amount').value),
            isRecurring: document.getElementById('payment-is-recurring').value === 'true'
        };
        
        // Tek seferlik ödeme ise hangi aya ait olduğunu belirt
        if (!formData.isRecurring) {
            const selectedMonth = document.getElementById('payment-month-filter')?.value || new Date().getMonth() + 1;
            const selectedYear = document.getElementById('payment-year-filter')?.value || new Date().getFullYear();
            formData.specificMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        }
        
        if (validateForm(formData, 'payment')) {
            db.payments.push(formData);
            await saveData();
            renderPayments();
            document.getElementById('add-payment-modal').classList.remove('open');
            document.getElementById('add-payment-form').reset();
            showNotification('Ödeme başarıyla eklendi', 'success');
        }
    });
    
    // Proje modal event listeners
    document.getElementById('open-project-modal-btn')?.addEventListener('click', () => {
        document.getElementById('add-project-modal').classList.add('open');
        // Başlangıç tarihi alanı kaldırıldı
    });
    
    document.getElementById('add-project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            id: generateId(),
            name: document.getElementById('project-name').value,
            customer: document.getElementById('project-customer').value,
            startDate: '', // Başlangıç tarihi kaldırıldı
            endDate: '', // Bitiş tarihi kaldırıldı
            status: document.getElementById('project-status').value,
            progress: 0, // İlerleme kaldırıldı, varsayılan 0
            budget: 0, // Bütçe kaldırıldı, varsayılan 0
            responsible: '', // Sorumlu kaldırıldı
            description: document.getElementById('project-description').value
        };
        
        if (validateForm(formData, 'project')) {
            db.projects.push(formData);
            await saveData();
            renderProjects();
            document.getElementById('add-project-modal').classList.remove('open');
            document.getElementById('add-project-form').reset();
            showNotification('Proje başarıyla eklendi', 'success');
        }
    });
    
    // Ödeme durumu değiştiğinde ödeme şekli alanını göster/gizle
    document.getElementById('payment-status')?.addEventListener('change', (e) => {
        const methodGroup = document.getElementById('payment-method-group');
        if (e.target.value === 'tamamlandı') {
            methodGroup.style.display = 'block';
        } else {
            methodGroup.style.display = 'none';
        }
    });
    
    // Ödeme şekli ve tarih alanları kaldırıldı, event listener'a gerek yok
    
    // Proje düzenleme butonu event listener
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit') && e.target.closest('.btn-edit').getAttribute('data-type') === 'project') {
            const button = e.target.closest('.btn-edit');
            const projectId = button.getAttribute('data-id');
            
            const project = db.projects.find(p => p.id === projectId);
            if (!project) return;
            
            // Modal'ı doldur
            document.getElementById('edit-project-id').value = projectId;
            document.getElementById('edit-project-name').value = project.name;
            document.getElementById('edit-project-customer').value = project.customer;
            document.getElementById('edit-project-status').value = project.status;
            document.getElementById('edit-project-description').value = project.description || '';
            
            // Modal'ı aç
            document.getElementById('edit-project-modal').classList.add('open');
        }
    });
    
    // Proje düzenleme form submit
    document.getElementById('edit-project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const projectId = document.getElementById('edit-project-id').value;
        const projectIndex = db.projects.findIndex(p => p.id === projectId);
        
        if (projectIndex !== -1) {
            db.projects[projectIndex] = {
                ...db.projects[projectIndex],
                name: document.getElementById('edit-project-name').value,
                customer: document.getElementById('edit-project-customer').value,
                status: document.getElementById('edit-project-status').value,
                description: document.getElementById('edit-project-description').value
            };
            
            await saveData();
            renderProjects();
            document.getElementById('edit-project-modal').classList.remove('open');
            showNotification('Proje başarıyla güncellendi', 'success');
        }
    });
    
    // Ödeme tamamla butonu event listener
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-complete')) {
            const button = e.target.closest('.btn-complete');
            const paymentId = button.getAttribute('data-id');
            const monthKey = button.getAttribute('data-month');
            
            // Direkt tamamla - modal açma
            if (!db.monthlyPaymentStatus) db.monthlyPaymentStatus = {};
            if (!db.monthlyPaymentStatus[monthKey]) db.monthlyPaymentStatus[monthKey] = {};
            
            const paymentKey = `payment_${paymentId}`;
            db.monthlyPaymentStatus[monthKey][paymentKey] = {
                status: 'tamamlandı',
                actualDate: new Date().toISOString().split('T')[0],
                paymentMethod: null
            };
            
            await saveData();
            renderPayments();
            showNotification('Ödeme başarıyla tamamlandı', 'success');
        }
    });
    
    // Ödeme tamamlama form submit
    document.getElementById('complete-payment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const paymentId = document.getElementById('complete-payment-id').value;
        const monthKey = document.getElementById('complete-payment-month').value;
        const paymentMethod = document.getElementById('complete-payment-method').value;
        const actualDate = document.getElementById('complete-payment-date').value;
        
        if (!paymentMethod) {
            showNotification('Lütfen ödeme şeklini seçin', 'error');
            return;
        }
        
        // Aylık durumu güncelle
        if (!db.monthlyPaymentStatus) db.monthlyPaymentStatus = {};
        if (!db.monthlyPaymentStatus[monthKey]) db.monthlyPaymentStatus[monthKey] = {};
        
        const paymentKey = `payment_${paymentId}`;
        db.monthlyPaymentStatus[monthKey][paymentKey] = {
            status: 'tamamlandı',
            actualDate: actualDate,
            paymentMethod: paymentMethod
        };
        
        await saveData();
        renderPayments();
        document.getElementById('complete-payment-modal').classList.remove('open');
        document.getElementById('complete-payment-form').reset();
        showNotification('Ödeme başarıyla tamamlandı olarak işaretlendi', 'success');
    });
    
    // Ödeme düzenleme butonları için event listener
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit') && e.target.closest('.btn-edit').getAttribute('data-type') === 'payment') {
            const button = e.target.closest('.btn-edit');
            const paymentId = button.getAttribute('data-id');
            const monthKey = button.getAttribute('data-month');
            
            // Ödeme bilgilerini bul
            const payment = db.payments.find(p => p.id === paymentId);
            if (!payment) return;
            
            // Modal'ı doldur
            document.getElementById('edit-payment-id').value = paymentId;
            document.getElementById('edit-payment-day').value = payment.day;
            document.getElementById('edit-payment-recipient').value = payment.recipient;
            // Açıklama alanı kaldırıldı
            document.getElementById('edit-payment-category').value = payment.category;
            document.getElementById('edit-payment-amount').value = payment.amount;
            document.getElementById('edit-payment-is-recurring').value = payment.isRecurring ? 'true' : 'false';
            
            // Aylık durum bilgilerini al
            const monthlyStatus = db.monthlyPaymentStatus?.[monthKey]?.[`payment_${paymentId}`];
            if (monthlyStatus) {
                document.getElementById('edit-payment-status').value = monthlyStatus.status;
                // Ödeme şekli ve tarih alanları kaldırıldı
            }
            
            // Modal'ı aç
            document.getElementById('edit-payment-modal').classList.add('open');
        }
    });
    
    // Ödeme düzenleme form submit
    document.getElementById('edit-payment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const paymentId = document.getElementById('edit-payment-id').value;
        const selectedMonth = document.getElementById('payment-month-filter')?.value || new Date().getMonth() + 1;
        const selectedYear = document.getElementById('payment-year-filter')?.value || new Date().getFullYear();
        const monthKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        
        // Ödeme bilgilerini güncelle
        const paymentIndex = db.payments.findIndex(p => p.id === paymentId);
        if (paymentIndex !== -1) {
            db.payments[paymentIndex] = {
                ...db.payments[paymentIndex],
                day: document.getElementById('edit-payment-day').value,
                recipient: document.getElementById('edit-payment-recipient').value,
                description: '', // Açıklama kaldırıldı, boş string olarak saklanıyor
                category: document.getElementById('edit-payment-category').value,
                amount: parseFloat(document.getElementById('edit-payment-amount').value),
                isRecurring: document.getElementById('edit-payment-is-recurring').value === 'true'
            };
        }
        
        // Aylık durum bilgilerini güncelle
        if (!db.monthlyPaymentStatus) db.monthlyPaymentStatus = {};
        if (!db.monthlyPaymentStatus[monthKey]) db.monthlyPaymentStatus[monthKey] = {};
        
        const paymentKey = `payment_${paymentId}`;
        const status = document.getElementById('edit-payment-status').value;
        
        db.monthlyPaymentStatus[monthKey][paymentKey] = {
            status: status,
            actualDate: status === 'tamamlandı' ? new Date().toISOString().split('T')[0] : null,
            paymentMethod: null // Ödeme şekli alanı kaldırıldı
        };
        
        await saveData();
        renderPayments();
        document.getElementById('edit-payment-modal').classList.remove('open');
        showNotification('Ödeme başarıyla güncellendi', 'success');
    });

    // =======================================
    // --- NOTLAR YÖNETİMİ ---
    // =======================================
    
    const renderNotes = () => {
        const container = document.getElementById('notes-container');
        
        // Her zaman 10 satır göster
        if (!db.notes) db.notes = [];
        
        // 10 satıra tamamla
        while (db.notes.length < 10) {
            db.notes.push({
                id: `note-${db.notes.length}`,
                text: '',
                createdAt: new Date().toISOString()
            });
        }
        
        // Sadece ilk 10 satırı göster
        const displayNotes = db.notes.slice(0, 10);
        
        container.innerHTML = displayNotes.map((note, index) => `
            <div class="note-row" data-index="${index}" style="background: #fef3c7; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; transition: all 0.2s; cursor: text; border: 2px solid transparent;">
                <div style="color: #94a3b8; font-weight: 600; font-size: 12px; min-width: 18px;">${index + 1}.</div>
                <input type="text" 
                       class="note-input" 
                       data-index="${index}"
                       value="${note.text || ''}" 
                       placeholder="Tıklayın, yazın, Enter'a basın..."
                       style="flex: 1; border: none; background: transparent; padding: 0; font-size: 13px; color: #1e293b; outline: none;">
            </div>
        `).join('');
        
        // Input event listeners
        document.querySelectorAll('.note-input').forEach(input => {
            // Enter tuşu ile kaydet
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const index = parseInt(e.target.dataset.index);
                    db.notes[index].text = e.target.value;
                    db.notes[index].updatedAt = new Date().toISOString();
                    await saveData();
                    e.target.blur();
                    showNotification('Not kaydedildi', 'success');
                }
            });
            
            // Focus ve blur efektleri
            input.addEventListener('focus', function() {
                this.closest('.note-row').style.borderColor = '#f39c12';
                this.closest('.note-row').style.background = '#fef9e7';
            });
            
            input.addEventListener('blur', function() {
                this.closest('.note-row').style.borderColor = 'transparent';
                this.closest('.note-row').style.background = '#fef3c7';
            });
        });
        
        // Satır hover efekti
        document.querySelectorAll('.note-row').forEach(row => {
            row.addEventListener('mouseenter', function() {
                if (!this.querySelector('input:focus')) {
                    this.style.background = '#fef9e7';
                }
            });
            row.addEventListener('mouseleave', function() {
                if (!this.querySelector('input:focus')) {
                    this.style.background = '#fef3c7';
                }
            });
            
            // Satıra tıklayınca input'a focus
            row.addEventListener('click', function(e) {
                if (e.target.tagName !== 'INPUT') {
                    this.querySelector('input').focus();
                }
            });
        });
    };

    // Export fonksiyonlarını global scope'a ekle
    window.exportToPdfWithTurkish = exportToPdfWithTurkish;
    window.exportToExcel = exportToExcel;
    window.restoreFromBackup = restoreFromBackup;
});

// =======================================
// --- DOSYA SONU ---
// =======================================