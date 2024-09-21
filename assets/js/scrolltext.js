document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('scrolling-container');
    console.log("Container:", container);
    const textElements = container.getElementsByClassName('scrolling-text');
    console.log("Text elements:", textElements, "Length:", textElements.length);

    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+{}[]|;:,.<>?";

    function setupMatrixText(element) {
        const originalText = element.textContent;
        element.innerHTML = originalText.split('').map(char => `<span class="matrix-char" data-original="${char}">${char}</span>`).join('');
    }

    function animateText(element) {
        const chars = element.getElementsByClassName('matrix-char');
        setInterval(() => {
            Array.from(chars).forEach(char => {
                if (Math.random() < 0.005) {
                    const originalChar = char.getAttribute('data-original');
                    if (char.textContent === originalChar) {
                        char.textContent = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                        setTimeout(() => {
                            char.textContent = originalChar;
                        }, 500 + Math.random() * 1000);
                    }
                }
                if (Math.random() < 0.01) {
                    char.style.opacity = '0.1';
                    setTimeout(() => char.style.opacity = '1', 50);
                }
            });
        }, 50);
    }

    Array.from(textElements).forEach((element, index) => {
        console.log("Processing element:", element);

        setupMatrixText(element);

        const randomTop = Math.random() * (container.clientHeight - element.clientHeight);
        console.log("Random top:", randomTop);
        element.style.top = `${randomTop}px`;
        console.log("Set top to:", element.style.top);

        element.style.animationDelay = `${index * 2}s`;
        console.log("Set animation delay to:", element.style.animationDelay);

        animateText(element);

        // Use requestAnimationFrame to add the class after the next paint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.classList.add('animation-active');
            });
        });
    });
});
