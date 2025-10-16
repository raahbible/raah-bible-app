// App State
const state = {
    versions: [],
    books: [],
    selectedVersions: [],
    selectedBook: '',
    selectedChapter: 1,
    comparisonData: null,
    loading: false
};

// API Configuration - will use same domain since backend and frontend are together
const API_BASE = '/api';

// DOM Elements
const elements = {
    versionGrid: document.getElementById('version-grid'),
    bookSelect: document.getElementById('book-select'),
    chapterSelect: document.getElementById('chapter-select'),
    prevChapterBtn: document.getElementById('prev-chapter'),
    nextChapterBtn: document.getElementById('next-chapter'),
    versionCount: document.getElementById('version-count'),
    errorDisplay: document.getElementById('error-display'),
    errorText: document.getElementById('error-text'),
    loadingDisplay: document.getElementById('loading-display'),
    comparisonDisplay: document.getElementById('comparison-display'),
    comparisonHeading: document.getElementById('comparison-heading'),
    selectedVersionsBadges: document.getElementById('selected-versions-badges'),
    versesContainer: document.getElementById('verses-container')
};

// Initialize App
async function init() {
    await fetchVersions();
    setupEventListeners();
}

// Fetch Bible Versions
async function fetchVersions() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/versions`);
        const data = await response.json();
        
        state.versions = data;
        renderVersionGrid();
        
        // Auto-select first 2 versions
        if (data.length > 0) {
            state.selectedVersions = [data[0].id];
            if (data.length > 1) {
                state.selectedVersions.push(data[1].id);
            }
            await fetchBooks(state.selectedVersions[0]);
            updateVersionCount();
            renderVersionGrid();
        }
    } catch (error) {
        showError('Failed to load Bible versions');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// Fetch Books
async function fetchBooks(versionId) {
    try {
        const response = await fetch(`${API_BASE}/versions/${versionId}/books`);
        const data = await response.json();
        
        state.books = data;
        renderBookSelect();
        
        // Auto-select first book (Genesis)
        if (data.length > 0) {
            state.selectedBook = data[0].id;
            elements.bookSelect.value = state.selectedBook;
            updateChapterSelect();
            await fetchComparison();
        }
    } catch (error) {
        showError('Failed to load books');
        console.error(error);
    }
}

// Fetch Comparison
async function fetchComparison() {
    if (state.selectedVersions.length === 0 || !state.selectedBook) return;
    
    try {
        showLoading(true);
        hideError();
        
        const response = await fetch(`${API_BASE}/compare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version_ids: state.selectedVersions,
                book_id: state.selectedBook,
                chapter: state.selectedChapter
            })
        });
        
        const data = await response.json();
        state.comparisonData = data;
        renderComparison();
    } catch (error) {
        showError('Failed to load chapter comparison');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// Render Version Grid
function renderVersionGrid() {
    if (state.versions.length === 0) {
        elements.versionGrid.innerHTML = '<div class="loading">Loading versions...</div>';
        return;
    }
    
    elements.versionGrid.innerHTML = state.versions.map(version => {
        const isSelected = state.selectedVersions.includes(version.id);
        const isDisabled = !isSelected && state.selectedVersions.length >= 4;
        
        return `
            <button 
                class="version-btn ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                data-version-id="${version.id}"
                ${isDisabled ? 'disabled' : ''}
            >
                <div class="version-name">${version.abbreviation}</div>
                <div class="version-language">${version.language}</div>
            </button>
        `;
    }).join('');
    
    // Add click event listeners
    document.querySelectorAll('.version-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const versionId = btn.getAttribute('data-version-id');
            handleVersionToggle(versionId);
        });
    });
}

// Render Book Select
function renderBookSelect() {
    elements.bookSelect.innerHTML = state.books.map(book => 
        `<option value="${book.id}">${book.name}</option>`
    ).join('');
}

// Update Chapter Select
function updateChapterSelect() {
    const book = state.books.find(b => b.id === state.selectedBook);
    const maxChapters = book?.chapters?.length || 50; // Default to 50 if not available
    
    elements.chapterSelect.innerHTML = Array.from({ length: maxChapters }, (_, i) => 
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    
    elements.chapterSelect.value = state.selectedChapter;
    updateChapterButtons();
}

// Update Chapter Navigation Buttons
function updateChapterButtons() {
    const book = state.books.find(b => b.id === state.selectedBook);
    const maxChapters = book?.chapters?.length || 50;
    
    elements.prevChapterBtn.disabled = state.selectedChapter <= 1;
    elements.nextChapterBtn.disabled = state.selectedChapter >= maxChapters;
}

// Render Comparison
function renderComparison() {
    if (!state.comparisonData) {
        elements.comparisonDisplay.style.display = 'none';
        return;
    }
    
    elements.comparisonDisplay.style.display = 'block';
    elements.comparisonHeading.textContent = 
        `${state.comparisonData.book_name} ${state.comparisonData.chapter}`;
    
    // Render version badges
    elements.selectedVersionsBadges.innerHTML = state.selectedVersions.map(versionId => {
        const version = state.versions.find(v => v.id === versionId);
        return `<span class="badge">${version?.abbreviation || versionId}</span>`;
    }).join('');
    
    // Render verses
    const colsClass = `cols-${state.selectedVersions.length}`;
    elements.versesContainer.innerHTML = state.comparisonData.verses.map(verse => `
        <div class="verse-item">
            <div class="verse-header">
                <span class="verse-number">${verse.verse}</span>
                <div class="verse-separator"></div>
            </div>
            <div class="verse-grid ${colsClass}">
                ${state.selectedVersions.map(versionId => {
                    const version = state.versions.find(v => v.id === versionId);
                    const text = verse.texts[versionId] || 'Verse not available';
                    return `
                        <div class="verse-text-box">
                            <div class="verse-version-label">${version?.abbreviation || versionId}</div>
                            <p class="verse-text">${text}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// Handle Version Toggle
async function handleVersionToggle(versionId) {
    if (state.selectedVersions.includes(versionId)) {
        state.selectedVersions = state.selectedVersions.filter(id => id !== versionId);
    } else if (state.selectedVersions.length < 4) {
        state.selectedVersions.push(versionId);
        
        // Fetch books if we don't have them yet
        if (state.books.length === 0) {
            await fetchBooks(versionId);
        }
    }
    
    updateVersionCount();
    renderVersionGrid();
    
    if (state.selectedVersions.length > 0 && state.selectedBook) {
        await fetchComparison();
    }
}

// Update Version Count
function updateVersionCount() {
    elements.versionCount.textContent = 
        `${state.selectedVersions.length} version${state.selectedVersions.length !== 1 ? 's' : ''} selected`;
}

// Setup Event Listeners
function setupEventListeners() {
    // Book selection
    elements.bookSelect.addEventListener('change', async (e) => {
        state.selectedBook = e.target.value;
        state.selectedChapter = 1;
        updateChapterSelect();
        await fetchComparison();
    });
    
    // Chapter selection
    elements.chapterSelect.addEventListener('change', async (e) => {
        state.selectedChapter = parseInt(e.target.value);
        updateChapterButtons();
        await fetchComparison();
    });
    
    // Chapter navigation
    elements.prevChapterBtn.addEventListener('click', async () => {
        if (state.selectedChapter > 1) {
            state.selectedChapter--;
            elements.chapterSelect.value = state.selectedChapter;
            updateChapterButtons();
            await fetchComparison();
        }
    });
    
    elements.nextChapterBtn.addEventListener('click', async () => {
        const book = state.books.find(b => b.id === state.selectedBook);
        const maxChapters = book?.chapters?.length || 50;
        
        if (state.selectedChapter < maxChapters) {
            state.selectedChapter++;
            elements.chapterSelect.value = state.selectedChapter;
            updateChapterButtons();
            await fetchComparison();
        }
    });
}

// Show/Hide Loading
function showLoading(show) {
    state.loading = show;
    elements.loadingDisplay.style.display = show ? 'block' : 'none';
}

// Show Error
function showError(message) {
    elements.errorText.textContent = message;
    elements.errorDisplay.style.display = 'block';
}

// Hide Error
function hideError() {
    elements.errorDisplay.style.display = 'none';
}

// Start the app
init();
