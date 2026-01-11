/**
 * Responsive Utilities
 * Handle responsive behaviors, breakpoints, and mobile interactions
 */

const Responsive = {
    // Breakpoints
    breakpoints: {
        mobile: 576,
        tablet: 768,
        desktop: 992,
        wide: 1200
    },

    // Current viewport
    currentBreakpoint: null,

    /**
     * Initialize responsive utilities
     */
    init() {
        this.updateBreakpoint();
        this.initMobileMenu();
        this.initTouchGestures();
        this.initResizeHandler();
        this.initOrientationHandler();
    },

    /**
     * Get current breakpoint
     */
    updateBreakpoint() {
        const width = window.innerWidth;
        
        if (width <= this.breakpoints.mobile) {
            this.currentBreakpoint = 'mobile';
        } else if (width <= this.breakpoints.tablet) {
            this.currentBreakpoint = 'tablet';
        } else if (width <= this.breakpoints.desktop) {
            this.currentBreakpoint = 'desktop';
        } else {
            this.currentBreakpoint = 'wide';
        }

        return this.currentBreakpoint;
    },

    /**
     * Check if current viewport is mobile
     */
    isMobile() {
        return this.currentBreakpoint === 'mobile';
    },

    /**
     * Check if current viewport is tablet
     */
    isTablet() {
        return this.currentBreakpoint === 'tablet';
    },

    /**
     * Check if current viewport is desktop or wider
     */
    isDesktop() {
        return this.currentBreakpoint === 'desktop' || this.currentBreakpoint === 'wide';
    },

    /**
     * Initialize mobile menu functionality
     */
    initMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const toggleBtn = document.getElementById('btnToggleSidebar');

        if (!sidebar || !overlay || !toggleBtn) return;

        // Toggle menu on button click
        toggleBtn.addEventListener('click', () => {
            const isShown = sidebar.classList.contains('show');
            
            if (isShown) {
                this.closeMobileMenu();
            } else {
                this.openMobileMenu();
            }
        });

        // Close menu on overlay click
        overlay.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Close menu on nav link click (mobile only)
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (this.isMobile() || this.isTablet()) {
                    this.closeMobileMenu();
                }
            });
        });

        // Close menu on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('show')) {
                this.closeMobileMenu();
            }
        });
    },

    /**
     * Open mobile menu
     */
    openMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (sidebar && overlay) {
            sidebar.classList.add('show');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (sidebar && overlay) {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * Initialize touch gestures
     */
    initTouchGestures() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        let touchStartX = 0;
        let touchEndX = 0;

        // Swipe to open (from left edge)
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, { passive: true });
    },

    /**
     * Handle swipe gesture
     */
    handleSwipe(startX, endX) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const diff = endX - startX;
        const threshold = 100; // Minimum swipe distance

        // Swipe right from left edge (open menu)
        if (startX < 50 && diff > threshold && !sidebar.classList.contains('show')) {
            this.openMobileMenu();
        }

        // Swipe left (close menu)
        if (diff < -threshold && sidebar.classList.contains('show')) {
            this.closeMobileMenu();
        }
    },

    /**
     * Initialize resize handler
     */
    initResizeHandler() {
        let resizeTimer;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            
            resizeTimer = setTimeout(() => {
                const oldBreakpoint = this.currentBreakpoint;
                this.updateBreakpoint();
                
                // Close mobile menu when switching to desktop
                if (oldBreakpoint !== this.currentBreakpoint) {
                    if (this.isDesktop()) {
                        this.closeMobileMenu();
                    }
                    
                    // Trigger custom event
                    window.dispatchEvent(new CustomEvent('breakpointChange', {
                        detail: {
                            from: oldBreakpoint,
                            to: this.currentBreakpoint
                        }
                    }));
                }
            }, 250);
        });
    },

    /**
     * Initialize orientation change handler
     */
    initOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            // Close menu on orientation change
            setTimeout(() => {
                this.closeMobileMenu();
                this.updateBreakpoint();
            }, 100);
        });
    },

    /**
     * Toggle dropdowns (for mobile)
     */
    initDropdowns() {
        const dropdownToggles = document.querySelectorAll('[data-dropdown-toggle]');
        
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = toggle.getAttribute('data-dropdown-toggle');
                const dropdown = document.getElementById(targetId);
                
                if (dropdown) {
                    // Close other dropdowns
                    document.querySelectorAll('.notification-dropdown, .profile-dropdown').forEach(dd => {
                        if (dd.id !== targetId) {
                            dd.classList.remove('active');
                        }
                    });
                    
                    dropdown.classList.toggle('active');
                }
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[data-dropdown-toggle]')) {
                document.querySelectorAll('.notification-dropdown, .profile-dropdown').forEach(dd => {
                    dd.classList.remove('active');
                });
            }
        });
    },

    /**
     * Make tables responsive
     */
    makeTableResponsive(table) {
        if (!table) return;

        if (this.isMobile() || this.isTablet()) {
            // Wrap table in responsive container if not already wrapped
            if (!table.closest('.table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        }
    },

    /**
     * Optimize images for viewport
     */
    optimizeImages() {
        const images = document.querySelectorAll('img[data-src-mobile], img[data-src-tablet]');
        
        images.forEach(img => {
            let src = img.getAttribute('data-src-desktop');
            
            if (this.isMobile() && img.hasAttribute('data-src-mobile')) {
                src = img.getAttribute('data-src-mobile');
            } else if (this.isTablet() && img.hasAttribute('data-src-tablet')) {
                src = img.getAttribute('data-src-tablet');
            }
            
            if (src && img.src !== src) {
                img.src = src;
            }
        });
    },

    /**
     * Handle scroll behavior on mobile
     */
    initScrollBehavior() {
        let lastScrollTop = 0;
        const topbar = document.querySelector('.topbar');
        
        if (!topbar) return;

        window.addEventListener('scroll', Helpers.throttle(() => {
            if (!this.isMobile()) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                topbar.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                topbar.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = scrollTop;
        }, 100));
    },

    /**
     * Get viewport dimensions
     */
    getViewport() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    },

    /**
     * Check if element is in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    },

    /**
     * Lazy load elements
     */
    lazyLoad(selector = '[data-lazy]') {
        const elements = document.querySelectorAll(selector);
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    
                    if (element.hasAttribute('data-lazy-src')) {
                        element.src = element.getAttribute('data-lazy-src');
                        element.removeAttribute('data-lazy-src');
                    }
                    
                    if (element.hasAttribute('data-lazy-bg')) {
                        element.style.backgroundImage = `url(${element.getAttribute('data-lazy-bg')})`;
                        element.removeAttribute('data-lazy-bg');
                    }
                    
                    element.removeAttribute('data-lazy');
                    observer.unobserve(element);
                }
            });
        });
        
        elements.forEach(el => observer.observe(el));
    }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Responsive.init();
    });
} else {
    Responsive.init();
}

// Export
window.Responsive = Responsive;
