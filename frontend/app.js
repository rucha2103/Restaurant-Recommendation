document.addEventListener('DOMContentLoaded', () => {
    const apiBaseUrl = (window.__API_BASE_URL__ || '').replace(/\/+$/, '');
    const apiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

    const form = document.getElementById('preference-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    
    const ratingInput = document.getElementById('minimum_rating');
    const ratingVal = document.getElementById('rating-val');
    const budgetSlider = document.getElementById('budget_per_person');
    const budgetVal = document.getElementById('budget-val');
    const toggleMoreBtn = document.getElementById('toggle-more');
    const moreOptions = document.getElementById('more-options');
    const vibeChips = Array.from(document.querySelectorAll('.vibe-chip'));
    
    const locationList = document.getElementById('location-list');
    const cuisineSelect = document.getElementById('cuisine');
    
    const resultsMeta = document.getElementById('results-meta');
    const summaryTitle = document.getElementById('summary-title');
    const summaryText = document.getElementById('summary-text');
    const relaxationsBanner = document.getElementById('relaxations-banner');
    const relaxationsText = document.getElementById('relaxations-text');
    const resultsList = document.getElementById('results-list');

    // Update rating value display
    ratingInput.addEventListener('input', (e) => {
        ratingVal.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Update budget display
    function updateBudgetLabel() {
        const value = Number(budgetSlider.value);
        if (value >= 1000) {
            budgetVal.textContent = `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
        } else {
            budgetVal.textContent = `₹${value}`;
        }
    }
    budgetSlider.addEventListener('input', updateBudgetLabel);
    updateBudgetLabel();

    // Additional options collapse
    toggleMoreBtn.addEventListener('click', () => {
        const hidden = moreOptions.classList.toggle('hidden');
        toggleMoreBtn.textContent = hidden ? '⌄ More options' : '⌃ Less options';
    });

    // Vibe chip selection
    vibeChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
        });
    });

    // Fetch initial metadata for autocomplete
    async function fetchMetadata() {
        try {
            const res = await fetch(apiUrl('/metadata'));
            if (res.ok) {
                const data = await res.json();
                
                // Populate locations datalist
                if (data.locations) {
                    data.locations.forEach(city => {
                        const option = document.createElement('option');
                        option.value = city;
                        locationList.appendChild(option);
                    });
                }
                
                // Populate cuisine select
                if (data.cuisines) {
                    data.cuisines.slice(0, 120).forEach(c => {
                        const option = document.createElement('option');
                        option.value = c;
                        option.textContent = c;
                        cuisineSelect.appendChild(option);
                    });
                } else {
                    ['North Indian', 'South Indian', 'Chinese', 'Italian'].forEach(c => {
                        const option = document.createElement('option');
                        option.value = c;
                        option.textContent = c;
                        cuisineSelect.appendChild(option);
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load metadata:', err);
        }
    }

    fetchMetadata();

    function mapBudgetToBucket(perPersonBudget) {
        // Map slider (per person) to existing backend budget buckets (for two people ranges).
        // Approx conversion: cost_for_two ~= perPerson * 2
        const approxForTwo = perPersonBudget * 2;
        if (approxForTwo <= 500) return 'low';
        if (approxForTwo <= 1500) return 'medium';
        return 'high';
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI states: set loading
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        
        resultsList.innerHTML = '';
        resultsMeta.classList.add('hidden');
        relaxationsBanner.classList.add('hidden');

        // Show skeleton loading
        for (let i = 0; i < 3; i++) {
            resultsList.innerHTML += `
                <div class="card" style="opacity: 0.5;">
                    <div class="card-header">
                        <div>
                            <div style="width: 170px; height: 20px; background: rgba(0,0,0,0.08); border-radius: 6px;"></div>
                            <div style="width: 120px; height: 12px; background: rgba(0,0,0,0.05); border-radius: 6px; margin-top: 8px;"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        const selectedVibes = vibeChips
            .filter((chip) => chip.classList.contains('active'))
            .map((chip) => chip.dataset.vibe);
        const partySize = document.getElementById('party_size').value.trim();
        const additionalText = document.getElementById('additional_preferences').value.trim();

        const extraPrefsParts = [];
        if (selectedVibes.length) extraPrefsParts.push(`Vibe: ${selectedVibes.join(', ')}`);
        if (partySize) extraPrefsParts.push(`Party size: ${partySize}`);
        if (additionalText) extraPrefsParts.push(additionalText);

        // Build request payload
        const payload = {
            location: document.getElementById('location').value,
            budget: mapBudgetToBucket(Number(budgetSlider.value)),
            cuisine: document.getElementById('cuisine').value,
            minimum_rating: parseFloat(document.getElementById('minimum_rating').value),
            include_unrated: document.getElementById('include_unrated').checked,
            top_n: 5
        };

        if (extraPrefsParts.length) {
            payload.additional_preferences = extraPrefsParts.join(' | ');
        }

        try {
            const res = await fetch(apiUrl('/recommendations'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let errText = await res.text();
                throw new Error(`API error: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            renderResults(data);

        } catch (err) {
            console.error(err);
            resultsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <p>Something went wrong while fetching recommendations.</p>
                    <p style="font-size: 0.8rem; margin-top: 8px; color: #8b84a0;">${err.message}</p>
                </div>
            `;
        } finally {
            // Revert loading UI
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    });

    function renderResults(data) {
        resultsList.innerHTML = ''; // clear loading state
        // Intentionally suppress backend status/diagnostic banners in UI.
        resultsMeta.classList.add('hidden');
        relaxationsBanner.classList.add('hidden');

        if (!data.recommendations || data.recommendations.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <p>No restaurants match perfectly. Try loosening your constraints further or selecting a different area.</p>
                </div>
            `;
            return;
        }

        // Render cards
        data.recommendations.forEach((rec) => {
            const ratingHtml = rec.rating 
                ? `<span class="badge rating">★ ${rec.rating}</span>`
                : `<span class="badge warning">No Rating</span>`;
                
            let costHtml = '';
            if (rec.estimated_cost != null) {
                const cur = rec.currency || '₹';
                costHtml = `<span class="badge cost">${cur}${rec.estimated_cost} for two</span>`;
            } else {
                costHtml = `<span class="badge warning">Cost Unknown</span>`;
            }

            const card = document.createElement('div');
            card.className = 'card';
            
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="card-title">${rec.name} <span style="font-size: 0.84rem; font-weight: 500; color: #8a83a1;">(${rec.location})</span></div>
                        <div class="card-cuisine">${(rec.cuisines || []).join(', ')}</div>
                    </div>
                    <div class="badges">
                        ${ratingHtml}
                        ${costHtml}
                    </div>
                </div>
                ${rec.why ? `<div class="card-reason"><em>"${rec.why}"</em></div>` : ''}
            `;
            
            resultsList.appendChild(card);
        });
    }
});
