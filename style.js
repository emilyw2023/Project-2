const grid = document.querySelector('#trail-grid');
const resultsCount = document.querySelector('#results-count');
const emptyState = document.querySelector('#empty-state');
const loadError = document.querySelector('#load-error');
const searchInput = document.querySelector('#search-input');
const difficultyFilter = document.querySelector('#difficulty-filter');
const locationFilter = document.querySelector('#location-filter');
const sortSelect = document.querySelector('#sort-select');
const favoritesToggle = document.querySelector('#favorites-toggle');

let trails = [];
let savedFavorites = new Set();
let showFavoritesOnly = false;

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

function formatDistance(value) {
	const raw = clean(value);
	const distance = numberFrom(raw);
	const suffix = /km/i.test(raw) ? 'km' : 'mi';
	return `${Number.isInteger(distance) ? distance : distance.toFixed(1).replace(/\.0$/, '')} ${suffix}`;
}

function renderTrail(trail, index) {
	const favorite = savedFavorites.has(trail.key);
	const imageStyle = `art-${(index % 6) + 1}`;
	const elevation = trail.elevation ? `${Math.round(trail.elevation).toLocaleString()} ft` : '—';
	return `<article class="trail-card">
		<div class="card-art ${imageStyle}" aria-hidden="true">
			<span class="art-sun"></span>
			<span class="difficulty-pill ${trail.difficulty}">${escapeHTML(trail.difficulty)}</span>
			<span class="art-label">FIND YOUR OWN PACE</span>
		</div>
		<button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${escapeHTML(trail.key)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escapeHTML(trail.name)} ${favorite ? 'from' : 'to'} favorites" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
		<div class="card-body">
			<p class="card-location">⌖ &nbsp;${escapeHTML(trail.location)}</p>
			<h3 class="card-title" title="${escapeHTML(trail.name)}">${escapeHTML(trail.name)}</h3>
			<div class="trail-stats">
				<div class="trail-stat"><strong>${escapeHTML(formatDistance(trail.length))}</strong><span>DISTANCE</span></div>
				<div class="trail-stat"><strong>${escapeHTML(elevation)}</strong><span>ELEVATION GAIN</span></div>
			</div>
			${trail.note ? `<p class="trail-note">✦ &nbsp;${escapeHTML(trail.note)}</p>` : ''}
		</div>
	</article>`;
}

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

	if (sortSelect.value === 'shortest') filtered.sort((a, b) => a.lengthValue - b.lengthValue);
	if (sortSelect.value === 'longest') filtered.sort((a, b) => b.lengthValue - a.lengthValue);
	if (sortSelect.value === 'easiest') filtered.sort((a, b) => a.elevation - b.elevation);

	grid.innerHTML = filtered.map(renderTrail).join('');
	resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'trail' : 'trails'} to explore`;
	emptyState.hidden = filtered.length > 0;
}

function saveFavorites() {
	try {
		localStorage.setItem('trailhead-favorites', JSON.stringify([...savedFavorites]));
	} catch {
		// Favorites still work for this visit if browser storage is unavailable.
	}
}

async function loadTrails() {
	try {
		const response = await fetch('./Data.json');
		if (!response.ok) throw new Error(`Trail data request failed: ${response.status}`);
		const data = await response.json();
		if (!Array.isArray(data)) throw new Error('Trail data should be a JSON array.');

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

		const regions = [...new Set(trails.map((trail) => locationRegion(trail.location)))].sort();
		locationFilter.insertAdjacentHTML('beforeend', regions.map((region) => `<option value="${escapeHTML(region)}">${escapeHTML(region)}</option>`).join(''));
		renderTrails();
	} catch (error) {
		console.error('Unable to load hiking trails:', error);
		resultsCount.textContent = 'Trail list unavailable';
		loadError.hidden = false;
	}
}

searchInput.addEventListener('input', renderTrails);
difficultyFilter.addEventListener('change', renderTrails);
locationFilter.addEventListener('change', renderTrails);
sortSelect.addEventListener('change', renderTrails);

favoritesToggle.addEventListener('click', () => {
	showFavoritesOnly = !showFavoritesOnly;
	favoritesToggle.setAttribute('aria-pressed', String(showFavoritesOnly));
	favoritesToggle.querySelector('span').textContent = showFavoritesOnly ? '♥' : '♡';
	renderTrails();
});

grid.addEventListener('click', (event) => {
	const button = event.target.closest('[data-favorite]');
	if (!button) return;
	const key = button.dataset.favorite;
	if (savedFavorites.has(key)) savedFavorites.delete(key);
	else savedFavorites.add(key);
	saveFavorites();
	renderTrails();
});

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

document.addEventListener('keydown', (event) => {
	if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
		event.preventDefault();
		searchInput.focus();
	}
});

loadTrails();
