# QuizFlow App (панель викладача)

Піддомен: **app.quizflow.space**. Панель викладача: головна, тести, конструктор, спроби, посилання, аналітика, журнал, студенти, сповіщення, підозрілі, онлайн, новини, історія ігор, профіль, вхід, реєстрація, онбординг, `auth-action` (листи Firebase Auth), Live-моніторинг (`live.html`) і сторінки ведучого гри (`live/setup`, `lobby`, `play-teacher`, `podium`). Вхід викладача є лише тут.

Статичний сайт (без збірки) на GitHub Pages. Правила роботи з кодом — у [CLAUDE.md](CLAUDE.md), тести — у [tests/README.md](tests/README.md).

## Як підключити домен
1. DNS: `CNAME` запис `app` → `vadympavlina.github.io`.
2. GitHub: Settings → Pages → Source: **GitHub Actions**; Custom domain: `app.quizflow.space`; увімкнути Enforce HTTPS.
3. Firebase Console → Authentication → Settings → Authorized domains: додати `app.quizflow.space`.
