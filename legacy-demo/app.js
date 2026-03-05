/**
 * 전역 상수 및 데이터 정의
 */
const SCHOOL_MEAL_DATA = {
    breakfast: [
        { name: '친환경 백미밥', allergies: [], nutrition: { kcal: 310, carbs: 68, protein: 5, fat: 0.5 } },
        { name: '쇠고기 미역국', allergies: [5, 6, 16], nutrition: { kcal: 45, carbs: 3, protein: 4, fat: 2 } },
        { name: '치즈 계란말이', allergies: [1, 2], nutrition: { kcal: 120, carbs: 2, protein: 8, fat: 9 } },
        { name: '오징어 젓갈', allergies: [17], nutrition: { kcal: 25, carbs: 4, protein: 2, fat: 0.5 } },
        { name: '배추김치', allergies: [9, 13], nutrition: { kcal: 15, carbs: 3, protein: 1, fat: 0 } }
    ],
    lunch: [
        { name: '혼합 잡곡밥', allergies: [5], nutrition: { kcal: 305, carbs: 65, protein: 6, fat: 1 } },
        { name: '돈육 김치찌개', allergies: [5, 6, 9, 10, 13], nutrition: { kcal: 180, carbs: 8, protein: 12, fat: 10 } },
        { name: '수제 치즈 돈까스 & 브라운 소스', allergies: [1, 2, 5, 6, 10, 12], nutrition: { kcal: 450, carbs: 35, protein: 25, fat: 22 } },
        { name: '시금치 고추장 무침', allergies: [5, 6], nutrition: { kcal: 40, carbs: 6, protein: 2, fat: 1 } },
        { name: '깍두기', allergies: [9, 13], nutrition: { kcal: 15, carbs: 3, protein: 1, fat: 0 } }
    ],
    dinner: [
        { name: '직화 닭갈비 덮밥', allergies: [5, 6, 15], nutrition: { kcal: 580, carbs: 75, protein: 28, fat: 18 } },
        { name: '유부 맑은 장국', allergies: [5, 6], nutrition: { kcal: 35, carbs: 4, protein: 2, fat: 1 } },
        { name: '단무지 무침', allergies: [], nutrition: { kcal: 20, carbs: 5, protein: 0, fat: 0 } },
        { name: '수제 자몽 에이드', allergies: [13], nutrition: { kcal: 110, carbs: 28, protein: 0, fat: 0 } }
    ]
};

const ALLERGY_KOREAN_NAMES = {
    1: '난류', 2: '우유', 3: '메밀', 4: '땅콩', 5: '대두',
    6: '밀', 7: '고등어', 8: '게', 9: '새우', 10: '돼지고기',
    11: '복숭아', 12: '토마토', 13: '아황산류', 14: '호두', 15: '닭고기',
    16: '쇠고기', 17: '오징어', 18: '조개류', 19: '잣'
};

const MAXIMUM_CAFETERIA_SEATS = 300;
const BROWSER_STORAGE_KEYS = {
    ALLERGIES: 'gbs_user_allergies',
    RATING: 'gbs_meal_rating',
    VOTE: 'gbs_dessert_vote',
    THEME: 'gbs_theme_preference'
};

/**
 * 상단 날짜 렌더링
 */
function renderCurrentDateText() {
    const dateDisplayElement = document.getElementById('current-date-display');
    const todayDateObject = new Date();
    const formattedDateString = new Intl.DateTimeFormat('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    }).format(todayDateObject);
    
    dateDisplayElement.textContent = `${formattedDateString} 식단`;
}

/**
 * 실시간 혼잡도 업데이트 (테마별 색상 로직 포함)
 */
function updateRealTimeCongestionStatus() {
    const peopleCountElement = document.getElementById('current-people-count');
    const badgeElement = document.getElementById('congestion-badge');
    const progressBarElement = document.getElementById('congestion-progress-bar');
    const waitTimeElement = document.getElementById('estimated-wait-time');
    const isDark = document.documentElement.classList.contains('dark');

    const currentPeopleCount = Math.floor(Math.random() * 350);
    const congestionRatio = currentPeopleCount / MAXIMUM_CAFETERIA_SEATS;
    
    peopleCountElement.textContent = currentPeopleCount;
    
    const estimatedMinutes = Math.max(0, Math.floor((currentPeopleCount - 150) * 0.12));
    waitTimeElement.textContent = `${estimatedMinutes}분`;

    applyCongestionVisualStyles({ currentPeopleCount, congestionRatio, badgeElement, progressBarElement, isDark });
}

function applyCongestionVisualStyles({ currentPeopleCount, congestionRatio, badgeElement, progressBarElement, isDark }) {
    const percentageWidth = Math.min(100, congestionRatio * 100);
    progressBarElement.style.width = `${percentageWidth}%`;

    // Tailwind 클래스 리셋
    badgeElement.className = 'px-3 py-1 rounded-full text-xs font-semibold border transition-colors';
    progressBarElement.className = 'absolute top-0 left-0 h-full transition-all duration-1000 ease-out';

    if (currentPeopleCount < 150) {
        // 쾌적
        if (isDark) {
            badgeElement.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/30');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-emerald-400', 'to-emerald-500');
        } else {
            badgeElement.classList.add('bg-teal-100', 'text-teal-700', 'border-teal-200');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-teal-400', 'to-teal-500');
        }
        badgeElement.textContent = '쾌적';
    } else if (currentPeopleCount < 250) {
        // 보통
        if (isDark) {
            badgeElement.classList.add('bg-amber-500/20', 'text-amber-400', 'border-amber-500/30');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-amber-400', 'to-amber-500');
        } else {
            badgeElement.classList.add('bg-amber-100', 'text-amber-700', 'border-amber-200');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-amber-400', 'to-amber-500');
        }
        badgeElement.textContent = '보통';
    } else {
        // 혼잡
        if (isDark) {
            badgeElement.classList.add('bg-rose-500/20', 'text-rose-400', 'border-rose-500/30');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-rose-400', 'to-rose-500');
        } else {
            badgeElement.classList.add('bg-rose-100', 'text-rose-700', 'border-rose-200');
            progressBarElement.classList.add('bg-gradient-to-r', 'from-rose-400', 'to-rose-500');
        }
        badgeElement.textContent = '혼잡';
    }
}

/**
 * 테마 토글 (다크모드/라이트모드)
 */
function initializeThemeToggle() {
    const toggleButton = document.getElementById('theme-toggle-button');
    const htmlElement = document.documentElement;
    
    // 저장된 테마 불러오기 (없으면 시스템 설정 따르기)
    const savedTheme = localStorage.getItem(BROWSER_STORAGE_KEYS.THEME);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }

    toggleButton.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        const isDark = htmlElement.classList.contains('dark');
        localStorage.setItem(BROWSER_STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
        
        // 테마 변경 시 동적 요소(혼잡도 바 등) 스타일 즉시 업데이트
        updateRealTimeCongestionStatus();
        
        // 투표 바 스타일 즉시 업데이트 (수정됨)
        refreshVoteVisuals();

        // 투표 바 등 다른 동적 요소들도 업데이트 필요 시 호출
        const activeTabButton = document.querySelector('.meal-tab-button.active');
        if (activeTabButton) renderMealMenuListCards(activeTabButton.getAttribute('data-meal-type'));
    });
}

/**
 * 투표 바 비주얼 강제 업데이트 함수 (테마 변경 시 호출용)
 */
function refreshVoteVisuals() {
    const voteOptions = document.querySelectorAll('.vote-option');
    const savedVoteOptionId = localStorage.getItem(BROWSER_STORAGE_KEYS.VOTE);
    
    // 현재 투표 데이터 상태를 알 수 없으므로(클로저 변수라 접근 불가), 
    // 로컬스토리지 값만 사용하여 선택된 항목의 스타일만 다시 적용하는 방식으로 처리하거나,
    // initializeDessertVotingSystem을 전역 변수 사용하도록 리팩토링해야 함.
    // 여기서는 간단하게 UI 클래스만 재조정하는 로직을 수행.
    
    const isDark = document.documentElement.classList.contains('dark');

    voteOptions.forEach(optionElement => {
        const optionId = optionElement.getAttribute('data-option-id');
        const progressBarElement = optionElement.querySelector('.vote-progress-bar');
        const borderContainer = optionElement.querySelector('.relative.p-3');

        // 기존 클래스 모두 제거 (Light/Dark 모두)
        progressBarElement.classList.remove('bg-teal-500/10', 'bg-teal-500/30', 'bg-blue-500/20', 'bg-blue-500/50');
        borderContainer.classList.remove('border-teal-400', 'bg-teal-50', 'border-slate-200/60', 'border-blue-400', 'bg-blue-500/10', 'border-white/5');

        if (optionId === savedVoteOptionId) {
            // Selected
            if (isDark) {
                borderContainer.classList.add('border-blue-400', 'bg-blue-500/10');
                progressBarElement.classList.add('bg-blue-500/50');
            } else {
                borderContainer.classList.add('border-teal-400', 'bg-teal-50');
                progressBarElement.classList.add('bg-teal-500/30');
            }
        } else {
            // Default
            if (isDark) {
                borderContainer.classList.add('border-white/5');
                progressBarElement.classList.add('bg-blue-500/20');
            } else {
                borderContainer.classList.add('border-slate-200/60');
                progressBarElement.classList.add('bg-teal-500/10');
            }
        }
    });
}


/**
 * 사용자 알레르기 데이터 로드
 */
function fetchUserProfileAllergies() {
    const savedAllergiesJson = localStorage.getItem(BROWSER_STORAGE_KEYS.ALLERGIES);
    return savedAllergiesJson ? JSON.parse(savedAllergiesJson) : [];
}

/**
 * 식단 카드 렌더링
 */
function renderMealMenuListCards(mealType) {
    const menuListContainer = document.getElementById('meal-menu-list');
    const currentMealItems = SCHOOL_MEAL_DATA[mealType];
    const userAllergies = fetchUserProfileAllergies();
    
    const isDark = document.documentElement.classList.contains('dark');

    menuListContainer.innerHTML = '';

    currentMealItems.forEach((menuItem) => {
        const { name: foodName, allergies: foodAllergies, nutrition } = menuItem;
        const conflictingAllergies = foodAllergies.filter(allergyNumber => userAllergies.includes(allergyNumber));
        const hasAllergyConflict = conflictingAllergies.length > 0;

        const listItemElement = document.createElement('li');
        // cursor-pointer 추가
        listItemElement.className = 'p-4 rounded-2xl border flex justify-between items-center transition-all duration-300 transform hover:scale-[1.01] cursor-pointer ' +
            'bg-white/60 border-slate-200/60 hover:bg-white ' + // Light
            'dark:bg-slate-800/40 dark:border-white/5 dark:hover:bg-slate-800/60'; // Dark
        
        if (hasAllergyConflict) {
            listItemElement.classList.add('allergy-warning-item');
        }

        const allergyNumbersText = foodAllergies.length > 0 ? `(${foodAllergies.join('.')})` : '';

        const warningIconHtml = hasAllergyConflict 
            ? `<i data-lucide="alert-triangle" class="w-5 h-5 text-rose-500 mr-3 animate-pulse"></i>` 
            : `<div class="w-2 h-2 rounded-full mr-4 bg-slate-300 dark:bg-slate-600"></div>`;

        listItemElement.innerHTML = `
            <div class="flex items-center">
                ${warningIconHtml}
                <span class="font-medium ${hasAllergyConflict ? 'allergy-warning-text' : 'text-slate-800 dark:text-slate-200'}">
                    ${foodName}
                </span>
            </div>
            <span class="text-xs font-medium px-2 py-1 rounded-md text-slate-500 bg-slate-100 dark:text-slate-500 dark:bg-slate-900/50">${allergyNumbersText}</span>
        `;
        
        // 클릭 이벤트 추가: 영양정보 모달 열기 (알레르기 정보도 전달)
        listItemElement.addEventListener('click', () => {
            openNutritionModal(foodName, nutrition, foodAllergies);
        });

        menuListContainer.appendChild(listItemElement);
    });

    lucide.createIcons();
}

/**
 * 영양정보 모달 열기 (알레르기 정보 추가)
 */
function openNutritionModal(foodName, nutrition, allergies) {
    const modalElement = document.getElementById('nutrition-modal');
    const modalContent = document.getElementById('nutrition-modal-content');
    const titleElement = document.getElementById('nutrition-food-name');
    const allergyContainer = document.getElementById('nutrition-allergies');
    
    // 데이터 바인딩
    titleElement.textContent = foodName;
    document.getElementById('nutrition-kcal').textContent = nutrition ? nutrition.kcal + ' kcal' : '-';
    document.getElementById('nutrition-carbs').textContent = nutrition ? nutrition.carbs + 'g' : '-';
    document.getElementById('nutrition-protein').textContent = nutrition ? nutrition.protein + 'g' : '-';
    document.getElementById('nutrition-fat').textContent = nutrition ? nutrition.fat + 'g' : '-';

    // 알레르기 태그 렌더링
    allergyContainer.innerHTML = '';
    if (allergies && allergies.length > 0) {
        allergies.forEach(allergyNum => {
            const tagName = ALLERGY_KOREAN_NAMES[allergyNum] || `알레르기 ${allergyNum}`;
            const tag = document.createElement('span');
            tag.className = 'px-2 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-100 dark:border-rose-500/30';
            tag.textContent = tagName;
            allergyContainer.appendChild(tag);
        });
    } else {
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'text-xs text-slate-400';
        emptyMsg.textContent = '알레르기 유발 성분 없음';
        allergyContainer.appendChild(emptyMsg);
    }

    // 모달 표시
    modalElement.classList.remove('hidden');
    void modalContent.offsetWidth; // 리플로우
    modalContent.classList.remove('translate-y-full', 'md:translate-y-4', 'md:opacity-0');
    modalContent.classList.add('translate-y-0');
}

/**
 * 영양정보 모달 초기화
 */
function prepareNutritionModal() {
    const modalElement = document.getElementById('nutrition-modal');
    const modalContent = document.getElementById('nutrition-modal-content');
    const closeButton = document.getElementById('close-nutrition-modal');

    const closeModal = () => {
        modalContent.classList.remove('translate-y-0');
        modalContent.classList.add('translate-y-full', 'md:translate-y-4', 'md:opacity-0');
        setTimeout(() => modalElement.classList.add('hidden'), 300);
    };

    closeButton.addEventListener('click', closeModal);
    modalElement.addEventListener('click', (e) => { if (e.target === modalElement) closeModal(); });
}


/**
 * 탭 인터랙션
 */
function initializeMealTabInteractions() {
    const tabButtons = document.querySelectorAll('.meal-tab-button');
    
    tabButtons.forEach(buttonElement => {
        buttonElement.addEventListener('click', (event) => {
            const clickedButton = event.currentTarget;
            const targetMealType = clickedButton.getAttribute('data-meal-type');
            
            tabButtons.forEach(btn => {
                btn.classList.remove('active', 'text-slate-800', 'dark:text-white', 'shadow-md');
                btn.classList.add('text-slate-500', 'dark:text-slate-400');
            });
            
            clickedButton.classList.add('active', 'text-slate-800', 'dark:text-white', 'shadow-md');
            clickedButton.classList.remove('text-slate-500', 'dark:text-slate-400');
            
            renderMealMenuListCards(targetMealType);
        });
    });
}

/**
 * 별점 시스템
 */
function initializeStarRatingSystem() {
    const starButtons = document.querySelectorAll('.star-btn');
    const feedbackTextElement = document.getElementById('rating-feedback-text');
    const savedRatingValue = localStorage.getItem(BROWSER_STORAGE_KEYS.RATING);

    if (savedRatingValue) {
        applyStarRatingVisuals({ targetRating: parseInt(savedRatingValue), starButtons, feedbackTextElement });
    }

    starButtons.forEach(buttonElement => {
        buttonElement.addEventListener('click', (event) => {
            const targetRating = parseInt(event.currentTarget.getAttribute('data-rating'));
            localStorage.setItem(BROWSER_STORAGE_KEYS.RATING, targetRating);
            applyStarRatingVisuals({ targetRating, starButtons, feedbackTextElement });
        });
    });
}

function applyStarRatingVisuals({ targetRating, starButtons, feedbackTextElement }) {
    starButtons.forEach(btn => {
        const buttonRating = parseInt(btn.getAttribute('data-rating'));
        
        if (buttonRating <= targetRating) {
            btn.classList.remove('text-slate-300', 'dark:text-slate-600');
            // Light: amber-400, Dark: yellow-400
            btn.classList.add('text-amber-400', 'dark:text-yellow-400', 'scale-110');
            setTimeout(() => btn.classList.remove('scale-110'), 200);
        } else {
            btn.classList.add('text-slate-300', 'dark:text-slate-600');
            btn.classList.remove('text-amber-400', 'dark:text-yellow-400');
        }
    });

    const feedbackMessages = ['아쉬워요 😢', '그저 그래요 😕', '보통이에요 😐', '맛있어요! 😋', '최고예요! 😍'];
    
    feedbackTextElement.style.opacity = '0';
    setTimeout(() => {
        feedbackTextElement.textContent = feedbackMessages[targetRating - 1];
        feedbackTextElement.style.opacity = '1';
        feedbackTextElement.style.transition = 'opacity 0.3s';
    }, 150);
}

/**
 * 투표 시스템
 */
function initializeDessertVotingSystem() {
    const voteOptions = document.querySelectorAll('.vote-option');
    const savedVoteOptionId = localStorage.getItem(BROWSER_STORAGE_KEYS.VOTE);
    
    // UI 시연을 위한 가상의 초기 투표 수 데이터 (메뉴 변경 반영)
    let voteCountsData = {
        'malatang': 142,    // 기존 macaron -> malatang
        'rosechicken': 185  // 기존 icecream -> rosechicken
    };

    // 기존 저장된 키가 변경되었을 수 있으므로 초기화 혹은 매핑 고려
    // 간단하게, 새로운 키가 아니면 무시하도록 처리
    
    if (savedVoteOptionId && voteCountsData[savedVoteOptionId]) {
        voteCountsData[savedVoteOptionId]++;
        updateVoteProgressVisuals({ voteCountsData, voteOptions, selectedOptionId: savedVoteOptionId });
    }

    voteOptions.forEach(optionElement => {
        optionElement.addEventListener('click', (event) => {
            const currentOption = event.currentTarget;
            const optionId = currentOption.getAttribute('data-option-id');
            const previousVote = localStorage.getItem(BROWSER_STORAGE_KEYS.VOTE);

            if (previousVote === optionId) return; 
            if (previousVote && voteCountsData[previousVote]) voteCountsData[previousVote]--;
            
            voteCountsData[optionId]++;
            localStorage.setItem(BROWSER_STORAGE_KEYS.VOTE, optionId);

            updateVoteProgressVisuals({ voteCountsData, voteOptions, selectedOptionId: optionId });
            showVoteCompletionToast();
        });
    });
}

/**
 * 투표 완료 시 토스트 메시지를 3초간 표시합니다.
 */
function showVoteCompletionToast() {
    const toastElement = document.getElementById('vote-toast');
    
    // 보이기
    toastElement.classList.remove('hidden');
    void toastElement.offsetWidth; // 리플로우
    toastElement.classList.remove('opacity-0', 'translate-y-2');
    toastElement.classList.add('opacity-100', 'translate-y-0');

    // 3초 뒤 자연스럽게 사라지기
    setTimeout(() => {
        toastElement.classList.remove('opacity-100', 'translate-y-0');
        toastElement.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toastElement.classList.add('hidden'), 300);
    }, 3000);
}

function updateVoteProgressVisuals({ voteCountsData, voteOptions, selectedOptionId }) {
    // 총 투표수 계산 시 새로운 키 사용
    const totalVotesCount = (voteCountsData.malatang || 0) + (voteCountsData.rosechicken || 0);
    const isDark = document.documentElement.classList.contains('dark');

    voteOptions.forEach(optionElement => {
        const optionId = optionElement.getAttribute('data-option-id');
        const progressBarElement = optionElement.querySelector('.vote-progress-bar');
        const percentageTextElement = optionElement.querySelector('.vote-percentage');
        const borderContainer = optionElement.querySelector('.relative.p-3');
        
        const optionVoteRatio = totalVotesCount === 0 ? 0 : (voteCountsData[optionId] / totalVotesCount);
        const percentageValue = Math.round(optionVoteRatio * 100);

        setTimeout(() => {
            progressBarElement.style.width = `${percentageValue}%`;
            percentageTextElement.classList.remove('opacity-0');
        }, 50);
        
        percentageTextElement.textContent = `${percentageValue}%`;

        // 클래스 초기화
        progressBarElement.classList.remove('bg-teal-500/10', 'bg-teal-500/30', 'bg-blue-500/20', 'bg-blue-500/50');
        borderContainer.classList.remove('border-teal-400', 'bg-teal-50', 'border-slate-200/60', 'border-blue-400', 'bg-blue-500/10', 'border-white/5');

        if (optionId === selectedOptionId) {
            // Selected Style
            if (isDark) {
                borderContainer.classList.add('border-blue-400', 'bg-blue-500/10');
                progressBarElement.classList.add('bg-blue-500/50');
            } else {
                borderContainer.classList.add('border-teal-400', 'bg-teal-50');
                progressBarElement.classList.add('bg-teal-500/30');
            }
        } else {
            // Default Style
            if (isDark) {
                borderContainer.classList.add('border-white/5');
                progressBarElement.classList.add('bg-blue-500/20');
            } else {
                borderContainer.classList.add('border-slate-200/60');
                progressBarElement.classList.add('bg-teal-500/10');
            }
        }
    });
}

/**
 * 알레르기 모달 (버튼 제거로 인해 호출되지 않지만, 코드 보존)
 */
function prepareAllergySettingsModal() {
    // 버튼이 제거되었으므로 에러 방지를 위한 체크
    const openButton = document.getElementById('allergy-settings-button');
    if (!openButton) return;

    const modalElement = document.getElementById('allergy-modal');
    const modalContentElement = document.getElementById('allergy-modal-content');
    const closeButton = document.getElementById('close-allergy-modal');
    const saveButton = document.getElementById('save-allergy-settings');
    const checkboxContainer = document.getElementById('allergy-checkboxes-container');

    Object.entries(ALLERGY_KOREAN_NAMES).forEach(([allergyNumber, allergyName]) => {
        const labelElement = document.createElement('label');
        labelElement.className = 'flex items-center space-x-2 p-2.5 rounded-xl cursor-pointer transition-colors border border-transparent ' +
            'hover:bg-slate-50 hover:border-slate-200 ' + // Light
            'dark:hover:bg-white/5 dark:hover:border-white/5'; // Dark
            
        labelElement.innerHTML = `
            <input type="checkbox" value="${allergyNumber}" class="allergy-checkbox w-4 h-4 rounded transition-all ` +
            `border-slate-300 text-teal-500 focus:ring-teal-500 bg-white ` + // Light
            `dark:border-slate-600 dark:text-indigo-500 dark:focus:ring-indigo-500 dark:bg-slate-800">` + // Dark
            `<span class="text-sm font-medium text-slate-700 dark:text-slate-300">${allergyName}</span>
        `;
        checkboxContainer.appendChild(labelElement);
    });

    const closeAllergyModalDialog = () => {
        modalContentElement.classList.remove('translate-y-0');
        modalContentElement.classList.add('translate-y-full', 'md:translate-y-4', 'md:opacity-0');
        setTimeout(() => modalElement.classList.add('hidden'), 300);
    };

    openButton.addEventListener('click', () => {
        const userAllergies = fetchUserProfileAllergies();
        const checkboxes = document.querySelectorAll('.allergy-checkbox');
        checkboxes.forEach(cb => cb.checked = userAllergies.includes(parseInt(cb.value)));
        
        modalElement.classList.remove('hidden');
        void modalContentElement.offsetWidth;
        modalContentElement.classList.remove('translate-y-full', 'md:translate-y-4', 'md:opacity-0');
        modalContentElement.classList.add('translate-y-0');
    });

    closeButton.addEventListener('click', closeAllergyModalDialog);
    modalElement.addEventListener('click', (event) => { if (event.target === modalElement) closeAllergyModalDialog(); });

    saveButton.addEventListener('click', () => {
        const selectedCheckboxes = document.querySelectorAll('.allergy-checkbox:checked');
        const selectedAllergyNumbers = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        localStorage.setItem(BROWSER_STORAGE_KEYS.ALLERGIES, JSON.stringify(selectedAllergyNumbers));
        closeAllergyModalDialog();
        
        const activeTabButton = document.querySelector('.meal-tab-button.active');
        if (activeTabButton) renderMealMenuListCards(activeTabButton.getAttribute('data-meal-type'));
    });
}

function initializeDashboardApplication() {
    // 테마 설정을 가장 먼저 초기화
    initializeThemeToggle();
    
    renderCurrentDateText();
    updateRealTimeCongestionStatus();
    setInterval(updateRealTimeCongestionStatus, 3000);

    initializeMealTabInteractions();
    prepareAllergySettingsModal();
    renderMealMenuListCards('lunch');

    initializeStarRatingSystem();
    initializeDessertVotingSystem();
    prepareNutritionModal(); // 영양정보 모달 초기화 추가
}

document.addEventListener('DOMContentLoaded', initializeDashboardApplication);
