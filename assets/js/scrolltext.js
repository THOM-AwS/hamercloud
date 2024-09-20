const lyricsContent = document.querySelector('.lyrics-content');
let position = 100;

function animateLyrics() {
    position -= 0.5;
    lyricsContent.style.top = `${position}%`;

    if (position < -100) {
        position = 100;
    }

    requestAnimationFrame(animateLyrics);
}

animateLyrics();
