// Find the page elements used by the trail list.
const grid = document.querySelector('#trail-grid');
const resultsCount = document.querySelector('#results-count');
const emptyState = document.querySelector('#empty-state');
const loadError = document.querySelector('#load-error');
const searchInput = document.querySelector('#search-input');
const difficultyFilter = document.querySelector('#difficulty-filter');
const locationFilter = document.querySelector('#location-filter');
const sortSelect = document.querySelector('#sort-select');
const favoritesToggle = document.querySelector('#favorites-toggle');
const trailDialog = document.querySelector('#trailpopup');
const dialogClose = document.querySelector('#dialog-close');
const dialogTitle = document.querySelector('#dialog-title');
const dialogLocation = document.querySelector('#dialog-location');
const dialogDifficulty = document.querySelector('#dialog-difficulty');
const dialogDistance = document.querySelector('#dialog-distance');
const dialogElevation = document.querySelector('#dialog-elevation');
const dialogNote = document.querySelector('#dialog-note');
const dialogTrailLink = document.querySelector('#dialog-trail-link');

let trails = [];
// Saved trail keys power the heart buttons and favorites-only filter.
let savedFavorites = new Set();
let showFavoritesOnly = false;
const preferredRegionOrder = ['GA', 'MT', 'WY', 'WA'];

// Clean and format values from the trail data.
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function clean(value) {
	return String(value ?? '').trim();
}

function numberFrom(value) {
	const parsed = Number.parseFloat(clean(value).replace(/,/g, ''));
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDifficulty(value) {
	const difficulty = clean(value).toLowerCase();
	if (difficulty.startsWith('e')) return 'easy';
	if (difficulty.startsWith('h')) return 'hard';
	return 'moderate';
}

function trailKey(trail) {
	return `${trail.name.toLowerCase()}|${trail.location.toLowerCase()}`;
}

function locationRegion(location) {
	const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
	return parts.at(-1) || location;
}

function compareRegions(first, second) {
	const firstOrder = preferredRegionOrder.indexOf(first);
	const secondOrder = preferredRegionOrder.indexOf(second);
	if (firstOrder < 0) return secondOrder < 0 ? first.localeCompare(second) : 1;
	if (secondOrder < 0) return -1;
	return firstOrder - secondOrder;
}

function formatDistance(value) {
	const raw = clean(value);
	const distance = numberFrom(raw);
	const suffix = /km/i.test(raw) ? 'km' : 'mi';
	return `${Number.isInteger(distance) ? distance : distance.toFixed(1).replace(/\.0$/, '')} ${suffix}`;
}

// Build the HTML for one trail card.
function renderTrail(trail) {
	// Show a filled heart when this trail is saved.
	const favorite = savedFavorites.has(trail.key);
	const details = [
		[formatDistance(trail.length), 'DISTANCE'],
		[trail.elevation ? `${Math.round(trail.elevation).toLocaleString()} ft` : '—', 'ELEVATION GAIN']
	].map(([value, label]) => `<div class="trail-stat"><strong>${escapeHTML(value)}</strong><span>${label}</span></div>`).join('');
	const note = trail.note ? `<p class="trail-note">✦ &nbsp;${escapeHTML(trail.note)}</p>` : '';
	return `<article class="trail-card" data-trail-key="${escapeHTML(trail.key)}" tabindex="0" aria-haspopup="dialog" aria-label="View details for ${escapeHTML(trail.name)}">
		<div class="card-art" aria-hidden="true">
			<span class="difficulty-pill ${trail.difficulty}">${escapeHTML(trail.difficulty)}</span>
		</div>
		<button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${escapeHTML(trail.key)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHTML(trail.name)} ${favorite ? 'from' : 'to'} favorites" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
		<div class="card-body">
			<p class="card-location">${escapeHTML(trail.location)}</p>
			<h3 class="card-title" title="${escapeHTML(trail.name)}">${escapeHTML(trail.name)}</h3>
			<div class="trail-stats">${details}</div>
			${note}
		</div>
	</article>`;
}

// Fill in and open the details popup for a trail.
function showTrailDetails(key) {
	const trail = trails.find((item) => item.key === key);
	if (!trail) return;

	dialogTitle.textContent = trail.name;
	dialogLocation.textContent = trail.location;
	dialogDifficulty.textContent = trail.difficulty;
	dialogDifficulty.classList.toggle('easy', trail.difficulty === 'easy');
	dialogDifficulty.classList.toggle('moderate', trail.difficulty === 'moderate');
	dialogDifficulty.classList.toggle('hard', trail.difficulty === 'hard');
	dialogDistance.textContent = formatDistance(trail.length);
	dialogElevation.textContent = trail.elevation ? `${Math.round(trail.elevation).toLocaleString()} ft` : '—';
	dialogNote.textContent = trail.note ? `Note: ${trail.note}` : '';
	dialogNote.hidden = !trail.note;
	dialogTrailLink.hidden = trail.name.toLowerCase().replace(/[^a-z]/g, '') !== 'ravencliffalls';
	trailDialog.showModal();
}

// Apply the selected filters and show matching trails.
function renderTrails() {
	const query = searchInput.value.trim().toLowerCase();
	const difficulty = difficultyFilter.value;
	const region = locationFilter.value;
	const filtered = trails.filter((trail) => {
		const matchesSearch = `${trail.name} ${trail.location}`.toLowerCase().includes(query);
		return matchesSearch
			&& (difficulty === 'all' || trail.difficulty === difficulty)
			&& (region === 'all' || locationRegion(trail.location) === region)
			&& (!showFavoritesOnly || savedFavorites.has(trail.key));
	});

	if (sortSelect.value === 'recommended') {
		filtered.sort((a, b) => compareRegions(locationRegion(a.location), locationRegion(b.location)));
	} else if (sortSelect.value === 'shortest') {
		filtered.sort((a, b) => a.lengthValue - b.lengthValue);
	} else if (sortSelect.value === 'longest') {
		filtered.sort((a, b) => b.lengthValue - a.lengthValue);
	} else if (sortSelect.value === 'easiest') {
		filtered.sort((a, b) => a.elevation - b.elevation);
	}

	grid.innerHTML = filtered.map(renderTrail).join('');
	resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'trail' : 'trails'} to explore`;
	emptyState.hidden = filtered.length > 0;
}

// Save favorite trails in this browser.
function saveFavorites() {
	try {
		localStorage.setItem('trailhead-favorites', JSON.stringify([...savedFavorites]));
	} catch {
		// Favorites still work for this visit if browser storage is unavailable.
	}
}

// Load trail data and add its locations to the filter menu.
async function loadTrails() {
	try {
		const response = await fetch('./Data.json');
		if (!response.ok) throw new Error();
		const data = await response.json();
		if (!Array.isArray(data)) throw new Error();

		trails = data.map((item) => {
			const trail = {
				name: clean(item['Hiking Trails']),
				location: clean(item.Location),
				length: clean(item.Length),
				lengthValue: numberFrom(item.Length),
				elevation: numberFrom(item['Elevation Gain']),
				difficulty: normalizeDifficulty(item.Difficulty),
				note: clean(item.extra)
			};
			trail.key = trailKey(trail);
			return trail;
		}).filter((trail) => trail.name);

		// Restore saved favorites, or use the defaults from the data file.
		let storedFavorites;
		try {
			storedFavorites = localStorage.getItem('trailhead-favorites');
		} catch {
			storedFavorites = null;
		}
		if (storedFavorites !== null) {
			try {
				savedFavorites = new Set(JSON.parse(storedFavorites));
			} catch {
				savedFavorites = new Set();
			}
		} else {
			savedFavorites = new Set(data.filter((item) => item.Favorites).map((item) => {
				return `${clean(item['Hiking Trails']).toLowerCase()}|${clean(item.Location).toLowerCase()}`;
			}));
		}

		const regions = [...new Set(trails.map((trail) => locationRegion(trail.location)))].sort(compareRegions);
		locationFilter.insertAdjacentHTML('beforeend', regions.map((region) => `<option value="${escapeHTML(region)}">${escapeHTML(region)}</option>`).join(''));
		renderTrails();
	} catch {
		resultsCount.textContent = 'Trail list unavailable';
		loadError.hidden = false;
	}
}

// Update the trail list when a filter changes.
searchInput.addEventListener('input', renderTrails);
difficultyFilter.addEventListener('change', renderTrails);
locationFilter.addEventListener('change', renderTrails);
sortSelect.addEventListener('change', renderTrails);

// Turn favorites-only filtering on or off.
favoritesToggle.addEventListener('click', () => {
	showFavoritesOnly = !showFavoritesOnly;
	favoritesToggle.setAttribute('aria-pressed', String(showFavoritesOnly));
	favoritesToggle.querySelector('span').textContent = showFavoritesOnly ? '♥' : '♡';
	renderTrails();
});

// Open trail details, or save/remove a favorite when its heart is clicked.
grid.addEventListener('click', (event) => {
	const button = event.target.closest('[data-favorite]');
	if (button) {
		const key = button.dataset.favorite;
		if (savedFavorites.has(key)) savedFavorites.delete(key);
		else savedFavorites.add(key);
		saveFavorites();
		renderTrails();
		return;
	}

	const card = event.target.closest('[data-trail-key]');
	if (card) showTrailDetails(card.dataset.trailKey);
});

// Support opening cards with Enter or Space.
grid.addEventListener('keydown', (event) => {
	const card = event.target.closest('[data-trail-key]');
	if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
	event.preventDefault();
	showTrailDetails(card.dataset.trailKey);
});

dialogClose.addEventListener('click', () => trailDialog.close());
trailDialog.addEventListener('click', (event) => {
	if (event.target === trailDialog) trailDialog.close();
});

// Reset search, filters, and favorites view.
document.querySelector('#clear-filters').addEventListener('click', () => {
	searchInput.value = '';
	difficultyFilter.value = 'all';
	locationFilter.value = 'all';
	sortSelect.value = 'recommended';
	showFavoritesOnly = false;
	favoritesToggle.setAttribute('aria-pressed', 'false');
	favoritesToggle.querySelector('span').textContent = '♡';
	renderTrails();
});

// Press / to jump directly to the search box.
document.addEventListener('keydown', (event) => {
	if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
		event.preventDefault();
		searchInput.focus();
	}
});

// Start the page by loading the trail data.
loadTrails();
