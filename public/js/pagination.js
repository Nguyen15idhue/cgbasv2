/**
 * Pagination Component
 * Reusable pagination component for all tables
 */

class Pagination {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.currentPage = 1;
        this.totalPages = 1;
        this.limit = options.limit || 20;
        this.onPageChange = options.onPageChange || (() => {});
        
        if (!this.container) {
            console.error(`Pagination container #${containerId} not found`);
        }
    }

    /**
     * Update pagination state and render
     * @param {number} currentPage 
     * @param {number} totalPages 
     * @param {number} total - Total items
     */
    update(currentPage, totalPages, total = 0) {
        this.currentPage = currentPage;
        this.totalPages = totalPages;
        this.total = total;
        this.render();
    }

    /**
     * Render pagination HTML
     */
    render() {
        if (!this.container) return;

        if (this.totalPages <= 1) {
            this.container.innerHTML = '';
            return;
        }

        const pages = this.getPageNumbers();
        
        this.container.innerHTML = `
            <nav aria-label="Pagination">
                <ul class="pagination pagination-sm mb-0">
                    ${this.renderPrevButton()}
                    ${pages.map(page => this.renderPageButton(page)).join('')}
                    ${this.renderNextButton()}
                </ul>
                ${this.renderInfo()}
            </nav>
        `;

        this.attachEventListeners();
    }

    /**
     * Get array of page numbers to display
     */
    getPageNumbers() {
        const pages = [];
        const maxVisible = 7; // Maximum visible page buttons

        if (this.totalPages <= maxVisible) {
            // Show all pages
            for (let i = 1; i <= this.totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first, last, and pages around current
            const start = Math.max(2, this.currentPage - 2);
            const end = Math.min(this.totalPages - 1, this.currentPage + 2);

            pages.push(1);

            if (start > 2) {
                pages.push('...');
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (end < this.totalPages - 1) {
                pages.push('...');
            }

            pages.push(this.totalPages);
        }

        return pages;
    }

    /**
     * Render previous button
     */
    renderPrevButton() {
        const disabled = this.currentPage === 1 ? 'disabled' : '';
        return `
            <li class="page-item ${disabled}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}" ${disabled ? 'tabindex="-1"' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    }

    /**
     * Render next button
     */
    renderNextButton() {
        const disabled = this.currentPage === this.totalPages ? 'disabled' : '';
        return `
            <li class="page-item ${disabled}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}" ${disabled ? 'tabindex="-1"' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    }

    /**
     * Render page button
     */
    renderPageButton(page) {
        if (page === '...') {
            return `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }

        const active = page === this.currentPage ? 'active' : '';
        return `
            <li class="page-item ${active}">
                <a class="page-link" href="#" data-page="${page}">${page}</a>
            </li>
        `;
    }

    /**
     * Render pagination info
     */
    renderInfo() {
        if (!this.total) return '';

        const start = (this.currentPage - 1) * this.limit + 1;
        const end = Math.min(this.currentPage * this.limit, this.total);

        return `
            <div class="d-flex justify-content-between align-items-center mt-2">
                <small class="text-muted">
                    Hiển thị <strong>${start}-${end}</strong> trong tổng số <strong>${this.total}</strong> kết quả
                </small>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-secondary ${this.limit === 10 ? 'active' : ''}" data-limit="10">10</button>
                    <button type="button" class="btn btn-outline-secondary ${this.limit === 20 ? 'active' : ''}" data-limit="20">20</button>
                    <button type="button" class="btn btn-outline-secondary ${this.limit === 50 ? 'active' : ''}" data-limit="50">50</button>
                    <button type="button" class="btn btn-outline-secondary ${this.limit === 100 ? 'active' : ''}" data-limit="100">100</button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to pagination buttons
     */
    attachEventListeners() {
        if (!this.container) return;

        // Page number clicks
        this.container.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= this.totalPages) {
                    this.goToPage(page);
                }
            });
        });

        // Limit change
        this.container.querySelectorAll('[data-limit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newLimit = parseInt(btn.dataset.limit);
                if (newLimit !== this.limit) {
                    this.limit = newLimit;
                    this.goToPage(1); // Reset to first page when changing limit
                }
            });
        });
    }

    /**
     * Navigate to specific page
     */
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.onPageChange(page, this.limit);
    }

    /**
     * Get current state
     */
    getState() {
        return {
            page: this.currentPage,
            limit: this.limit,
            totalPages: this.totalPages,
            total: this.total
        };
    }
}

// Export for use in other files
window.Pagination = Pagination;
