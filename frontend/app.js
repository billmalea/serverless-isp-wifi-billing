// API Configuration
const API_BASE_URL = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod';

// State
let selectedPackage = null;
let currentTransaction = null;
let paymentCheckInterval = null;

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
        card.onclick = () => selectPackage(pkg);
        
        const isPopular = pkg.id === 'standard';
        
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
function selectPackage(pkg) {
    selectedPackage = pkg;
    
    // Update UI
    document.querySelectorAll('.package-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.package-card').classList.add('selected');
    
    // Show payment form
    document.getElementById('paymentForm').style.display = 'block';
    document.getElementById('paymentForm').scrollIntoView({ behavior: 'smooth' });
}

// Initiate M-Pesa Payment
async function initiatePayment() {
    const phoneInput = document.getElementById('phoneNumber');
    const phoneNumber = phoneInput.value.trim();
    
    if (!phoneNumber) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    
    if (!selectedPackage) {
        showToast('Please select a package', 'error');
        return;
    }
    
    const deviceInfo = getDeviceInfo();
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber,
                packageId: selectedPackage.id,
                ...deviceInfo,
            }),
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentTransaction = result.data;
            document.getElementById('processingPhone').textContent = formatPhoneNumber(phoneNumber);
            showScreen('processingScreen');
            startPaymentStatusCheck();
        } else {
            showToast(result.error || 'Payment initiation failed', 'error');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment failed. Please try again.', 'error');
    }
}

// Check Payment Status
async function checkPaymentStatus() {
    if (!currentTransaction) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/payment/status?transactionId=${currentTransaction.transactionId}`
        );
        const result = await response.json();
        
        if (result.success && result.data.status === 'completed') {
            stopPaymentStatusCheck();
            showSuccessScreen(result.data);
        } else if (result.data.status === 'failed') {
            stopPaymentStatusCheck();
            showToast('Payment failed. Please try again.', 'error');
            showScreen('packagesScreen');
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

function startPaymentStatusCheck() {
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
    // Update connection status
    const statusEl = document.getElementById('connectionStatus');
    statusEl.innerHTML = '<span class="status-dot connected"></span><span>Connected</span>';
    
    // Update session info (time-based)
    const timeRemaining = data.timeRemaining || 0; // in seconds
    const bandwidthMbps = data.bandwidthMbps || 0;
    const packageName = data.packageName || data.package || 'Unknown';
    
    // Update package info display
    document.getElementById('packageInfo').textContent = packageName;
    document.getElementById('timeBalance').textContent = formatTime(timeRemaining);
    document.getElementById('dataBalance').textContent = bandwidthMbps + ' Mbps';
    
    // Start countdown timer
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
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Close Portal and Start Browsing
function closePortal() {
    // Try to close the window or redirect
    window.close();
    
    // If window.close() doesn't work (most browsers block it), redirect to a success page
    setTimeout(() => {
        window.location.href = 'about:blank';
    }, 500);
}

// Utility Functions
function formatPhoneNumber(phone) {
    phone = phone.replace(/\s/g, '');
    if (phone.startsWith('0')) {
        return '254' + phone.substring(1);
    }
    if (!phone.startsWith('254')) {
        return '254' + phone;
    }
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
