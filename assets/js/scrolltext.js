import lyrics from './lyrics.js';

const flickerFrequency = 0.3;
const brightnessFlickerFrequency = 0.05;

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('scrolling-container');
    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+{}[]|;:,.<>?áéíóúñÑ¿¡üÜöÖäÄßÇçØøÅåÆæœŒ€£¥¢¤αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

    function setupMatrixText(element, text) {
        element.innerHTML = text.split('').map(char =>
            `<span class="matrix-char" data-original="${char}">${char}</span>`
        ).join('');
    }

    function animateText(element) {
        const chars = element.getElementsByClassName('matrix-char');

        function updateChar(char) {
            if (Math.random() < 0.006) {
                const originalChar = char.getAttribute('data-original');
                if (char.textContent === originalChar) {
                    char.textContent = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                    setTimeout(() => {
                        char.textContent = originalChar;
                    }, 500 + Math.random() * 1000);
                }
            }

            if (Math.random() < flickerFrequency) {
                const glowLevel = Math.floor(Math.random() * 4) + 1;
                const flickerOpacity = 0.3 + Math.random() * 0.7;
                char.className = `matrix-char glow-${glowLevel}`;
                char.style.opacity = flickerOpacity.toString();

                setTimeout(() => {
                    char.className = 'matrix-char';
                    char.style.opacity = '1';
                }, 30 + Math.random() * 100);
            }

            if (Math.random() < brightnessFlickerFrequency) {
                char.classList.add('bright');
                setTimeout(() => {
                    char.classList.remove('bright');
                }, 50 + Math.random() * 150);
            }
        }

        setInterval(() => {
            Array.from(chars).forEach(updateChar);
        }, 30);
    }

    lyrics.forEach((lyric, index) => {
        const element = document.createElement('div');
        element.className = 'scrolling-text';
        container.appendChild(element);

        setupMatrixText(element, lyric);

        const randomTop = Math.random() * (container.clientHeight - element.clientHeight);
        element.style.top = `${randomTop}px`;
        element.style.left = '50%';

        element.style.opacity = '0';
        element.style.transition = 'opacity 5s ease-in, left 60s linear';

        setTimeout(() => {
            element.style.visibility = 'visible';
            element.style.opacity = '0.3'; // Fade in to a lower opacity
            element.style.left = '-100%'; // Scroll to the left

            setTimeout(() => {
                animateText(element);
            }, 2000);
        }, index * 2000);
    });
});


document.querySelectorAll('.nav-item').forEach(item => {
    item.innerHTML = item.textContent.split('').map(char =>
        `<span class="nav-char">${char}</span>`
    ).join('');
});


document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.innerHTML = item.textContent.split('').map(char =>
            `<span class="nav-char">${char}</span>`
        ).join('');
    });

    function randomFlicker() {
        const chars = document.querySelectorAll('.nav-char');
        chars.forEach(char => {
            if (Math.random() < 0.01) { // Adjust this value to control frequency
                char.classList.add('flicker');
                setTimeout(() => {
                    char.classList.remove('flicker');
                }, 100 + Math.random() * 200); // Random duration between 100-300ms
            }
        });
    }

    setInterval(randomFlicker, 50); // Run every 50ms
});
