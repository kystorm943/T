let score = 0;
let highScore = 0;
let currentAnswer = 0;

const questionEl = document.getElementById('question');
const questionBox = document.getElementById('question-box');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const feedbackEmoji = document.getElementById('feedback-emoji');
const buttons = [
    document.getElementById('btn-0'),
    document.getElementById('btn-1'),
    document.getElementById('btn-2'),
    document.getElementById('btn-3')
];

// 화려한 색상 배열
const colors = ['#ff5e5e', '#ffb833', '#4cd137', '#00a8ff', '#be2edd', '#ffa502', '#ff4757', '#1e90ff'];

// 로컬 스토리지에서 최고 점수 불러오기
if (localStorage.getItem('gugudanHighScore')) {
    highScore = parseInt(localStorage.getItem('gugudanHighScore'));
    highScoreEl.textContent = highScore;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion() {
    // 애니메이션 리셋
    questionBox.classList.remove('bounce-in');
    void questionBox.offsetWidth; // trigger reflow
    questionBox.classList.add('bounce-in');

    const num1 = getRandomInt(2, 9);
    const num2 = getRandomInt(1, 9);
    currentAnswer = num1 * num2;

    questionEl.textContent = `${num1} × ${num2} = ?`;

    // 정답 보기 배열 생성
    let answers = [currentAnswer];

    // 오답 3개 생성 (정답과 헷갈리게 비슷한 숫자)
    while (answers.length < 4) {
        let wrongAnswer = 0;
        const randomType = getRandomInt(1, 4);
        
        if (randomType === 1) wrongAnswer = currentAnswer + getRandomInt(1, 3);
        else if (randomType === 2) wrongAnswer = currentAnswer - getRandomInt(1, 3);
        else if (randomType === 3) wrongAnswer = num1 * getRandomInt(1, 9);
        else wrongAnswer = getRandomInt(4, 81);

        // 정답은 자연수이며, 중복되지 않도록 방지
        if (wrongAnswer > 0 && !answers.includes(wrongAnswer)) {
            answers.push(wrongAnswer);
        }
    }

    // 배열 무작위로 섞기 (Fisher-Yates 알고리즘)
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    // 색상 섞기
    let shuffledColors = [...colors].sort(() => 0.5 - Math.random()).slice(0, 4);

    // 버튼에 텍스트와 색상 적용
    buttons.forEach((btn, index) => {
        btn.textContent = answers[index];
        btn.style.backgroundColor = shuffledColors[index];
        // 기존 스타일 초기화 (오답 애니메이션 등)
        btn.classList.remove('shake');
        btn.disabled = false;
    });
}

function createConfetti() {
    const emojis = ['🌟', '⭐', '🎈', '🎉', '🍎', '🌈', '🍓', '💡'];
    for (let i = 0; i < 15; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
        document.body.appendChild(confetti);

        // 애니메이션 끝나면 DOM에서 제거
        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

function showFeedback(isCorrect) {
    feedbackEmoji.classList.remove('hidden', 'show-emoji');
    void feedbackEmoji.offsetWidth; // trigger reflow
    
    if (isCorrect) {
        // 정답 이모지 목록
        const goodEmojis = ['😎', '😆', '😍', '🥳', '💯', '✨'];
        feedbackEmoji.textContent = goodEmojis[Math.floor(Math.random() * goodEmojis.length)];
    } else {
        // 오답 이모지 목록
        const badEmojis = ['😅', '😵', '😱', '🤪', '💦'];
        feedbackEmoji.textContent = badEmojis[Math.floor(Math.random() * badEmojis.length)];
    }
    
    feedbackEmoji.classList.add('show-emoji');
    setTimeout(() => {
        feedbackEmoji.classList.add('hidden');
    }, 1000);
}

function handleAnswer(e) {
    const selectedAnswer = parseInt(e.target.textContent);

    // 버튼 중복 클릭 방지
    buttons.forEach(btn => btn.disabled = true);

    if (selectedAnswer === currentAnswer) {
        // 정답!
        score += 10;
        scoreEl.textContent = score;
        scoreEl.classList.add('pop');
        setTimeout(() => scoreEl.classList.remove('pop'), 300);

        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('gugudanHighScore', highScore);
        }

        e.target.classList.add('pop');
        showFeedback(true);
        createConfetti();

        // 0.8초 후 다음 문제
        setTimeout(() => {
            generateQuestion();
        }, 800);
    } else {
        // 오답!
        score = Math.max(0, score - 5);
        scoreEl.textContent = score;
        
        e.target.classList.add('shake');
        questionBox.classList.add('shake');
        setTimeout(() => questionBox.classList.remove('shake'), 500);

        showFeedback(false);

        // 0.8초 후 다음 문제 (혹은 현재 문제 유지할 수 있으나, 아이들을 위해 그냥 넘기기)
        setTimeout(() => {
            generateQuestion();
        }, 800);
    }
}

// 이벤트 리스너 등록
buttons.forEach(btn => {
    btn.addEventListener('click', handleAnswer);
});

// 첫 번째 문제 생성
generateQuestion();
