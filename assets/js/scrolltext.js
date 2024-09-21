const flickerFrequency = 0.3; // Adjust this value to control flickering frequency
const brightnessFlickerFrequency = 0.05; // Adjust this value to control brightness flickering frequency

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('scrolling-container');
    const textElements = container.getElementsByClassName('scrolling-text');
    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+{}[]|;:,.<>?áéíóúñÑ¿¡üÜöÖäÄßÇçØøÅåÆæœŒ€£¥¢¤αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";


    function setupMatrixText(element) {
        const originalText = element.textContent;
        element.innerHTML = originalText.split('').map(char => `<span class="matrix-char" data-original="${char}">${char}</span>`).join('');
    }

    function animateText(element) {
        const chars = element.getElementsByClassName('matrix-char');

        function updateChar(char) {
            // Random character change 
            if (Math.random() < 0.006) {
                const originalChar = char.getAttribute('data-original');
                if (char.textContent === originalChar) {
                    char.textContent = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                    setTimeout(() => {
                        char.textContent = originalChar;
                    }, 500 + Math.random() * 1000);
                }
            }

            // Random flickering effect
            if (Math.random() < flickerFrequency) {
                const glowLevel = Math.floor(Math.random() * 4) + 1;
                const flickerOpacity = 0.3 + Math.random() * 0.7; // Random opacity between 0.3 and 1
                char.className = `matrix-char glow-${glowLevel}`;
                char.style.opacity = flickerOpacity.toString();

                setTimeout(() => {
                    char.className = 'matrix-char';
                    char.style.opacity = '1';
                }, 30 + Math.random() * 100);
            }

            // Random brightness flicker
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

    Array.from(textElements).forEach((element, index) => {
        setupMatrixText(element);

        const randomTop = Math.random() * (container.clientHeight - element.clientHeight);
        element.style.top = `${randomTop}px`;

        // Set initial opacity to 0 and visibility to hidden
        element.style.opacity = '0';
        element.style.visibility = 'hidden';

        // Delay the start of the animation and fade-in
        setTimeout(() => {
            element.classList.add('animation-active');
            element.style.visibility = 'visible';
            element.style.opacity = '1'; // This will trigger the fade-in transition
            element.style.animationDelay = `${index * 2}s`; // Offset each line's animation start

            // Start the character animations after the fade-in
            setTimeout(() => {
                animateText(element);
            }, 2000); // Wait for 2 seconds (duration of the fade-in)
        }, index * 2000); // Start each line's animation 2 seconds after the previous one
    });
});
