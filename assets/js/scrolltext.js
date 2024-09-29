import lyrics from './lyrics.js';

// Controller variables
const SCROLL_SPEED = 200; // seconds to cross the screen
const INITIAL_OPACITY = 0.2; // 0-1, initial opacity of text
const TEXT_DELAY = 1000; // 1 second delay between each new lyric
const SCREEN_WIDTH = window.innerWidth; // Get the screen width
const MAX_LIVE_ELEMENTS = 15; // Maximum number of live elements on screen

const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+{}[]|;:,.<>?áéíóúñÑ¿¡üÜöÖäÄßÇçØøÅåÆæœŒ€£¥¢¤αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

function getRandomChar() {
    return matrixChars[Math.floor(Math.random() * matrixChars.length)];
}

// Matrix effect setup and animation
function applyMatrixEffect(element) {
    const text = element.textContent;
    element.innerHTML = text.split('').map(char =>
        `<span class="matrix-char" data-original="${char}">${char}</span>`
    ).join('');

    const chars = element.querySelectorAll('.matrix-char');
    let isHovered = false;

    const isNavItem = element.classList.contains('nav-item');

    function animateMatrix() {
        if (!isHovered) {
            chars.forEach(char => {
                if (isNavItem) {
                    // Nav item animation
                    const baseBrightness = 0.8; // Higher brightness for nav items
                    const baseOpacity = 0.9; // Higher opacity for nav items
                    const brightnessVariation = 0.2;
                    const opacityVariation = 0.2;

                    const brightness = baseBrightness + (Math.random() * brightnessVariation - brightnessVariation / 2);
                    const opacity = baseOpacity + (Math.random() * opacityVariation - opacityVariation / 2);

                    char.style.color = `rgba(0, ${Math.floor(255 * brightness)}, 0, ${opacity})`;
                    char.style.textShadow = `0 0 2px rgba(0, ${Math.floor(255 * brightness)}, 0, ${opacity})`;

                    // Less frequent character change for nav items
                    if (Math.random() < 0.01) {
                        const originalChar = char.textContent;
                        char.textContent = getRandomChar();
                        setTimeout(() => {
                            char.textContent = originalChar;
                        }, 100 + Math.random() * 200);
                    }
                } else {
                    // Background text animation (unchanged)
                    if (Math.random() < 0.005) {
                        char.textContent = getRandomChar();

                        const brightness = 0.2 + Math.random() * 0.2;
                        const opacity = 0.1 + Math.random() * 0.2;

                        char.style.color = `rgba(0, ${Math.floor(255 * brightness)}, 0, ${opacity})`;
                        char.style.textShadow = `0 0 2px rgba(0, ${Math.floor(255 * brightness)}, 0, ${opacity})`;

                        setTimeout(() => {
                            char.textContent = char.dataset.original;
                            char.style.color = '';
                            char.style.textShadow = '';
                        }, 200 + Math.random() * 300);
                    }

                    if (Math.random() < 0.05) {
                        const subtleBrightness = 0.2 + Math.random() * 0.1;
                        const subtleOpacity = 0.1 + Math.random() * 0.1;
                        char.style.color = `rgba(0, ${Math.floor(255 * subtleBrightness)}, 0, ${subtleOpacity})`;
                    }
                }
            });
        }

        requestAnimationFrame(animateMatrix);
    }

    animateMatrix();

    // Hover effect for nav items
    if (isNavItem) {
        element.addEventListener('mouseenter', () => {
            isHovered = true;
            chars.forEach(char => {
                char.style.color = '#00ff00';
                char.style.textShadow = '0 0 5px #00ff00, 0 0 10px #00ff00';
            });
        });

        element.addEventListener('mouseleave', () => {
            isHovered = false;
            chars.forEach(char => {
                char.style.color = '';
                char.style.textShadow = '';
            });
        });
    }
}


// Scrolling text setup and animation

function setupScrollingText() {
    const container = document.getElementById('scrolling-container');
    if (!container) {
        console.error("Scrolling container not found");
        return;
    }

    let currentIndex = 0;
    let liveElements = 0;

    function addNextLyric() {
        if (liveElements < MAX_LIVE_ELEMENTS) {
            const lyric = lyrics[currentIndex];
            const element = createLyricElement(lyric);
            container.appendChild(element);
            animateLyric(element, () => liveElements--);
            liveElements++;

            currentIndex = (currentIndex + 1) % lyrics.length; // Loop back to 0 when reaching the end
        }

        // Schedule the next lyric
        setTimeout(addNextLyric, TEXT_DELAY);
    }
    // Nav item setup and flickering effect
    document.querySelectorAll('.nav-item').forEach(applyMatrixEffect);

    // Start the loop
    addNextLyric();
}

function createLyricElement(lyric) {
    const element = document.createElement('div');
    element.className = 'scrolling-text';
    element.innerHTML = lyric.split('').map(char =>
        `<span class="matrix-char" data-original="${char}" style="opacity: ${(0.2 + Math.random() * 0.3).toFixed(2)}">${char}</span>`
    ).join('');
    element.style.position = 'absolute';
    element.style.whiteSpace = 'nowrap';
    element.style.left = `${SCREEN_WIDTH}px`;
    element.style.top = `${Math.random() * (window.innerHeight - 50)}px`;

    applyMatrixEffect(element);

    return element;
}


function updateCharOpacities(element) {
    const chars = element.querySelectorAll('.matrix-char');
    chars.forEach(char => {
        if (Math.random() < 0.1) { // 10% chance to update opacity
            const newOpacity = 0.1 + Math.random() * 0.4; // Random opacity between 0.1 and 0.5
            char.style.opacity = newOpacity.toFixed(2);
        }
    });
}

function animateLyric(element, onComplete) {
    const startTime = performance.now();
    let lastOpacityUpdate = 0;

    function step(currentTime) {
        const elapsedTime = (currentTime - startTime) / 1000;
        const progress = elapsedTime / SCROLL_SPEED;

        if (progress < 1) {
            const leftPosition = SCREEN_WIDTH - (progress * (SCREEN_WIDTH + element.offsetWidth));
            element.style.left = `${leftPosition}px`;

            // Update individual character opacities
            if (currentTime - lastOpacityUpdate > 100) { // Update every 100ms
                updateCharOpacities(element);
                lastOpacityUpdate = currentTime;
            }

            requestAnimationFrame(step);
        } else {
            element.remove();
            onComplete();
        }
    }

    requestAnimationFrame(step);
}



document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, setting up scrolling text"); // Debug log
    setupScrollingText();
});
