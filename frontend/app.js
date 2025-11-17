// API Configuration - loaded from config.js
const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:3000/dev';

// State
let selectedPackage = null;
let currentTransaction = null;
let paymentCheckInterval = null;
let paymentPollAttempts = 0;
let manualQueryPerformed = false;
let lastUsedPhoneNumber = null;

// Get device info
function getDeviceInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        macAddress: urlParams.get('mac') || 'unknown',
        ipAddress: urlParams.get('ip') || 'unknown',
        gatewayId: urlParams.get('gateway') || 'default',
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPackages();
    checkExistingSession();
});

// Screen Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Load Available Packages
async function loadPackages() {
    try {
        const response = await fetch(`${API_BASE_URL}/payment/packages`);
        const result = await response.json();
        
        if (result.success) {
            displayPackages(result.data.packages);
        }
    } catch (error) {
        console.error('Failed to load packages:', error);
        showToast('Failed to load packages. Please refresh.', 'error');
    }
}

// Display Packages
function displayPackages(packages) {
    const grid = document.getElementById('packagesGrid');
    grid.innerHTML = '';
    
    packages.forEach(pkg => {
        const card = document.createElement('div');
        card.className = 'package-card';
        card.tabIndex = 0;
        card.onclick = (e) => selectPackage(pkg, e);
        card.onkeyup = (e) => { if (e.key === 'Enter' || e.key === ' ') { selectPackage(pkg, e); } };        
        
        const isPopular = pkg.name === 'Standard';
        
        card.innerHTML = `
            ${isPopular ? '<div class="package-badge">POPULAR</div>' : ''}
            <div class="package-name">${pkg.name}</div>
            <div class="package-details">
                <span>⏱️ ${formatHours(pkg.durationHours)}</span>
                <span>🚀 ${pkg.bandwidthMbps} Mbps</span>
            </div>
            <div class="package-price">KES ${pkg.priceKES}</div>
            <div class="package-description">${pkg.description || 'Unlimited data at ' + pkg.bandwidthMbps + ' Mbps'}</div>
        `;
        
        grid.appendChild(card);
    });
}

// Select Package
function selectPackage(pkg, e) {
    selectedPackage = pkg;
    // Clear selections
    document.querySelectorAll('.package-card').forEach(card => card.classList.remove('selected'));
    const targetCard = e.target.closest('.package-card');
    if (targetCard) targetCard.classList.add('selected');
    // Reveal payment form
    const form = document.getElementById('paymentForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Initiate M-Pesa Payment
async function initiatePayment() {
    const phoneInput = document.getElementById('phoneNumber');
    const phoneNumber = phoneInput.value.trim();
    lastUsedPhoneNumber = phoneNumber;
    const payBtn = document.getElementById('payButton');

    if (!phoneNumber) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    if (!selectedPackage) {
        showToast('Please select a package', 'error');
        return;
    }

    // Set loading state
    setButtonLoading(payBtn, 'Sending STK...');

    const deviceInfo = getDeviceInfo();
    try {
        const response = await fetch(`${API_BASE_URL}/payment/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber,
                packageId: selectedPackage.packageId,
                ...deviceInfo,
            }),
        });
        const result = await response.json();
        if (result.success) {
            currentTransaction = result.data;
            document.getElementById('processingPhone').textContent = formatPhoneNumber(phoneNumber);
            showScreen('processingScreen');
            updateProcessingStep(0); // first step active
            startPaymentStatusCheck();
        } else {
            showToast(result.error || 'Payment initiation failed', 'error');
            clearButtonLoading(payBtn);
        }
    } catch (err) {
        console.error('Payment error:', err);
        showToast('Payment failed. Please try again.', 'error');
        clearButtonLoading(payBtn);
    }
}

// Check Payment Status (with fallback + limits)
async function checkPaymentStatus() {
    if (!currentTransaction) return;
    paymentPollAttempts++;
    try {
        const response = await fetch(`${API_BASE_URL}/payment/status?transactionId=${currentTransaction.transactionId}`);
        const result = await response.json();
        if (!result.success) return; // transient API issue
        const status = result.data.status;

        if (status === 'pending') {
            updateProcessingStep(0);
        } else if (status === 'completed') {
            updateProcessingStep(2);
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            await fetchAndShowSuccess();
            return;
        } else if (status === 'failed') {
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            showToast('Payment failed. Please try again.', 'error');
            showScreen('packagesScreen');
            return;
        } else if (status === 'cancelled') {
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            showToast('Payment cancelled.', 'warning');
            showScreen('packagesScreen');
            return;
        }

        // Manual query fallback after 5 polls if still pending
        if (status === 'pending' && paymentPollAttempts === 5 && !manualQueryPerformed) {
            await manualQueryPayment();
        }

        // Hard timeout ~3 min (60 attempts at 3s)
        if (paymentPollAttempts >= 60) {
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            showToast('No confirmation received. Please retry payment.', 'warning');
            showScreen('packagesScreen');
        }
    } catch (err) {
        console.error('Status check error:', err);
    }
}

function startPaymentStatusCheck() {
    paymentPollAttempts = 0;
    manualQueryPerformed = false;
    paymentCheckInterval = setInterval(checkPaymentStatus, 3000);
}

function stopPaymentStatusCheck() {
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
}

function cancelPayment() {
    stopPaymentStatusCheck();
    showScreen('packagesScreen');
    showToast('Payment cancelled', 'warning');
    clearButtonLoading(document.getElementById('payButton'));
}

// Redeem Voucher
async function redeemVoucher() {
    const voucherInput = document.getElementById('voucherCode');
    const voucherCode = voucherInput.value.trim().toUpperCase();
    
    if (!voucherCode) {
        showToast('Please enter a voucher code', 'error');
        return;
    }
    
    const deviceInfo = getDeviceInfo();
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/voucher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voucherCode,
                ...deviceInfo,
            }),
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('sessionId', result.data.sessionId);
            showSuccessScreen(result.data);
        } else {
            showToast(result.error || 'Invalid voucher code', 'error');
        }
    } catch (error) {
        console.error('Voucher error:', error);
        showToast('Voucher redemption failed', 'error');
    }
}

// Login
async function login() {
    const phoneInput = document.getElementById('loginPhone');
    const passwordInput = document.getElementById('loginPassword');
    
    const phoneNumber = phoneInput.value.trim();
    lastUsedPhoneNumber = phoneNumber;
    const password = passwordInput.value;
    
    if (!phoneNumber) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    
    const deviceInfo = getDeviceInfo();
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber,
                password,
                ...deviceInfo,
            }),
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('sessionId', result.data.sessionId);
            showSuccessScreen(result.data);
        } else {
            if (result.error === 'No active balance') {
                showToast('No active balance. Please purchase a package.', 'error');
                setTimeout(() => showScreen('packagesScreen'), 2000);
            } else {
                showToast(result.error || 'Login failed', 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
}

// Show Success Screen
function showSuccessScreen(data) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.innerHTML = '<span class="status-dot connected"></span><span>Connected</span>';

    const timeRemaining = data.timeRemaining || 0;
    const bandwidthMbps = data.bandwidthMbps || 0;
    const packageName = data.packageName || data.package || 'Unknown';

    document.getElementById('packageInfo').textContent = packageName;
    document.getElementById('timeBalance').textContent = formatTime(timeRemaining);
    document.getElementById('dataBalance').textContent = bandwidthMbps + ' Mbps';

    startCountdownTimer(timeRemaining);
    showScreen('successScreen');
}

// Check Existing Session
async function checkExistingSession() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;
    try {
        const response = await fetch(`${API_BASE_URL}/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        });
        const result = await response.json();
        if (result.success && result.data.valid) {
            showSuccessScreen(result.data);
        } else {
            localStorage.removeItem('sessionId');
        }
    } catch (err) {
        console.error('Session check error:', err);
    }
}

// Close Portal and Start Browsing
function closePortal() {
  window.close();
  setTimeout(() => { window.location.href = 'about:blank'; }, 500);
}

// Utility Functions
function formatPhoneNumber(phone) {
  phone = phone.replace(/\s/g, '');
  if (phone.startsWith('0')) return '254' + phone.substring(1);
  if (!phone.startsWith('254')) return '254' + phone;
  return phone;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hr${hours > 1 ? 's' : ''}`;
    } else {
        return `${minutes} min`;
    }
}

function updateProcessingStep(activeIndex) {
    const steps = document.querySelectorAll('.processing-steps .step');
    steps.forEach((step, idx) => {
        if (idx <= activeIndex) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

function setButtonLoading(btn, loadingText) {
    if (!btn || btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
    const labelSpan = btn.querySelector('.btn-label');
    if (labelSpan) {
        labelSpan.dataset.original = labelSpan.textContent;
        labelSpan.textContent = loadingText;
    }
    const spinner = document.createElement('span');
    spinner.className = 'spinner-inline';
    spinner.setAttribute('aria-hidden', 'true');
    btn.insertBefore(spinner, btn.firstChild);
}

function clearButtonLoading(btn) {
    if (!btn) return;
    btn.classList.remove('loading');
    btn.setAttribute('aria-busy', 'false');
    btn.disabled = false;
    const labelSpan = btn.querySelector('.btn-label');
    const spinner = btn.querySelector('.spinner-inline');
    if (spinner) spinner.remove();
    if (labelSpan && labelSpan.dataset.original) {
        labelSpan.textContent = labelSpan.dataset.original;
    }
}

// Manual query fallback to /payment/query
async function manualQueryPayment() {
    manualQueryPerformed = true;
    try {
        const response = await fetch(`${API_BASE_URL}/payment/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                checkoutRequestID: currentTransaction.checkoutRequestID,
                transactionId: currentTransaction.transactionId
            })
        });
        const result = await response.json();
        if (!result.success) return;
        const status = result.data.status;
        if (status === 'completed') {
            updateProcessingStep(2);
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            await fetchAndShowSuccess();
        } else if (status === 'cancelled') {
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            showToast('Payment cancelled.', 'warning');
            showScreen('packagesScreen');
        } else if (status === 'failed') {
            stopPaymentStatusCheck();
            clearButtonLoading(document.getElementById('payButton'));
            showToast('Payment failed. Please try again.', 'error');
            showScreen('packagesScreen');
        }
    } catch (err) {
        console.error('Manual query error:', err);
    }
}

// Fetch session details (if created) then show success screen
async function fetchAndShowSuccess() {
    try {
        let sessionData = null;
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
            const resp = await fetch(`${API_BASE_URL}/auth/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const validateResult = await resp.json();
            if (validateResult.success && validateResult.data.valid) {
                sessionData = validateResult.data;
            }
        }
        // If we still don't have a session object, query by MAC address (device-specific)
        if (!sessionData) {
            const deviceInfo = getDeviceInfo();
            const statusResp = await fetch(`${API_BASE_URL}/auth/status?macAddress=${encodeURIComponent(deviceInfo.macAddress)}`);
            const statusResult = await statusResp.json();
            if (statusResult.success && statusResult.data.activeSessions > 0) {
                const active = statusResult.data.sessions[0];
                localStorage.setItem('sessionId', active.sessionId);
                // Re-run validate to get consistent payload
                const validateResp = await fetch(`${API_BASE_URL}/auth/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: active.sessionId })
                });
                const validateData = await validateResp.json();
                if (validateData.success && validateData.data.valid) {
                    sessionData = validateData.data;
                } else {
                    // Fallback synthetic sessionData
                    sessionData = {
                        packageName: active.packageName,
                        bandwidthMbps: active.bandwidthMbps || selectedPackage?.bandwidthMbps || 0,
                        timeRemaining: active.timeRemaining,
                    };
                }
            }
        }
        if (!sessionData) {
            // short delay and second attempt in case session just created
            await new Promise(r => setTimeout(r, 800));
            const retrySessionId = localStorage.getItem('sessionId');
            if (retrySessionId) {
                const resp2 = await fetch(`${API_BASE_URL}/auth/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: retrySessionId })
                });
                const validateResult2 = await resp2.json();
                if (validateResult2.success && validateResult2.data.valid) {
                    sessionData = validateResult2.data;
                }
            }
        }
        const displayData = {
            packageName: sessionData?.packageName || selectedPackage?.name || 'Package',
            bandwidthMbps: sessionData?.bandwidthMbps || selectedPackage?.bandwidthMbps || 0,
            timeRemaining: sessionData?.timeRemaining || (selectedPackage?.durationHours ? selectedPackage.durationHours * 3600 : 0)
        };
        showSuccessScreen(displayData);
    } catch (err) {
        console.error('Fetch session details error:', err);
        showSuccessScreen({
            packageName: selectedPackage?.name || 'Package',
            bandwidthMbps: selectedPackage?.bandwidthMbps || 0,
            timeRemaining: selectedPackage?.durationHours ? selectedPackage.durationHours * 3600 : 0
        });
    }
}

function formatHours(hours) {
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours >= 1) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
        const minutes = Math.floor(hours * 60);
        return `${minutes} min`;
    }
}

// Countdown timer for active session
let countdownInterval = null;

function startCountdownTimer(initialSeconds) {
    let remainingSeconds = initialSeconds;
    
    // Clear any existing timer
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // Update display immediately
    updateTimerDisplay(remainingSeconds);
    
    // Update every second
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            showToast('Session expired. Please purchase a new package.', 'warning');
            setTimeout(() => {
                localStorage.removeItem('sessionId');
                showScreen('packagesScreen');
            }, 3000);
            return;
        }
        
        updateTimerDisplay(remainingSeconds);
    }, 1000);
}

function updateTimerDisplay(seconds) {
    const timeEl = document.getElementById('timeBalance');
    if (timeEl) {
        timeEl.textContent = formatTime(seconds);
        
        // Add warning color if less than 5 minutes
        if (seconds < 300) {
            timeEl.style.color = '#f59e0b';
        }
        if (seconds < 60) {
            timeEl.style.color = '#ef4444';
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Auto-format voucher code input
document.addEventListener('input', (e) => {
    if (e.target.id === 'voucherCode') {
        let value = e.target.value.replace(/[^A-Z0-9]/g, '');
        if (value.length > 4) {
            value = value.substring(0, 4) + '-' + value.substring(4);
        }
        if (value.length > 9) {
            value = value.substring(0, 9) + '-' + value.substring(9, 13);
        }
        e.target.value = value;
    }
});
