/**
 * Creates and displays a simple toast notification.
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success', duration: number = 3000): void {
    console.log(`[AetherFlow Toast] Showing ${type}: ${message}`);

    // Load styles from CSS
    const styleLink = document.getElementById('aetherflow-toast-styles');
    if (!styleLink) {
        const link = document.createElement('link');
        link.id = 'aetherflow-toast-styles';
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('styles/toast.css');
        document.head.appendChild(link);
    }

    // Remove existing toast if any
    const existingToast = document.getElementById('aetherflow-toast-container');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast container
    const toast = document.createElement('div');
    toast.id = 'aetherflow-toast-container';
    toast.className = `aetherflow-toast-notification ${type}`;
    toast.textContent = message;

    // Add appropriate icon based on type
    if (type === 'success') {
        toast.textContent = `✓ ${message}`;
    } else if (type === 'error') {
        toast.textContent = `✗ ${message}`;
    } else if (type === 'info') {
        toast.textContent = `ℹ ${message}`;
    }

    // Append to body
    document.body.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Set timeout to fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        // Remove the element after the transition completes
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Match the transition duration
    }, duration - 300); // Start fade-out before total duration
} 