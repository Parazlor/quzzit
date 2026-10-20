(function() {
    var totalQuestions = questions.length;

    var startScreen     = document.getElementById('startScreen');
    var gameScreen      = document.getElementById('gameScreen');
    var resultScreen    = document.getElementById('resultScreen');
    var duelRoundScreen = document.getElementById('duelRoundScreen');

    var questionText    = document.getElementById('questionText');
    var answersGrid     = document.getElementById('answersGrid');
    var scoreDisplay    = document.getElementById('scoreDisplay');
    var counterDisplay  = document.getElementById('counterDisplay');
    var finalScore      = document.getElementById('finalScore');
    var resultMessage   = document.getElementById('resultMessage');
    var restartBtn      = document.getElementById('restartBtn');

    var soloModeBtn     = document.getElementById('soloModeBtn');
    var duelModeBtn     = document.getElementById('duelModeBtn');

    var duelTurnBanner  = document.getElementById('duelTurnBanner');

    var duelRoundTitle    = document.getElementById('duelRoundTitle');
    var duelRoundQuestion = document.getElementById('duelRoundQuestion');
    var duelRoundCardP1   = document.getElementById('duelRoundCardP1');
    var duelRoundCardP2   = document.getElementById('duelRoundCardP2');
    var duelRoundAnswerP1 = document.getElementById('duelRoundAnswerP1');
    var duelRoundAnswerP2 = document.getElementById('duelRoundAnswerP2');
    var duelRoundVerdictP1= document.getElementById('duelRoundVerdictP1');
    var duelRoundVerdictP2= document.getElementById('duelRoundVerdictP2');
    var duelTotalLine     = document.getElementById('duelTotalLine');
    var duelContinueBtn   = document.getElementById('duelContinueBtn');

    var currentQuestionIndex = 0;
    var score = 0;
    var canAnswer = true;
    var duelCurrentPlayer = 1;
    var duelScoresState = { p1: 0, p2: 0 };
    var duelAnsweredCurrent = false;
    var duelRoundAnswers = { p1: { isCorrect: false, text: '' }, p2: { isCorrect: false, text: '' } };

    function show(el) { el.classList.remove('hidden'); }
    function hide(el) { el.classList.add('hidden'); }

    function resetDuelRoundAnswers() {
        duelRoundAnswers = { p1: { isCorrect: false, text: '' }, p2: { isCorrect: false, text: '' } };
    }

    // ===== ОБЫЧНЫЙ РЕЖИМ =====
    function renderSoloQuestion() {
        var q = questions[currentQuestionIndex];
        questionText.textContent = q.question;
        answersGrid.innerHTML = '';
        answersGrid.classList.remove('disabled-answers');

        q.answers.forEach(function(answer, idx) {
            var btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.setAttribute('data-index', idx);
            btn.textContent = answer;
            btn.addEventListener('click', function() { handleSoloAnswer(idx); });
            answersGrid.appendChild(btn);
        });

        canAnswer = true;
        scoreDisplay.textContent = score;
        counterDisplay.textContent = (currentQuestionIndex + 1) + ' / ' + totalQuestions;
    }

    function handleSoloAnswer(selectedIndex) {
        if (!canAnswer) return;
        canAnswer = false;
        answersGrid.classList.add('disabled-answers');

        var q = questions[currentQuestionIndex];
        if (selectedIndex === q.correct) {
            score += 1;
            scoreDisplay.textContent = score;
        }

        setTimeout(function() {
            if (currentQuestionIndex < totalQuestions - 1) {
                currentQuestionIndex++;
                renderSoloQuestion();
            } else {
                showSoloResult();
            }
        }, 280);
    }

    function showSoloResult() {
        hide(gameScreen);
        hide(duelRoundScreen);
        show(resultScreen);

        finalScore.textContent = score + ' из ' + totalQuestions;

        var message = '';
        if (score === 6 || score === 5) message = '🤯 ВАУ! Ты знаешь меня как свои пять пальцев! Мы с тобой точно на одной волне. Даже видеокарту угадал!';
        else if (score === 4) message = '😎 Отличный результат! Ты меня очень хорошо знаешь. Почти идеально, но есть куда стремиться!';
        else if (score === 3) message = '😊 Неплохо! Ты знаешь меня довольно хорошо, но пара моментов осталась загадкой. Может, пересмотрим?';
        else if (score === 2) message = '🤔 Ну... есть над чем подумать. Ты знаешь меня чуть-чуть, но давай дружить ещё теснее!';
        else if (score === 1) message = '😅 Ой! Кажется, ты меня совсем не знаешь. Но это отличный повод начать общаться больше!';
        else message = '😱 0 из 6? Ты точно уверен, что мы друзья? Ладно, давай знакомиться заново!';

        resultMessage.textContent = message;
        counterDisplay.textContent = totalQuestions + ' / ' + totalQuestions;
        scoreDisplay.textContent = score;
    }

    // ===== ДУЭЛЬ =====
    // ВАЖНО: во время игры счёт скрыт! Показываем только номер вопроса.
    // Счёт появляется на промежуточном экране после ответа Игрока 2.

    function renderDuelQuestion() {
        var q = questions[currentQuestionIndex];
        questionText.textContent = q.question;
        answersGrid.innerHTML = '';
        answersGrid.classList.remove('disabled-answers');

        q.answers.forEach(function(answer, idx) {
            var btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.setAttribute('data-index', idx);
            btn.textContent = answer;
            btn.addEventListener('click', function() { handleDuelAnswer(idx); });
            answersGrid.appendChild(btn);
        });

        duelAnsweredCurrent = false;
        canAnswer = true;

        duelTurnBanner.textContent = '🎯 Отвечает: Игрок ' + duelCurrentPlayer;

        // Счёт СКРЫТ во время игры!
        scoreDisplay.textContent = '?';
        counterDisplay.textContent = (currentQuestionIndex + 1) + ' / ' + totalQuestions;
    }

    function handleDuelAnswer(selectedIndex) {
        if (!canAnswer || duelAnsweredCurrent) return;
        canAnswer = false;
        duelAnsweredCurrent = true;
        answersGrid.classList.add('disabled-answers');

        var q = questions[currentQuestionIndex];
        var isCorrect = (selectedIndex === q.correct);
        var answerText = q.answers[selectedIndex];

        if (duelCurrentPlayer === 1) {
            duelRoundAnswers.p1 = { isCorrect: isCorrect, text: answerText };
            if (isCorrect) duelScoresState.p1 += 1;
        } else {
            duelRoundAnswers.p2 = { isCorrect: isCorrect, text: answerText };
            if (isCorrect) duelScoresState.p2 += 1;
        }

        setTimeout(function() {
            if (duelCurrentPlayer === 1) {
                duelCurrentPlayer = 2;
                renderDuelQuestion();
            } else {
                showDuelRoundSummary();
            }
        }, 280);
    }

    // Здесь показываем счёт обоих игроков и итоги раунда
    function showDuelRoundSummary() {
        hide(gameScreen);
        show(duelRoundScreen);

        var q = questions[currentQuestionIndex];
        duelRoundTitle.textContent = 'Раунд ' + (currentQuestionIndex + 1) + ' из ' + totalQuestions;
        duelRoundQuestion.textContent = q.question;

        duelRoundAnswerP1.textContent = 'Ответ: ' + (duelRoundAnswers.p1.text || '—');
        duelRoundVerdictP1.textContent = duelRoundAnswers.p1.isCorrect ? '✅ +1' : '❌ 0';
        duelRoundCardP1.classList.toggle('correct', duelRoundAnswers.p1.isCorrect);
        duelRoundCardP1.classList.toggle('wrong', !duelRoundAnswers.p1.isCorrect);

        duelRoundAnswerP2.textContent = 'Ответ: ' + (duelRoundAnswers.p2.text || '—');
        duelRoundVerdictP2.textContent = duelRoundAnswers.p2.isCorrect ? '✅ +1' : '❌ 0';
        duelRoundCardP2.classList.toggle('correct', duelRoundAnswers.p2.isCorrect);
        duelRoundCardP2.classList.toggle('wrong', !duelRoundAnswers.p2.isCorrect);

        duelTotalLine.textContent = 'Общий счёт: Игрок 1 — ' + duelScoresState.p1 + '  |  Игрок 2 — ' + duelScoresState.p2;

        if (currentQuestionIndex < totalQuestions - 1) {
            duelContinueBtn.textContent = '➡️ Следующий вопрос';
        } else {
            duelContinueBtn.textContent = '🏁 Показать результат';
        }
    }

    function handleDuelContinue() {
        hide(duelRoundScreen);

        if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
            duelCurrentPlayer = 1;
            resetDuelRoundAnswers();
            show(gameScreen);
            renderDuelQuestion();
        } else {
            showDuelResult();
        }
    }

    function showDuelResult() {
        hide(gameScreen);
        hide(duelRoundScreen);
        show(resultScreen);

        var p1 = duelScoresState.p1;
        var p2 = duelScoresState.p2;
        finalScore.textContent = p1 + ' : ' + p2;

        var message = '';
        if (p1 > p2) message = '🏆 Победил Игрок 1! Со счётом ' + p1 + ':' + p2 + '. Игрок 2, не расстраивайся — реванш?';
        else if (p2 > p1) message = '🏆 Победил Игрок 2! Со счётом ' + p2 + ':' + p1 + '. Игрок 1, отыграешься?';
        else message = '🤝 Ничья ' + p1 + ':' + p2 + '! Вы оба знаете меня одинаково хорошо (или одинаково плохо). Реванш?';

        resultMessage.textContent = message;
        counterDisplay.textContent = totalQuestions + ' / ' + totalQuestions;
        scoreDisplay.textContent = p1 + ' : ' + p2;
    }

    // ===== Запуск =====
    function startSoloMode() {
        currentQuestionIndex = 0;
        score = 0;
        canAnswer = true;

        hide(startScreen);
        hide(resultScreen);
        hide(duelRoundScreen);
        show(gameScreen);
        hide(duelTurnBanner);

        scoreDisplay.textContent = '0';
        counterDisplay.textContent = '1 / ' + totalQuestions;
        renderSoloQuestion();
    }

    function startDuelMode() {
        currentQuestionIndex = 0;
        duelCurrentPlayer = 1;
        duelScoresState = { p1: 0, p2: 0 };
        duelAnsweredCurrent = false;
        resetDuelRoundAnswers();
        canAnswer = true;

        hide(startScreen);
        hide(resultScreen);
        hide(duelRoundScreen);
        show(gameScreen);
        show(duelTurnBanner);

        // Счёт скрыт на старте дуэли
        scoreDisplay.textContent = '?';
        counterDisplay.textContent = '1 / ' + totalQuestions;
        renderDuelQuestion();
    }

    function resetToStart() {
        hide(gameScreen);
        hide(resultScreen);
        hide(duelRoundScreen);
        show(startScreen);

        currentQuestionIndex = 0;
        score = 0;
        duelScoresState = { p1: 0, p2: 0 };
        duelCurrentPlayer = 1;
        duelAnsweredCurrent = false;
        resetDuelRoundAnswers();
        canAnswer = true;

        scoreDisplay.textContent = '0';
        counterDisplay.textContent = '1 / ' + totalQuestions;
        answersGrid.innerHTML = '';
        answersGrid.classList.remove('disabled-answers');
        questionText.textContent = '';
        hide(duelTurnBanner);
    }

    // Кнопки
    soloModeBtn.addEventListener('click', startSoloMode);
    duelModeBtn.addEventListener('click', startDuelMode);
    duelContinueBtn.addEventListener('click', handleDuelContinue);
    restartBtn.addEventListener('click', resetToStart);

    resetToStart();
})();
